import { createHash } from "node:crypto";

import { and, desc, eq, gt, inArray, isNull, ne, notInArray } from "drizzle-orm";

import { alertPolicyConditionsSchema } from "../../contracts/alerts.ts";
import { db } from "../../db/client.ts";
import {
  alertChannels,
  alertDeliveries,
  alertEvents,
  alertPolicies,
  alertPolicyChannels,
  alertPolicySchedules,
  alertPolicyTargets,
  scanChangeItems,
  scanComparisons,
  scans,
} from "../../db/schema.ts";
import { enqueueGraphileJob } from "../jobs/graphile.ts";
import { isRetiredChangeType, RETIRED_CHANGE_TYPES } from "../../changes/change-types.ts";

const DELIVERY_MAX_ATTEMPTS = 8;
const MAX_CHANGE_ITEMS_PER_COMPARISON = 1_000;
const MAX_ENABLED_POLICIES = 1_000;
const MAX_POLICY_LINKS = 25_000;

type ChangeItem = typeof scanChangeItems.$inferSelect;

export interface PolicyConditionInput {
  selectionMode: "all" | "selected";
  changeTypes: string[];
}

export interface PolicyCoverageInput {
  coverage: "all_targets" | "selected_targets" | "selected_schedules";
  canonicalTargetId: string | null;
  scheduleId: string | null;
  selectedTargetIds: ReadonlySet<string>;
  selectedScheduleIds: ReadonlySet<string>;
}

export function policyCoversScan(input: PolicyCoverageInput) {
  if (input.coverage === "all_targets") {
    return true;
  }
  if (input.coverage === "selected_targets") {
    return input.canonicalTargetId !== null && input.selectedTargetIds.has(input.canonicalTargetId);
  }
  return input.scheduleId !== null && input.selectedScheduleIds.has(input.scheduleId);
}

export function changeMatchesPolicyConditions(
  item: Pick<ChangeItem, "alertEligible" | "changeType">,
  conditions: PolicyConditionInput,
) {
  if (isRetiredChangeType(item.changeType)) return false;
  if (item.changeType === "response_headers.changed" && !item.alertEligible) return false;
  if (conditions.selectionMode === "all") return true;
  return conditions.changeTypes.includes(item.changeType);
}

function eventDeduplicationKey(policyId: string, comparisonId: string) {
  return createHash("sha256")
    .update(`scan.changes\0${policyId}\0${comparisonId}`)
    .digest("hex");
}

function safePolicyConditions(value: unknown): PolicyConditionInput | null {
  const parsed = alertPolicyConditionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Evaluates all currently enabled policies for one immutable comparison.
 * Event/delivery uniqueness and Graphile job keys make repeated evaluation safe.
 */
export async function evaluateAlertPolicies(comparisonId: string) {
  const [comparisonContext] = await db
    .select({ comparison: scanComparisons, scan: scans })
    .from(scanComparisons)
    .innerJoin(scans, eq(scans.id, scanComparisons.comparisonScanId))
    .where(and(eq(scanComparisons.id, comparisonId), eq(scanComparisons.status, "completed")))
    .limit(1);

  if (!comparisonContext) {
    return { evaluatedPolicies: 0, createdEvents: 0, queuedDeliveries: 0, suppressedEvents: 0 };
  }

  const [items, policies] = await Promise.all([
    db.select().from(scanChangeItems)
      .where(and(
        eq(scanChangeItems.comparisonId, comparisonId),
        notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
      ))
      .limit(MAX_CHANGE_ITEMS_PER_COMPARISON + 1),
    db.select().from(alertPolicies)
      .where(and(
        eq(alertPolicies.state, "enabled"),
        isNull(alertPolicies.deletedAt),
      ))
      .limit(MAX_ENABLED_POLICIES + 1),
  ]);

  if (items.length > MAX_CHANGE_ITEMS_PER_COMPARISON) {
    throw new Error("Alert evaluation exceeds the 1000 change-item limit.");
  }
  if (policies.length > MAX_ENABLED_POLICIES) {
    throw new Error("Alert evaluation exceeds the 1000 enabled-policy limit.");
  }
  if (items.length === 0 || policies.length === 0) {
    return { evaluatedPolicies: policies.length, createdEvents: 0, queuedDeliveries: 0, suppressedEvents: 0 };
  }

  const policyIds = policies.map((policy) => policy.id);
  const [channelLinks, targetLinks, scheduleLinks] = await Promise.all([
    db.select({ policyId: alertPolicyChannels.policyId, channelId: alertPolicyChannels.channelId })
      .from(alertPolicyChannels)
      .innerJoin(alertChannels, and(
        eq(alertChannels.id, alertPolicyChannels.channelId),
        eq(alertChannels.enabled, true),
        isNull(alertChannels.deletedAt),
      ))
      .where(inArray(alertPolicyChannels.policyId, policyIds))
      .limit(MAX_POLICY_LINKS + 1),
    db.select().from(alertPolicyTargets)
      .where(inArray(alertPolicyTargets.policyId, policyIds))
      .limit(MAX_POLICY_LINKS + 1),
    db.select().from(alertPolicySchedules)
      .where(inArray(alertPolicySchedules.policyId, policyIds))
      .limit(MAX_POLICY_LINKS + 1),
  ]);

  if ([channelLinks, targetLinks, scheduleLinks].some((links) => links.length > MAX_POLICY_LINKS)) {
    throw new Error("Alert evaluation exceeds the 25000 policy-link limit.");
  }

  const channelIdsByPolicy = new Map<string, string[]>();
  const targetIdsByPolicy = new Map<string, Set<string>>();
  const scheduleIdsByPolicy = new Map<string, Set<string>>();
  for (const link of channelLinks) {
    const ids = channelIdsByPolicy.get(link.policyId) ?? [];
    ids.push(link.channelId);
    channelIdsByPolicy.set(link.policyId, ids);
  }
  for (const link of targetLinks) {
    const ids = targetIdsByPolicy.get(link.policyId) ?? new Set<string>();
    ids.add(link.canonicalTargetId);
    targetIdsByPolicy.set(link.policyId, ids);
  }
  for (const link of scheduleLinks) {
    const ids = scheduleIdsByPolicy.get(link.policyId) ?? new Set<string>();
    ids.add(link.scheduleId);
    scheduleIdsByPolicy.set(link.policyId, ids);
  }

  let createdEvents = 0;
  let suppressedEvents = 0;
  let queuedDeliveries = 0;

  for (const policy of policies) {
    const conditions = policy.conditionsSchemaVersion === 1 || policy.conditionsSchemaVersion === 2
      ? safePolicyConditions(policy.conditionsJson)
      : null;
    if (!conditions || !policyCoversScan({
      coverage: policy.coverage,
      canonicalTargetId: comparisonContext.scan.canonicalTargetId,
      scheduleId: comparisonContext.scan.scheduleId,
      selectedTargetIds: targetIdsByPolicy.get(policy.id) ?? new Set(),
      selectedScheduleIds: scheduleIdsByPolicy.get(policy.id) ?? new Set(),
    })) {
      continue;
    }

    const matchedItems = items.filter((item) => changeMatchesPolicyConditions(item, conditions));
    const channelIds = channelIdsByPolicy.get(policy.id) ?? [];
    if (matchedItems.length === 0 || channelIds.length === 0) {
      continue;
    }

    const now = new Date();
    const inCooldown = policy.cooldownSeconds > 0
      ? Boolean((await db.select({ id: alertEvents.id })
          .from(alertEvents)
          .innerJoin(scanComparisons, eq(scanComparisons.id, alertEvents.comparisonId))
          .where(and(
            eq(alertEvents.policyId, policy.id),
            ne(alertEvents.state, "suppressed"),
            gt(alertEvents.createdAt, new Date(now.getTime() - policy.cooldownSeconds * 1_000)),
            comparisonContext.scan.canonicalTargetId
              ? eq(scanComparisons.canonicalTargetId, comparisonContext.scan.canonicalTargetId)
              : eq(scanComparisons.comparisonScanId, comparisonContext.scan.id),
          )).orderBy(desc(alertEvents.createdAt)).limit(1))[0])
      : false;
    const summaryJson = {
      headline: `${matchedItems.length} monitored change${matchedItems.length === 1 ? "" : "s"} detected`,
      totalChanges: comparisonContext.comparison.changeCount,
      includedChanges: matchedItems.length,
      targetId: comparisonContext.scan.canonicalTargetId,
      targetLabel: comparisonContext.scan.normalizedTarget,
      targetUrl: comparisonContext.scan.normalizedTarget,
      comparisonScanId: comparisonContext.comparison.comparisonScanId,
      baselineScanId: comparisonContext.comparison.baselineScanId,
      matchedItemIds: matchedItems.map((item) => item.id),
    };

    const persisted = await db.transaction(async (tx) => {
      const [insertedEvent] = await tx.insert(alertEvents).values({
        policyId: policy.id,
        comparisonId,
        deduplicationKey: eventDeduplicationKey(policy.id, comparisonId),
        state: inCooldown ? "suppressed" : "pending",
        matchedItemCount: matchedItems.length,
        summaryJson,
        suppressionReason: inCooldown ? "policy_cooldown" : null,
        suppressedAt: inCooldown ? now : null,
        completedAt: inCooldown ? now : null,
        updatedAt: now,
      }).onConflictDoNothing().returning({ id: alertEvents.id });

      if (!insertedEvent || inCooldown) {
        return { created: Boolean(insertedEvent), deliveries: 0 };
      }

      const deliveries = await tx.insert(alertDeliveries).values(channelIds.map((channelId) => ({
        eventId: insertedEvent.id,
        channelId,
        status: "queued" as const,
        updatedAt: now,
      }))).onConflictDoNothing().returning({ id: alertDeliveries.id, channelId: alertDeliveries.channelId });

      for (const delivery of deliveries) {
        await enqueueGraphileJob(tx, "deliver_alert", { deliveryId: delivery.id }, {
          jobKey: `alert-delivery:${delivery.id}`,
          jobKeyMode: "unsafe_dedupe",
          queueName: `alert-channel:${delivery.channelId}`,
          maxAttempts: DELIVERY_MAX_ATTEMPTS,
        });
      }
      return { created: true, deliveries: deliveries.length };
    });

    if (persisted.created) {
      createdEvents += 1;
      suppressedEvents += inCooldown ? 1 : 0;
      queuedDeliveries += persisted.deliveries;
    }
  }

  return { evaluatedPolicies: policies.length, createdEvents, queuedDeliveries, suppressedEvents };
}

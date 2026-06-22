import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { demoScanRateLimits } from "@/lib/db/schema";
import { getDemoDailyScanLimit } from "@/lib/demo-mode";
import { env } from "@/lib/env/server";

type DemoScanQuotaReservation = {
  visitorKeyHash: string;
  day: string;
};

type DemoScanQuotaResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  reservation: DemoScanQuotaReservation | null;
};

function getUtcDay(now: Date) {
  return now.toISOString().slice(0, 10);
}

function getNextUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function getFirstHeaderValue(value: string | null) {
  return value?.split(",").map((part) => part.trim()).find(Boolean) ?? null;
}

function getVisitorKey(headers: Headers) {
  const railwayClientIp = getFirstHeaderValue(headers.get("x-real-ip"));

  if (railwayClientIp) {
    return `x-real-ip:${railwayClientIp}`;
  }

  const forwardedForClientIp = getFirstHeaderValue(headers.get("x-forwarded-for"));

  if (forwardedForClientIp) {
    return `x-forwarded-for:${forwardedForClientIp}`;
  }

  return `fallback:${headers.get("user-agent") ?? "unknown"}`;
}

function hashVisitorKey(visitorKey: string) {
  return createHash("sha256")
    .update(`${env.BETTER_AUTH_SECRET ?? "stackray-demo"}:${visitorKey}`)
    .digest("hex");
}

function getRetryAfterSeconds(resetAt: Date, now: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
}

export function getDemoRateLimitHeaders(quota: Pick<DemoScanQuotaResult, "limit" | "remaining" | "resetAt">, now = new Date()) {
  return {
    "Retry-After": String(getRetryAfterSeconds(quota.resetAt, now)),
    "X-RateLimit-Limit": String(quota.limit),
    "X-RateLimit-Remaining": String(quota.remaining),
    "X-RateLimit-Reset": String(Math.floor(quota.resetAt.getTime() / 1000)),
  };
}

export async function consumeDemoScanQuota(request: Request, now = new Date()): Promise<DemoScanQuotaResult> {
  const day = getUtcDay(now);
  const resetAt = getNextUtcDay(now);
  const visitorKeyHash = hashVisitorKey(getVisitorKey(request.headers));
  const dailyLimit = getDemoDailyScanLimit();

  if (dailyLimit === 0) {
    return {
      allowed: false,
      limit: dailyLimit,
      remaining: 0,
      resetAt,
      reservation: null,
    };
  }

  const [row] = await db
    .insert(demoScanRateLimits)
    .values({
      visitorKeyHash,
      day,
      scanCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [demoScanRateLimits.visitorKeyHash, demoScanRateLimits.day],
      set: {
        scanCount: sql`${demoScanRateLimits.scanCount} + 1`,
        updatedAt: now,
      },
      where: sql`${demoScanRateLimits.scanCount} < ${dailyLimit}`,
    })
    .returning({
      scanCount: demoScanRateLimits.scanCount,
    });

  if (!row) {
    return {
      allowed: false,
      limit: dailyLimit,
      remaining: 0,
      resetAt,
      reservation: null,
    };
  }

  return {
    allowed: true,
    limit: dailyLimit,
    remaining: Math.max(0, dailyLimit - row.scanCount),
    resetAt,
    reservation: {
      visitorKeyHash,
      day,
    },
  };
}

export async function refundDemoScanQuota(reservation: DemoScanQuotaReservation) {
  await db
    .update(demoScanRateLimits)
    .set({
      scanCount: sql`greatest(${demoScanRateLimits.scanCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(sql`${demoScanRateLimits.visitorKeyHash} = ${reservation.visitorKeyHash} and ${demoScanRateLimits.day} = ${reservation.day}`);
}

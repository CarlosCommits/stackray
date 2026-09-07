import {
  CHANGE_TYPE_DEFINITIONS,
} from "../../changes/change-types.ts";
import { createChangePreviewSample } from "../../changes/change-preview-samples.ts";
import {
  alertPreviewResponseSchema,
  type AlertPreviewRequest,
} from "../../contracts/alert-preview.ts";
import { getExecutionTarget, normalizeTarget } from "../scans/normalize-targets.ts";
import { resolveConfiguredInstanceOrigin } from "../../public-origin-config.ts";
import { buildChangeAlertEmail } from "../email/templates/change-alert.ts";
import { createAlertWebhookPayload } from "./alert-payload.ts";

export function buildAlertPreview(
  input: AlertPreviewRequest,
  now = new Date(),
  options: { assetOrigin?: string } = {},
) {
  const normalizedTarget = normalizeTarget(input.target);
  const executionTarget = getExecutionTarget(input.target);
  const selectedTypeSet = new Set(input.changeTypes);
  const selectedDefinitions = CHANGE_TYPE_DEFINITIONS.filter((definition) => (
    selectedTypeSet.has(definition.type)
  ));
  const changes = selectedDefinitions.map((definition, index) => (
    createChangePreviewSample(definition.type, executionTarget, index)
  ));
  const count = changes.length;
  const payload = createAlertWebhookPayload({
    eventId: "preview-event",
    eventCreatedAt: now,
    comparisonId: "preview-comparison",
    publicOrigin: options.assetOrigin ?? resolveConfiguredInstanceOrigin() ?? "http://localhost:3000",
    summary: {
      headline: `${count} monitored change${count === 1 ? "" : "s"} detected`,
      totalChanges: count,
      includedChanges: count,
      targetId: "preview-target",
      targetLabel: normalizedTarget.normalizedTarget,
      targetUrl: executionTarget,
      comparisonScanId: "preview-current-scan",
      baselineScanId: "preview-baseline-scan",
      matchedItemIds: changes.map((change) => change.id),
    },
    changes,
  });

  return alertPreviewResponseSchema.parse({
    email: buildChangeAlertEmail(payload, options),
  });
}

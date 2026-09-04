import {
  canSendConfiguredEmail,
  deliverConfiguredEmail,
  type ConfiguredEmailDeliveryResult,
  type ConfiguredEmailMessage,
  type SendConfiguredEmail,
} from "../email/provider.ts";

export type AlertEmailMessage = ConfiguredEmailMessage;
export type AlertEmailDeliveryResult = ConfiguredEmailDeliveryResult;

export const canSendAlertEmail = canSendConfiguredEmail;

export function deliverAlertEmail(
  message: AlertEmailMessage,
  options: { sendEmail?: SendConfiguredEmail } = {},
) {
  return deliverConfiguredEmail(message, options);
}

export const SENDING_DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export const SENDING_DOMAIN_ERROR = "Enter a valid domain, such as example.com.";

export function normalizeSendingDomain(value: string) {
  return value.trim().toLowerCase();
}

export function isValidSendingDomain(value: string) {
  return SENDING_DOMAIN_PATTERN.test(value.trim());
}

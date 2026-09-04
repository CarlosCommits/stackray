const HTTP_STATUS_TEXT: Readonly<Record<number, string>> = {
  200: "OK",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

export function getHttpStatusText(statusCode: number) {
  return HTTP_STATUS_TEXT[statusCode] ?? "Unknown";
}

export function getHttpResponseClass(statusCode: number) {
  if (statusCode >= 100 && statusCode < 200) return "Informational response";
  if (statusCode >= 200 && statusCode < 300) return "Successful response";
  if (statusCode >= 300 && statusCode < 400) return "Redirect response";
  if (statusCode >= 400 && statusCode < 500) return "Client error response";
  if (statusCode >= 500 && statusCode < 600) return "Server error response";
  return "Unknown response";
}

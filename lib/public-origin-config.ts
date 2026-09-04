type PublicOriginEnvironment = {
  BETTER_AUTH_URL?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
};

function normalizeOrigin(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/** Resolves the website-owned public origin without introducing a localhost
 * fallback. Runtime workers must never create links to their own container. */
export function resolveConfiguredInstanceOrigin(
  environment: PublicOriginEnvironment = {
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  },
) {
  const betterAuthUrl = environment.BETTER_AUTH_URL?.trim();

  if (betterAuthUrl) {
    return normalizeOrigin(betterAuthUrl);
  }

  const railwayPublicDomain = environment.RAILWAY_PUBLIC_DOMAIN?.trim();
  return railwayPublicDomain ? normalizeOrigin(railwayPublicDomain) : null;
}

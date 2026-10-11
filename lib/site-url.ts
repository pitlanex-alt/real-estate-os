import "server-only";

function normalizeSiteUrl(value: string) {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(candidate).origin;
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return normalizeSiteUrl(configuredUrl);

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) return normalizeSiteUrl(vercelProductionUrl);

  return "http://localhost:3000";
}

export function getTeamInviteRedirectUrl() {
  return new URL("/auth/invite", getSiteUrl()).toString();
}

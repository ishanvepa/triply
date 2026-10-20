import "server-only";

export function getSiteOrigin() {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  if (
    !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
    (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  ) throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS, or HTTP on localhost.");
  return url.origin;
}

export function isGoogleAuthEnabled() {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}

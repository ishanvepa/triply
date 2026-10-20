export const AUTH_RETURN_TO_HEADER = "x-triply-return-to";
export const DEFAULT_AUTH_DESTINATION = "/settings";

export function isProtectedPath(pathname: string) {
  return ["/settings", "/trips", "/invite"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Never pass an untrusted `next` value directly to redirect(). Limit returns to
// application routes and reject network URLs, backslashes, and control chars.
export function getSafeNextPath(value: unknown): string {
  if (
    typeof value !== "string" || value.length > 2048 ||
    !value.startsWith("/") || value.startsWith("//") || value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  ) return DEFAULT_AUTH_DESTINATION;

  try {
    const url = new URL(value, "https://return.invalid");
    const decoded = decodeURIComponent(url.pathname);
    if (
      url.origin !== "https://return.invalid" || !isProtectedPath(url.pathname) ||
      decoded.includes("\\") || /%2f|%5c/i.test(url.pathname) ||
      [...decoded].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ) return DEFAULT_AUTH_DESTINATION;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function getLoginPath(next: unknown) {
  return `/login?${new URLSearchParams({ next: getSafeNextPath(next) })}`;
}

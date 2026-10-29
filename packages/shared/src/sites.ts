const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Turns user input ("https://mail.google.com/mail", "*.example.com",
 * "Example.com") into a bare lowercase hostname, or `null` if invalid.
 */
export function normalizeSiteInput(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^\*\./, '');
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;
  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (host === 'localhost') return host;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  return HOST_RE.test(host) && host.includes('.') ? host : null;
}

/** True when `hostname` equals an excluded site or is a subdomain of one. */
export function isSiteExcluded(hostname: string, excluded: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return excluded.some((site) => host === site || host.endsWith(`.${site}`));
}

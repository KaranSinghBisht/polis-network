/**
 * Shared gate for routes that read `~/.polis/` from the operator machine.
 *
 * Two ways a request can be granted access (any one passes):
 *  - `POLIS_WEB_LOCAL_READ_TOKEN` is set, and the request carries the same
 *    value in the `x-polis-demo-token` header or `?token=` query param.
 *  - In non-production only, request host is `localhost`, `127.0.0.1`,
 *    or `::1` (default for dev).
 *
 * `POLIS_WEB_EXPOSE_LOCAL_FILES=1` only permits token-gated tunnel reads; it
 * never bypasses `POLIS_WEB_LOCAL_READ_TOKEN`.
 *
 * In production on Vercel none of these will pass by default. Public routes
 * should return the bounded testnet proof snapshot rather than local secrets.
 */

export function canReadLocalFiles(request: Request): boolean {
  return canReadLocalFilesFromParts({
    host: request.headers.get("host"),
    token: readRequestToken(request),
  });
}

export function canReadLocalFilesFromParts({
  host,
  token: requestToken,
}: {
  host: string | null | undefined;
  token?: string | null;
}): boolean {
  const token = process.env.POLIS_WEB_LOCAL_READ_TOKEN;
  if (token) return requestToken === token;
  if (process.env.POLIS_WEB_EXPOSE_LOCAL_FILES === "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  const hostname = hostnameOnly(host ?? null);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function readRequestToken(request: Request): string | undefined {
  return (
    request.headers.get("x-polis-demo-token") ??
    new URL(request.url).searchParams.get("token") ??
    undefined
  );
}

function hostnameOnly(hostHeader: string | null): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(1, end) : undefined;
  }
  return host.split(":")[0];
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.trim().replace(/\/+$/, "");
}

function addOrigin(
  allowedOrigins: Set<string>,
  protocol: string | null | undefined,
  host: string | null | undefined,
) {
  const normalizedProtocol = protocol?.trim().replace(/:$/, "");
  const normalizedHost = host?.trim();

  if (!normalizedProtocol || !normalizedHost) {
    return;
  }

  allowedOrigins.add(`${normalizedProtocol}://${normalizedHost}`);
}

export function isSameOriginRequest(request: Request) {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));

  if (!requestOrigin) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set<string>();

  allowedOrigins.add(normalizeOrigin(requestUrl.origin) ?? requestUrl.origin);

  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(/:$/, "");
  addOrigin(allowedOrigins, forwardedProto, request.headers.get("x-forwarded-host"));
  addOrigin(allowedOrigins, forwardedProto, request.headers.get("host"));

  const configuredSiteUrl = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configuredSiteUrl) {
    allowedOrigins.add(configuredSiteUrl);
  }

  return allowedOrigins.has(requestOrigin);
}

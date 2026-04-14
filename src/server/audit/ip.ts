const stripPort = (value: string) => {
  // IPv6 in brackets: [::1]:1234
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) return value.slice(1, end);
    return value;
  }

  // IPv4 with port: 1.2.3.4:1234
  const parts = value.split(":");
  if (parts.length === 2 && parts[0] && /^\d+$/.test(parts[1])) {
    return parts[0];
  }

  return value;
};

const normalizeIp = (raw: string) => {
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (!trimmed) return null;

  // Common ipv4-mapped ipv6 format.
  const unwrapped = trimmed.startsWith("::ffff:")
    ? trimmed.slice("::ffff:".length)
    : trimmed;

  const withoutPort = stripPort(unwrapped);
  const cleaned = withoutPort.trim();
  return cleaned || null;
};

const firstFromCommaList = (value: string) => {
  const first = value.split(",")[0];
  return first ? normalizeIp(first) : null;
};

// RFC 7239 Forwarded header: for=1.2.3.4;proto=https;by=...
const firstForwardedFor = (value: string) => {
  const sections = value.split(",");
  for (const section of sections) {
    const params = section.split(";");
    for (const param of params) {
      const [key, ...rest] = param.trim().split("=");
      if (!key || rest.length === 0) continue;
      if (key.toLowerCase() !== "for") continue;
      const rawFor = rest.join("=");
      const ip = normalizeIp(rawFor);
      if (ip && ip.toLowerCase() !== "unknown") return ip;
    }
  }
  return null;
};

export const getRequestIp = (request: Request) => {
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    const candidate = firstForwardedFor(forwarded);
    if (candidate) return candidate;
  }

  const xForwardedFor =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-vercel-forwarded-for");
  if (xForwardedFor) {
    const candidate = firstFromCommaList(xForwardedFor);
    if (candidate) return candidate;
  }

  const direct =
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("true-client-ip") ??
    request.headers.get("x-client-ip");

  return direct ? normalizeIp(direct) : null;
};

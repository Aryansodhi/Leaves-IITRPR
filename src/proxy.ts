import { NextResponse, type NextRequest } from "next/server";

const shouldBypass = (pathname: string) => {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/robots.txt")) return true;
  return false;
};

export function proxy(request: NextRequest) {
  const enforce = process.env.AUTH_ENFORCE_CANONICAL_HOST === "true";
  const canonicalBase = process.env.NEXT_PUBLIC_APP_URL;

  if (!enforce || !canonicalBase) {
    return NextResponse.next();
  }

  const url = request.nextUrl;
  if (shouldBypass(url.pathname)) {
    return NextResponse.next();
  }

  let canonical: URL;
  try {
    canonical = new URL(canonicalBase);
  } catch {
    return NextResponse.next();
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;

  const canonicalProto = canonical.protocol.replace(":", "");
  const canonicalHost = canonical.host;

  if (proto === canonicalProto && host === canonicalHost) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(url.pathname + url.search, canonical);
  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ["/:path*"],
};

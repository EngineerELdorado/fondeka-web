import { NextRequest, NextResponse } from "next/server";
import { allowedProxyRoute } from "@/lib/proxy-policy";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const failure = (message: string, status: number) =>
  NextResponse.json({ message }, { status, headers: noStore });

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join("/");
  if (!allowedProxyRoute(route, request.method))
    return failure("This endpoint is not available in Fondeka Business.", 404);
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))
    return failure("Please sign in to continue.", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return failure("This request origin is not allowed.", 403);
  const base = process.env.FONDEKA_API_BASE_URL;
  if (!base) return failure("The Fondeka backend has not been configured.", 503);
  let upstreamUrl: URL;
  try {
    const root = new URL(base);
    if (!["https:", "http:"].includes(root.protocol) || root.username || root.password)
      throw new Error("Invalid backend URL");
    upstreamUrl = new URL(`${base.replace(/\/$/, "")}/${route}`);
    upstreamUrl.search = request.nextUrl.search;
  } catch {
    return failure("The Fondeka backend configuration is invalid.", 503);
  }
  const body = request.method === "GET" ? undefined : await request.text();
  if (body && new TextEncoder().encode(body).length > 64_000)
    return failure("This request is too large.", 413);
  try {
    const response = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        Authorization: authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client-Platform": "WEB",
        "X-Device-Platform": "WEB",
        "Accept-Language": request.headers.get("accept-language") || "en",
        ...(request.headers.get("x-device-id")
          ? { "X-Device-Id": request.headers.get("x-device-id")! }
          : {}),
        ...(request.headers.get("x-device-session")
          ? { "X-Device-Session": request.headers.get("x-device-session")! }
          : {}),
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 204) return new NextResponse(null, { status: 204, headers: noStore });
    const data = await response
      .json()
      .catch(() => ({ message: "Fondeka returned an unexpected response. Please try again." }));
    return NextResponse.json(data, { status: response.status, headers: noStore });
  } catch {
    return failure("Fondeka is temporarily unavailable. Please try again shortly.", 502);
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };

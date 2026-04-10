import { NextResponse } from "next/server";

import { auth0, isAuthEnabled } from "@/lib/auth0";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:8000";

function internalApiBaseUrl() {
  return process.env.INTERNAL_API_BASE_URL ?? DEFAULT_INTERNAL_API_BASE_URL;
}

function buildUpstreamUrl(requestUrl: string, pathSegments: string[]) {
  const base = internalApiBaseUrl().replace(/\/$/, "");
  const upstream = new URL(`${base}/${pathSegments.join("/")}`);
  upstream.search = new URL(requestUrl).search;
  return upstream;
}

async function handler(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  const upstream = buildUpstreamUrl(request.url, path);
  const headers = new Headers(request.headers);
  headers.delete("host");

  if (isAuthEnabled()) {
    if (!auth0) {
      return NextResponse.json(
        { error: "Auth0 is not configured correctly." },
        { status: 500 },
      );
    }

    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await auth0.getAccessToken();
    headers.set("authorization", `Bearer ${token}`);
  }

  const upstreamResponse = await fetch(upstream, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    redirect: "manual",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: upstreamResponse.headers,
  });
}

export const dynamic = "force-dynamic";

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;

import { NextRequest, NextResponse } from "next/server";

import { getAuth0Client } from "@/lib/auth0";

export async function proxy(request: NextRequest) {
  const auth0 = getAuth0Client();

  const url = new URL(request.url);
  if (url.pathname.startsWith("/auth")) {
    return await auth0.middleware(request);
  }

  const response = await auth0.middleware(request);
  const session = await auth0.getSession(request);

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

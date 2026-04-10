import { NextResponse } from "next/server";

import { getAuth0Client } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth0 = getAuth0Client();
  const session = await auth0.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      nickname: session.user.nickname ?? null,
    },
  });
}

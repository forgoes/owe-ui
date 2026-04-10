import { NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "/api/proxy";

export async function GET() {
  return NextResponse.json({
    apiBaseUrl: DEFAULT_API_BASE_URL,
  });
}

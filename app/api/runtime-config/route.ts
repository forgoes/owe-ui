import { NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export async function GET() {
  return NextResponse.json({
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  });
}

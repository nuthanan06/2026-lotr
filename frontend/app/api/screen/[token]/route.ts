import { NextRequest, NextResponse } from "next/server";

// Public, read-only proxy for delegate screens (/screen/<token>).
//
// Unlike /api/backend, this needs no staff session: delegate devices open a
// secret link instead of signing in as staff (which would expose the whole
// staff map). It forwards exactly one backend endpoint, whose response is
// already filtered to what that link's audience may see, and the token is
// the only key — random and rotatable from the Groups tab.
const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? "http://backend:8000";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return NextResponse.json({ detail: "This screen link is not valid." }, { status: 404 });
  }
  const headers = new Headers();
  if (ADMIN_API_TOKEN) headers.set("x-admin-token", ADMIN_API_TOKEN);
  try {
    const res = await fetch(`${INTERNAL_API_BASE_URL}/api/screens/${token}`, { headers, cache: "no-store" });
    return new NextResponse(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "Backend is unreachable." }, { status: 502 });
  }
}

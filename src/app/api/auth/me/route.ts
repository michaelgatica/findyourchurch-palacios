import { NextResponse } from "next/server";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        name:
          authenticatedUser.profile?.name ??
          authenticatedUser.email?.split("@")[0] ??
          "Find Your Church User",
        email: authenticatedUser.profile?.email ?? authenticatedUser.email ?? "",
        role: authenticatedUser.profile?.role ?? "pending_user",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

import { NextResponse } from "next/server";

import { clearFirebaseSessionCookie } from "@/lib/firebase/session";
import { isSameOriginRequest } from "@/lib/server/origin";

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      {
        error: "Invalid request origin.",
      },
      { status: 403 },
    );
  }

  await clearFirebaseSessionCookie();

  return NextResponse.json({
    success: true,
  });
}

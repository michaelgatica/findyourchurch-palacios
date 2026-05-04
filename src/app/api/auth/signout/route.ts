import { NextResponse } from "next/server";

import { clearFirebaseSessionCookie } from "@/lib/firebase/session";

function isSameOriginRequest(request: Request) {
  const requestOrigin = request.headers.get("origin");

  if (!requestOrigin) {
    return true;
  }

  return requestOrigin === new URL(request.url).origin;
}

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

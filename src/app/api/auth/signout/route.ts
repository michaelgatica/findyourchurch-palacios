import { NextResponse } from "next/server";

import { clearFirebaseSessionCookie } from "@/lib/firebase/session";

export async function DELETE() {
  await clearFirebaseSessionCookie();

  return NextResponse.json({
    success: true,
  });
}

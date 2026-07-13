import { NextResponse } from "next/server";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { downloadManagedRegistrationExport } from "@/lib/services/registration-export-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ exportId: string }> }) {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();
  if (!authenticatedUser?.profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { exportId } = await context.params;
    const { record, buffer } = await downloadManagedRegistrationExport({ exportId, actorUserId: authenticatedUser.profile.id });
    const responseBody = new Uint8Array(buffer.byteLength);
    responseBody.set(buffer);
    return new NextResponse(responseBody.buffer, {
      headers: {
        "Content-Type": record.contentType,
        "Content-Disposition": `attachment; filename="${record.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to download export." }, { status: 403 });
  }
}

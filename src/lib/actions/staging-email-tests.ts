"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { assertAdminProfile } from "@/lib/services/platform-event-admin-service";
import {
  sendStagingEmailTestTemplate,
  stagingEmailTemplateDefinitions,
  type StagingEmailTemplateKey,
} from "@/lib/services/staging-email-test-service";

export async function sendStagingEmailTestAction(formData: FormData) {
  const actor = await getServerAuthenticatedUserFromSessionCookie();
  assertAdminProfile(actor);

  const templateKey = String(formData.get("templateKey") ?? "");
  if (!stagingEmailTemplateDefinitions.some((template) => template.key === templateKey)) {
    throw new Error("Choose a valid staging email template.");
  }

  await sendStagingEmailTestTemplate({
    templateKey: templateKey as StagingEmailTemplateKey,
    actorUserId: actor!.firebaseUid,
  });
  revalidatePath("/admin/ops");
}

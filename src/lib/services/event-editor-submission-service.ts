import {
  createManagedEvent,
  updateManagedEvent,
} from "@/lib/services/event-management-service";
import { validateEventFormData } from "@/lib/validation/event-management";

function getRequiredString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required field: ${fieldName}.`);
  }

  return value.trim();
}

export function getEventEditorSubmissionEventId(formData: FormData) {
  const value = formData.get("eventId");
  return typeof value === "string" ? value.trim() : "";
}

export async function saveEventEditorSubmission(input: {
  formData: FormData;
  actorUserId: string;
}) {
  const eventId = getEventEditorSubmissionEventId(input.formData);
  const intent = getRequiredString(input.formData, "intent");
  const churchId = getRequiredString(input.formData, "churchId");
  const validatedInput = await validateEventFormData(input.formData);
  const publishNow = intent === "publish";
  const savedEvent = eventId
    ? await updateManagedEvent({
        eventId,
        churchId,
        actorUserId: input.actorUserId,
        validatedInput,
        publishNow,
      })
    : await createManagedEvent({
        churchId,
        actorUserId: input.actorUserId,
        validatedInput,
        publishNow,
      });

  return { event: savedEvent, publishNow };
}

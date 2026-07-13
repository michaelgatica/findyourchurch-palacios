import { randomUUID } from "crypto";

import { getRegistrationPreset } from "@/lib/data/registration-presets";
import { createSchemaFingerprint } from "@/lib/registration-utils";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  activateRegistrationFormVersion,
  getRegistrationConfiguration,
  getRegistrationFormVersion,
  listRegistrationFormVersions,
  saveRegistrationConfiguration,
  saveRegistrationFormVersion,
} from "@/lib/repositories/firebase-registration-repository";
import {
  getEventByIdFromFirebase,
  syncPublicEventFromFirebase,
  updateEventInFirebase,
} from "@/lib/repositories/firebase-event-repository";
import { requireChurchEventManagementAccess } from "@/lib/services/representative-access-service";
import { scheduleRegistrationJobs } from "@/lib/services/registration-job-service";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationFormSection,
  RegistrationFormVersionRecord,
} from "@/lib/types/registrations";
import {
  getDefaultRegistrationConfiguration,
  validateRegistrationConfiguration,
  validateRegistrationFormSections,
} from "@/lib/validation/registration";
import { validateExternalRegistrationUrl } from "@/lib/validation/external-registration-url";

async function requireEventRegistrationAccess(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireChurchEventManagementAccess({
    churchId: input.churchId,
    userId: input.actorUserId,
  });
  const event = await getEventByIdFromFirebase(input.eventId);

  if (!event || event.churchId !== input.churchId) {
    throw new Error("The event does not belong to this church.");
  }

  return { ...access, event };
}

function cloneSectionsWithStableIds(sections: RegistrationFormSection[]) {
  return sections.map((section, sectionIndex) => ({
    ...section,
    id: section.id || `section-${randomUUID()}`,
    displayOrder: sectionIndex,
    fields: section.fields.map((field, fieldIndex) => ({
      ...field,
      id: field.id || `field-${randomUUID()}`,
      displayOrder: fieldIndex,
      options: field.options.map((option) => ({
        ...option,
        id: option.id || `option-${randomUUID()}`,
      })),
      participantFields: field.participantFields?.map((participantField, participantIndex) => ({
        ...participantField,
        id: participantField.id || `participant-${randomUUID()}`,
        displayOrder: participantIndex,
      })),
    })),
  }));
}

export async function getEventRegistrationPortalData(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireEventRegistrationAccess(input);
  const [configuration, formVersions] = await Promise.all([
    getRegistrationConfiguration(input.eventId),
    listRegistrationFormVersions(input.eventId),
  ]);
  const resolvedConfiguration = configuration ?? getDefaultRegistrationConfiguration({
    eventId: input.eventId,
    churchId: input.churchId,
    mode: access.event.registration.mode,
    actorUserId: input.actorUserId,
    opensAt: access.event.registration.opensAt,
    closesAt: access.event.registration.closesAt,
    capacity: access.event.registration.capacity,
  });
  const activeForm = resolvedConfiguration.activeFormVersionId
    ? formVersions.find((version) => version.id === resolvedConfiguration.activeFormVersionId) ?? null
    : null;
  const draftForm = resolvedConfiguration.draftFormVersionId
    ? formVersions.find((version) => version.id === resolvedConfiguration.draftFormVersionId) ?? null
    : null;

  return {
    ...access,
    configuration: resolvedConfiguration,
    formVersions,
    activeForm,
    draftForm,
  };
}

export async function saveEventRegistrationSetup(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  configurationInput: unknown;
  sectionsInput?: unknown;
  formTitle?: string;
  presetId?: string | null;
  activate: boolean;
}) {
  const access = await requireEventRegistrationAccess(input);
  const existingConfiguration = await getRegistrationConfiguration(input.eventId);
  const baseConfiguration = existingConfiguration ?? getDefaultRegistrationConfiguration({
    eventId: input.eventId,
    churchId: input.churchId,
    mode: access.event.registration.mode,
    actorUserId: input.actorUserId,
    opensAt: access.event.registration.opensAt,
    closesAt: access.event.registration.closesAt,
    capacity: access.event.registration.capacity,
  });
  const configurationValues = validateRegistrationConfiguration(
    input.configurationInput,
    access.event,
  );
  if (configurationValues.mode === "google_forms" || configurationValues.mode === "external") {
    validateExternalRegistrationUrl(
      access.event.registration.externalRegistrationUrl,
      configurationValues.mode,
    );
  }
  const now = new Date().toISOString();
  let nextConfiguration: EventRegistrationConfigurationRecord = {
    ...baseConfiguration,
    ...configurationValues,
    eventId: access.event.id,
    churchId: access.event.churchId,
    updatedAt: now,
    updatedByUserId: input.actorUserId,
  };
  let savedForm: RegistrationFormVersionRecord | null = null;

  if (configurationValues.mode === "simple_rsvp" || configurationValues.mode === "internal_custom") {
    const preset = input.presetId ? getRegistrationPreset(input.presetId) : null;
    const sections = validateRegistrationFormSections(
      input.sectionsInput ?? preset?.sections,
    );
    const normalizedSections = cloneSectionsWithStableIds(sections);
    const fingerprint = createSchemaFingerprint(normalizedSections);
    const existingVersions = await listRegistrationFormVersions(input.eventId);
    const latestVersion = existingVersions[0] ?? null;
    const existingMatchingVersion = existingVersions.find(
      (version) =>
        version.schemaFingerprint === fingerprint &&
        version.status !== "retired" &&
        (input.activate || version.status === "draft"),
    );

    if (existingMatchingVersion) {
      savedForm = existingMatchingVersion;
    } else {
      savedForm = {
        id: randomUUID(),
        eventId: input.eventId,
        churchId: input.churchId,
        version: (latestVersion?.version ?? 0) + 1,
        status: input.activate ? "active" : "draft",
        title: input.formTitle?.trim() || `${access.event.title} registration`,
        presetId: input.presetId ?? null,
        sections: normalizedSections,
        schemaFingerprint: fingerprint,
        createdByUserId: input.actorUserId,
        createdAt: now,
        activatedAt: input.activate ? now : null,
        retiredAt: null,
      };
    }

    if (input.activate) {
      savedForm = {
        ...savedForm,
        status: "active",
        activatedAt: savedForm.activatedAt ?? now,
      };
      nextConfiguration = {
        ...nextConfiguration,
        activeFormVersionId: savedForm.id,
        draftFormVersionId: null,
      };
      await activateRegistrationFormVersion({
        configuration: nextConfiguration,
        formVersion: savedForm,
        previousActiveFormVersionId: existingConfiguration?.activeFormVersionId,
      });
    } else {
      nextConfiguration = {
        ...nextConfiguration,
        draftFormVersionId: savedForm.id,
      };
      await saveRegistrationFormVersion(savedForm);
      await saveRegistrationConfiguration(nextConfiguration);
    }
  } else {
    nextConfiguration = {
      ...nextConfiguration,
      activeFormVersionId: null,
      draftFormVersionId: null,
    };
    await saveRegistrationConfiguration(nextConfiguration);
  }

  const updatedEvent = await updateEventInFirebase(access.event.id, {
    registration: {
      ...access.event.registration,
      mode: nextConfiguration.mode,
      opensAt: nextConfiguration.opensAt ?? null,
      closesAt: nextConfiguration.closesAt ?? null,
      capacity: nextConfiguration.showCapacityStatus ? nextConfiguration.capacity ?? null : null,
      waitlistEnabled: nextConfiguration.waitlistEnabled,
      setupEnabled:
        nextConfiguration.mode === "none" ||
        ((nextConfiguration.mode === "google_forms" || nextConfiguration.mode === "external") &&
          Boolean(access.event.registration.externalRegistrationUrl)) ||
        Boolean(nextConfiguration.activeFormVersionId),
    },
    lastEditedByUserId: input.actorUserId,
    lastEditedByName: access.profile.name,
  });
  await syncPublicEventFromFirebase(updatedEvent);
  await scheduleRegistrationJobs({
    eventId: updatedEvent.id,
    churchId: updatedEvent.churchId,
    actorUserId: input.actorUserId,
    configuration: nextConfiguration,
    eventStartsAt: updatedEvent.startsAt,
    eventEndsAt: updatedEvent.endsAt,
  });

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: input.eventId,
    action: input.activate ? "registration_form_activated" : "registration_setup_saved",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: {
      registrationMode: nextConfiguration.mode,
      formVersionId: savedForm?.id ?? null,
      formVersion: savedForm?.version ?? null,
    },
    note: input.activate ? "Registration form version activated." : "Registration setup saved.",
  });

  return { configuration: nextConfiguration, form: savedForm };
}

export async function duplicateRegistrationFormFromEvent(input: {
  sourceEventId: string;
  targetEventId: string;
  churchId: string;
  actorUserId: string;
}) {
  await requireEventRegistrationAccess({
    eventId: input.sourceEventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });
  await requireEventRegistrationAccess({
    eventId: input.targetEventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });
  const sourceConfiguration = await getRegistrationConfiguration(input.sourceEventId);
  const sourceForm = sourceConfiguration?.activeFormVersionId
    ? await getRegistrationFormVersion(sourceConfiguration.activeFormVersionId)
    : null;

  if (!sourceForm) {
    throw new Error("The selected event does not have an active internal registration form.");
  }

  return saveEventRegistrationSetup({
    eventId: input.targetEventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
    configurationInput: {
      ...sourceConfiguration,
      mode: "internal_custom",
    },
    sectionsInput: sourceForm.sections,
    formTitle: `${sourceForm.title} copy`,
    presetId: sourceForm.presetId,
    activate: false,
  });
}

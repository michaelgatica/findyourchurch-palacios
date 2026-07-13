import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import type { ChurchRecord } from "@/lib/types/directory";
import type { EventRecord } from "@/lib/types/events";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationFormSection,
  RegistrationFormVersionRecord,
  RegistrationRecord,
} from "@/lib/types/registrations";

process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "demo-find-your-church";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT ?? "demo-find-your-church";
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8180";
process.env.EMAIL_PROVIDER = "console";
process.env.REGISTRATION_TOKEN_SECRET = "emulator-only-registration-secret";

const now = "2030-01-01T00:00:00.000Z";
const eventStart = "2030-10-10T15:00:00.000Z";
const eventEnd = "2030-10-10T18:00:00.000Z";

function createFixtureChurch(overrides: Partial<ChurchRecord>): ChurchRecord {
  return {
    id: "fixture-church",
    slug: "fixture-church",
    name: "Fixture Church",
    customShareSlug: null,
    status: "published",
    cityId: "tx-palacios",
    countyId: "tx-matagorda",
    stateId: "tx",
    address: {
      line1: "100 Main Street",
      line2: "",
      city: "Palacios",
      stateCode: "TX",
      postalCode: "77465",
      countryCode: "US",
      latitude: null,
      longitude: null,
    },
    mailingAddress: null,
    phone: "",
    email: "",
    website: "",
    socialLinks: {},
    photos: [],
    logoSrc: null,
    denomination: "Non-denominational",
    specificAffiliation: "",
    clergyLabel: "Pastor",
    primaryClergyName: "Fixture Pastor",
    additionalLeaders: [],
    description: "A fixture church used only for local registration emulator testing.",
    statementOfFaith: "",
    serviceTimes: [],
    ministryTags: [],
    worshipStyle: "Contemporary",
    languages: ["English"],
    features: {
      childrenMinistry: false,
      youthMinistry: false,
      nurseryCare: false,
      spanishService: false,
      livestream: false,
      wheelchairAccessible: false,
    },
    accessibilityDetails: "",
    visitorParkingDetails: "",
    firstTimeVisitorNotes: "",
    livestreamDetails: "",
    onlineGivingUrl: "",
    lastVerifiedAt: null,
    primaryRepresentativeId: null,
    autoPublishUpdates: false,
    isSeedContent: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function eventRecord(id: string, church: ChurchRecord): EventRecord {
  return {
    id,
    churchId: church.id,
    churchName: church.name,
    churchSlug: church.slug,
    churchRoutePath: `/tx/palacios/${church.slug}`,
    createdByUserId: "rep-a",
    createdByName: "Representative A",
    lastEditedByUserId: "rep-a",
    lastEditedByName: "Representative A",
    title: `Registration test ${id}`,
    slug: `registration-test-${id}`,
    summary: "Emulator-only registration integration test.",
    description: "This event exists only inside the local Firebase emulator.",
    primaryType: "Community Event",
    audienceTags: ["All Ages"],
    customTags: [],
    status: "published",
    visibility: "public",
    isFeatured: false,
    flyerImage: null,
    additionalImages: [],
    startsAt: eventStart,
    endsAt: eventEnd,
    allDay: false,
    timeZone: "America/Chicago",
    isRecurring: false,
    recurrenceRule: null,
    recurrenceExceptions: [],
    locationMode: "in_person",
    venueName: church.name,
    address: church.address,
    onlineUrl: null,
    mapUrl: null,
    hostMinistry: "Community Ministry",
    coHostDescription: null,
    contactName: "Event Contact",
    contactPhone: null,
    contactEmail: null,
    languages: ["English"],
    accessibilityDetails: null,
    childcareProvided: false,
    mealProvided: false,
    mealDetails: null,
    costStatus: "free",
    costDetails: null,
    informationUrl: null,
    additionalInstructions: null,
    registration: {
      mode: "internal_custom",
      opensAt: null,
      closesAt: null,
      capacity: 10,
      waitlistEnabled: false,
      externalRegistrationUrl: null,
      externalRegistrationLabel: null,
      setupEnabled: true,
    },
    cancellationMessage: null,
    createdAt: now,
    publishedAt: now,
    updatedAt: now,
    cancelledAt: null,
    archivedAt: null,
    wasPublished: true,
  };
}

function formSections(label = "Contact name"): RegistrationFormSection[] {
  return [{
    id: "section-contact",
    title: "Registration",
    displayOrder: 0,
    fields: [
      {
        id: "contact_name",
        type: "full_name",
        label,
        required: true,
        options: [],
        minValue: null,
        maxValue: null,
        minSelections: null,
        maxSelections: null,
        minLength: 2,
        maxLength: 120,
        defaultValue: null,
        displayOrder: 0,
        includeInExports: true,
        sensitiveClassification: "standard_contact",
        condition: null,
      },
      {
        id: "attendee_count",
        type: "number",
        label: "Number attending",
        required: true,
        options: [],
        minValue: 1,
        maxValue: 10,
        minSelections: null,
        maxSelections: null,
        minLength: null,
        maxLength: null,
        defaultValue: 1,
        displayOrder: 1,
        includeInExports: true,
        sensitiveClassification: "none",
        condition: null,
      },
    ],
  }];
}

async function run() {
  const [
    { getFirebaseAdminFirestore },
    { mapChurchRecordToChurchDocument },
    { createSchemaFingerprint, createRegistrationSearchPrefixes, hashRegistrationSecret, normalizeRegistrationSearchText },
    { getDefaultRegistrationConfiguration },
    registrationRepository,
    { requireChurchEventManagementAccess },
    managementService,
    { saveEventRegistrationSetup },
    { createRegistrationExport },
    { listAuditLogsForEntity },
  ] = await Promise.all([
    import("@/lib/firebase/admin"),
    import("@/lib/firebase/firestore"),
    import("@/lib/registration-utils"),
    import("@/lib/validation/registration"),
    import("@/lib/repositories/firebase-registration-repository"),
    import("@/lib/services/representative-access-service"),
    import("@/lib/services/registration-management-service"),
    import("@/lib/services/registration-form-service"),
    import("@/lib/services/registration-export-service"),
    import("@/lib/repositories/firebase-audit-log-repository"),
  ]);
  const firestore = getFirebaseAdminFirestore();
  assert.ok(firestore, "The Firestore emulator Admin client should initialize without credentials.");

  const churchA = createFixtureChurch({ id: "church-a", slug: "church-a", name: "Church A" });
  const churchB = createFixtureChurch({ id: "church-b", slug: "church-b", name: "Church B" });
  const users = [
    { id: "rep-a", firebaseUid: "rep-a", name: "Representative A", email: "rep-a@example.test", role: "church_primary", createdAt: now, updatedAt: now },
    { id: "rep-b", firebaseUid: "rep-b", name: "Representative B", email: "rep-b@example.test", role: "church_primary", createdAt: now, updatedAt: now },
    { id: "suspended-rep", firebaseUid: "suspended-rep", name: "Suspended Representative", email: "suspended@example.test", role: "church_editor", createdAt: now, updatedAt: now },
    { id: "unassigned-user", firebaseUid: "unassigned-user", name: "Unassigned User", email: "unassigned@example.test", role: "pending_user", createdAt: now, updatedAt: now },
    { id: "platform-admin", firebaseUid: "platform-admin", name: "Platform Admin", email: "admin@example.test", role: "admin", createdAt: now, updatedAt: now },
  ] as const;
  await Promise.all([
    firestore!.collection("churches").doc(churchA.id).set(mapChurchRecordToChurchDocument(churchA)),
    firestore!.collection("churches").doc(churchB.id).set(mapChurchRecordToChurchDocument(churchB)),
    ...users.map((user) => firestore!.collection("users").doc(user.id).set(user)),
    firestore!.collection("churchRepresentatives").doc("representative-a").set({ id: "representative-a", churchId: churchA.id, userId: "rep-a", name: "Representative A", email: "rep-a@example.test", roleTitle: "Pastor", permissionRole: "primary_owner", status: "active", createdAt: now, updatedAt: now }),
    firestore!.collection("churchRepresentatives").doc("representative-b").set({ id: "representative-b", churchId: churchB.id, userId: "rep-b", name: "Representative B", email: "rep-b@example.test", roleTitle: "Pastor", permissionRole: "primary_owner", status: "active", createdAt: now, updatedAt: now }),
    firestore!.collection("churchRepresentatives").doc("representative-suspended").set({ id: "representative-suspended", churchId: churchA.id, userId: "suspended-rep", name: "Suspended Representative", email: "suspended@example.test", roleTitle: "Event volunteer", permissionRole: "editor", status: "suspended", createdAt: now, updatedAt: now }),
  ]);

  await requireChurchEventManagementAccess({ userId: "rep-a", churchId: churchA.id });
  await requireChurchEventManagementAccess({ userId: "platform-admin", churchId: churchB.id });
  await assert.rejects(
    requireChurchEventManagementAccess({ userId: "rep-a", churchId: churchB.id }),
    /do not have access/i,
  );
  await assert.rejects(
    requireChurchEventManagementAccess({ userId: "suspended-rep", churchId: churchA.id }),
    /do not have access/i,
  );
  await assert.rejects(
    requireChurchEventManagementAccess({ userId: "unassigned-user", churchId: churchA.id }),
    /do not have access/i,
  );

  async function setupEvent(id: string, capacity: number, waitlistEnabled: boolean, waitlistCapacity: number | null) {
    const event = eventRecord(id, churchA);
    event.registration.capacity = capacity;
    event.registration.waitlistEnabled = waitlistEnabled;
    const sections = formSections();
    const formVersion: RegistrationFormVersionRecord = {
      id: `${id}-form-v1`,
      eventId: id,
      churchId: churchA.id,
      version: 1,
      status: "active",
      title: `${id} registration`,
      sections,
      schemaFingerprint: createSchemaFingerprint(sections),
      createdByUserId: "rep-a",
      createdAt: now,
      activatedAt: now,
      retiredAt: null,
    };
    const configuration: EventRegistrationConfigurationRecord = {
      ...getDefaultRegistrationConfiguration({ eventId: id, churchId: churchA.id, mode: "internal_custom", actorUserId: "rep-a", capacity, now }),
      activeFormVersionId: formVersion.id,
      waitlistEnabled,
      waitlistCapacity,
      automaticWaitlistPromotion: true,
    };
    await Promise.all([
      firestore!.collection("events").doc(id).set(event),
      firestore!.collection("eventFormVersions").doc(formVersion.id).set(formVersion),
      firestore!.collection("eventRegistrationConfigurations").doc(id).set(configuration),
    ]);
    return { event, formVersion, configuration };
  }

  function registrationInput(input: {
    eventId: string;
    formVersion: RegistrationFormVersionRecord;
    configuration: EventRegistrationConfigurationRecord;
    suffix: string;
    attendeeCount?: number;
  }) {
    const registrationId = `${input.eventId}-${input.suffix}`;
    const contactName = `Registrant ${input.suffix}`;
    const registration: RegistrationRecord = {
      id: registrationId,
      eventId: input.eventId,
      churchId: churchA.id,
      formVersionId: input.formVersion.id,
      formVersion: input.formVersion.version,
      formTitle: input.formVersion.title,
      confirmationNumber: `FYC-${hashRegistrationSecret(registrationId).slice(0, 12).toUpperCase()}`,
      status: "confirmed",
      contactName,
      contactNameNormalized: normalizeRegistrationSearchText(contactName),
      contactSearchPrefixes: createRegistrationSearchPrefixes(contactName),
      contactEmail: null,
      contactPhone: null,
      attendeeCount: input.attendeeCount ?? 1,
      capacityUnits: input.attendeeCount ?? 1,
      answers: { contact_name: contactName, attendee_count: input.attendeeCount ?? 1 },
      answerLabels: { contact_name: "Contact name", attendee_count: "Number attending" },
      privateOrganizerNotes: null,
      source: "public",
      idempotencyKeyHash: hashRegistrationSecret(`idempotency:${registrationId}`),
      submittedAt: new Date(Date.parse(now) + Number.parseInt(input.suffix.replace(/\D/g, "") || "0", 10) * 1000).toISOString(),
      updatedAt: now,
      cancelledAt: null,
      checkedInAt: null,
      attendedAt: null,
      noShowAt: null,
      lastEditedByUserId: null,
    };
    const tokenHash = hashRegistrationSecret(`token:${registrationId}`);
    return {
      registration,
      accessToken: { id: tokenHash, registrationId, eventId: input.eventId, churchId: churchA.id, tokenHash, expiresAt: eventEnd, createdAt: now, lastUsedAt: null, revokedAt: null },
      idempotencyDocumentId: hashRegistrationSecret(`idem:${registrationId}`),
      duplicateFingerprintDocumentId: hashRegistrationSecret(`duplicate:${registrationId}`),
      rateLimitDocumentId: hashRegistrationSecret(`rate:${registrationId}`),
      configuration: input.configuration,
      formVersion: input.formVersion,
      now,
      rateLimitWindowMs: 60_000,
      rateLimitMaximum: 10,
      auditId: randomUUID(),
    };
  }

  const duplicateEvent = await setupEvent("event-duplicate", 10, false, null);
  const duplicateInput = registrationInput({ ...duplicateEvent, eventId: duplicateEvent.event.id, suffix: "one" });
  const firstSubmission = await registrationRepository.createRegistrationAtomically(duplicateInput);
  const duplicateSubmission = await registrationRepository.createRegistrationAtomically(duplicateInput);
  assert.equal(firstSubmission.duplicate, false);
  assert.equal(duplicateSubmission.duplicate, true);
  assert.equal((await registrationRepository.getRegistrationCounters(duplicateEvent.event.id)).submitted, 1);

  const capacityEvent = await setupEvent("event-capacity", 1, false, null);
  const simultaneous = await Promise.allSettled([
    registrationRepository.createRegistrationAtomically(registrationInput({ ...capacityEvent, eventId: capacityEvent.event.id, suffix: "one" })),
    registrationRepository.createRegistrationAtomically(registrationInput({ ...capacityEvent, eventId: capacityEvent.event.id, suffix: "two" })),
  ]);
  assert.equal(simultaneous.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(simultaneous.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await registrationRepository.getRegistrationCounters(capacityEvent.event.id)).confirmed, 1);

  const waitlistEvent = await setupEvent("event-waitlist", 1, true, 1);
  const confirmed = await registrationRepository.createRegistrationAtomically(registrationInput({ ...waitlistEvent, eventId: waitlistEvent.event.id, suffix: "one" }));
  const waitlisted = await registrationRepository.createRegistrationAtomically(registrationInput({ ...waitlistEvent, eventId: waitlistEvent.event.id, suffix: "two" }));
  assert.equal(confirmed.registration.status, "confirmed");
  assert.equal(waitlisted.registration.status, "waitlisted");
  await assert.rejects(
    registrationRepository.createRegistrationAtomically(registrationInput({ ...waitlistEvent, eventId: waitlistEvent.event.id, suffix: "three" })),
    /waitlist are full/i,
  );
  const promoted = await registrationRepository.promoteWaitlistedRegistrationAtomically({
    registrationId: waitlisted.registration.id,
    eventId: waitlistEvent.event.id,
    churchId: churchA.id,
    actorUserId: "rep-a",
  }).catch((error) => error as Error);
  assert.ok(promoted instanceof Error, "Promotion must fail while confirmed capacity remains occupied.");
  await managementService.changeManagedRegistrationStatus({
    registrationId: confirmed.registration.id,
    eventId: waitlistEvent.event.id,
    churchId: churchA.id,
    actorUserId: "rep-a",
    nextStatus: "cancelled",
  });
  assert.equal(
    (await registrationRepository.getRegistrationById(waitlisted.registration.id))?.status,
    "confirmed",
  );

  await assert.rejects(
    managementService.listManagedRegistrations({ eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-b" }),
    /do not have access/i,
  );
  await assert.rejects(
    createRegistrationExport({ eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-b", format: "pdf", reportType: "roster", selectedFieldIds: [], includeSensitive: false }),
    /do not have access/i,
  );

  const manual = await managementService.createManualRegistration({
    eventId: duplicateEvent.event.id,
    churchId: churchA.id,
    actorUserId: "rep-a",
    answerPayload: JSON.stringify({ contact_name: "Manual Registrant", attendee_count: 1 }),
  });
  await managementService.changeManagedRegistrationStatus({ registrationId: manual.id, eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", nextStatus: "checked_in" });
  await managementService.changeManagedRegistrationStatus({ registrationId: manual.id, eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", nextStatus: "attended" });
  assert.equal((await registrationRepository.getRegistrationCounters(duplicateEvent.event.id)).attended, 1);

  await managementService.changeManagedRegistrationStatus({ registrationId: firstSubmission.registration.id, eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", nextStatus: "cancelled" });
  await managementService.deleteManagedRegistrationData({ registrationId: firstSubmission.registration.id, eventId: duplicateEvent.event.id, churchId: churchA.id, actorUserId: "rep-a" });
  assert.equal(await registrationRepository.getRegistrationById(firstSubmission.registration.id), null);

  const pageEvent = await setupEvent("event-pagination", 100, false, null);
  for (let index = 1; index <= 30; index += 1) {
    await registrationRepository.createRegistrationAtomically(registrationInput({ ...pageEvent, eventId: pageEvent.event.id, suffix: String(index).padStart(2, "0") }));
  }
  const firstPage = await managementService.listManagedRegistrations({ eventId: pageEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", sortBy: "contactNameNormalized", direction: "asc" });
  assert.equal(firstPage.registrations.length, 25);
  assert.ok(firstPage.nextCursor);
  const secondPage = await managementService.listManagedRegistrations({ eventId: pageEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", cursor: firstPage.nextCursor, sortBy: "contactNameNormalized", direction: "asc" });
  assert.equal(secondPage.registrations.length, 5);
  const searchPage = await managementService.listManagedRegistrations({ eventId: pageEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", search: "Registrant 30" });
  assert.equal(searchPage.registrations.length, 1);
  const confirmationSearch = await managementService.listManagedRegistrations({ eventId: pageEvent.event.id, churchId: churchA.id, actorUserId: "rep-a", search: searchPage.registrations[0]!.confirmationNumber });
  assert.equal(confirmationSearch.registrations[0]?.id, searchPage.registrations[0]?.id);

  const activeBeforeEdit = await registrationRepository.getRegistrationFormVersion(duplicateEvent.formVersion.id);
  assert.equal(activeBeforeEdit?.status, "active");
  await saveEventRegistrationSetup({
    eventId: duplicateEvent.event.id,
    churchId: churchA.id,
    actorUserId: "rep-a",
    configurationInput: { ...duplicateEvent.configuration, scheduledReportFormats: ["pdf"] },
    sectionsInput: formSections("Updated contact name"),
    formTitle: "Updated registration",
    activate: true,
  });
  const configurationAfterEdit = await registrationRepository.getRegistrationConfiguration(duplicateEvent.event.id);
  assert.notEqual(configurationAfterEdit?.activeFormVersionId, duplicateEvent.formVersion.id);
  assert.equal((await registrationRepository.getRegistrationFormVersion(duplicateEvent.formVersion.id))?.status, "retired");
  assert.equal((await registrationRepository.getRegistrationById(manual.id))?.formVersionId, duplicateEvent.formVersion.id);

  const expiredHash = hashRegistrationSecret("expired-token");
  await registrationRepository.saveRegistrationAccessToken({ id: expiredHash, registrationId: manual.id, eventId: duplicateEvent.event.id, churchId: churchA.id, tokenHash: expiredHash, createdAt: now, expiresAt: "2020-01-01T00:00:01.000Z", lastUsedAt: null, revokedAt: null });
  assert.equal(await registrationRepository.getRegistrationByTokenHash(expiredHash), null);

  const registrationAudits = await listAuditLogsForEntity("eventRegistration", manual.id);
  assert.ok(registrationAudits.some((entry) => entry.action === "registration_checked_in"));
  assert.ok(registrationAudits.some((entry) => entry.action === "registration_attended"));
  assert.equal(registrationAudits.some((entry) => JSON.stringify(entry).includes("Manual Registrant")), false);

  console.log(JSON.stringify({
    ok: true,
    suite: "registration-emulator",
    checks: {
      authorization: true,
      atomicCapacity: true,
      idempotency: true,
      waitlist: true,
      formVersioning: true,
      pagination: true,
      search: true,
      statusAndAudit: true,
      deletion: true,
      expiredToken: true,
    },
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

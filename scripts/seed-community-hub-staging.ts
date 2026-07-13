import { createHash } from "crypto";

import { assertSafeNonProductionTarget } from "@/lib/app-environment";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { createSlug, firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import type { ChurchDocument, ChurchRepresentativeRecord, AppUserRecord } from "@/lib/types/directory";
import type { EventRecord } from "@/lib/types/events";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationCounterRecord,
  RegistrationFormVersionRecord,
  RegistrationRecord,
} from "@/lib/types/registrations";
import {
  commitStagingRecordsWithOAuth,
  getStagingOAuthAuth,
  hasStagingOAuthAccessToken,
  verifyStagingOAuthTarget,
} from "./staging-oauth-rest";

const marker = "community-hub-staging-qa";
const idPrefix = "staging-qa";
const testEmailDomain = "staging.findyourchurch.test";

function hasArg(name: string) {
  return process.argv.includes(name);
}

function isoFromNow(days: number, hours = 0) {
  return new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSearchPrefixes(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return Array.from({ length: Math.min(normalized.length, 30) - 1 }, (_, index) =>
    normalized.slice(0, index + 2),
  );
}

function church(id: string, index: number): ChurchDocument {
  const name = `Staging Test Church ${index}`;
  const slug = createSlug(name);
  const now = isoFromNow(-30);
  return {
    id,
    slug,
    name,
    status: "published",
    listingVerificationStatus: "current",
    lastListingAcknowledgedAt: now,
    lastRepresentativeActivityAt: now,
    listingVerificationRequestedAt: null,
    listingVerificationGraceEndsAt: null,
    listingVerificationReminder7SentAt: null,
    listingVerificationReminder3SentAt: null,
    listingVerificationToken: null,
    archivedAt: null,
    archivedReason: null,
    logoUrl: null,
    photoUrls: [],
    photoGallery: [],
    address: {
      line1: `${100 + index} Fictional Ministry Way`,
      city: "Palacios",
      stateCode: "TX",
      postalCode: `7746${index}`,
      countyId: "matagorda-county",
      countryCode: "US",
      latitude: 28.708 + index / 100,
      longitude: -96.217 - index / 100,
    },
    mailingAddress: {
      line1: `PO Box ${900 + index}`,
      city: "Palacios",
      stateCode: "TX",
      postalCode: `7746${index}`,
      countryCode: "US",
      latitude: null,
      longitude: null,
    },
    city: "Palacios",
    county: "Matagorda County",
    state: "TX",
    zip: `7746${index}`,
    latitude: 28.708 + index / 100,
    longitude: -96.217 - index / 100,
    phone: `361555010${index}`,
    email: `church-${index}@${testEmailDomain}`,
    website: `https://example.org/staging-church-${index}`,
    socialLinks: {},
    pastorName: `Pastor Test ${index}`,
    additionalLeaders: [],
    denominationTradition: index === 1 ? "Non-denominational" : index === 2 ? "Baptist" : "Methodist",
    description: "Fictitious staging church used only for Community Ministry Hub QA.",
    worshipStyle: "Blended",
    serviceTimes: [{ id: "sunday-main", label: "Sunday Worship - 10:00 AM", dayLabel: "Sunday", startTime: "10:00", isPrimary: true }],
    languages: ["English"],
    ministries: ["Community", "Youth", "Prayer"],
    childrenMinistry: true,
    youthMinistry: true,
    nurseryCare: index !== 3,
    spanishService: index === 2,
    livestream: index === 1,
    wheelchairAccessible: true,
    accessibilityDetails: "Step-free entrance for staging QA.",
    visitorParking: "Fictitious visitor parking near main entrance.",
    firstTimeVisitorNotes: "This is not a real church listing.",
    primaryRepresentativeId: `${idPrefix}-rep-${index}`,
    autoPublishUpdates: false,
    lastVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

function user(id: string, role: AppUserRecord["role"], name: string): AppUserRecord {
  const now = isoFromNow(-20);
  return {
    id,
    firebaseUid: id,
    name,
    email: `${id}@${testEmailDomain}`,
    phone: "3615550199",
    role,
    createdAt: now,
    updatedAt: now,
  };
}

function representative(id: string, churchId: string, userId: string, roleTitle: string, permissionRole: ChurchRepresentativeRecord["permissionRole"]): ChurchRepresentativeRecord {
  const now = isoFromNow(-20);
  return {
    id,
    churchId,
    userId,
    name: `Staging ${roleTitle}`,
    email: `${userId}@${testEmailDomain}`,
    phone: "3615550177",
    roleTitle,
    permissionRole,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function baseEvent(input: {
  id: string;
  churchId: string;
  churchName: string;
  title: string;
  status: EventRecord["status"];
  registrationMode: EventRecord["registration"]["mode"];
  startsAt: string;
  endsAt?: string;
  visibility?: EventRecord["visibility"];
  wasPublished?: boolean;
  flyer?: boolean;
  capacity?: number | null;
  waitlistEnabled?: boolean;
  externalUrl?: string | null;
}): EventRecord {
  const publishedAt = input.wasPublished === false || input.status === "draft" || input.status === "pending_review"
    ? null
    : isoFromNow(-5);
  const slug = createSlug(input.title);
  return {
    id: input.id,
    churchId: input.churchId,
    churchName: input.churchName,
    churchSlug: createSlug(input.churchName),
    churchRoutePath: `/tx/palacios/${createSlug(input.churchName)}`,
    createdByUserId: `${idPrefix}-rep-user-1`,
    createdByName: "Staging Primary Owner",
    lastEditedByUserId: `${idPrefix}-rep-user-1`,
    lastEditedByName: "Staging Primary Owner",
    title: input.title,
    slug,
    summary: "Fictitious staging event for Community Ministry Hub verification.",
    description: "This staging event is intentionally fictitious and exists only for workflow, accessibility, registration, export, and moderation QA.",
    primaryType: "community",
    audienceTags: ["families", "adults"],
    customTags: ["Staging QA"],
    status: input.status,
    visibility: input.visibility ?? (input.status === "unlisted" ? "unlisted" : "public"),
    isFeatured: input.status === "published",
    editingLocked: false,
    editingLockedAt: null,
    editingLockedByUserId: null,
    moderationNote: null,
    flyerImage: input.flyer
      ? {
          id: `${input.id}-flyer`,
          src: "https://placehold.co/1200x675/png?text=Staging+Event",
          alt: "Fictitious staging event flyer placeholder",
          sortOrder: 1,
          storagePath: `churches/${input.churchId}/events/${input.id}/flyer/staging.png`,
          downloadUrl: "https://placehold.co/1200x675/png?text=Staging+Event",
          mimeType: "image/png",
          size: 2048,
          width: 1200,
          height: 675,
        }
      : null,
    additionalImages: [],
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? isoFromNow(8, 2),
    allDay: false,
    timeZone: "America/Chicago",
    isRecurring: false,
    recurrenceRule: null,
    recurrenceExceptions: [],
    locationMode: "in_person",
    venueName: "Fictitious Fellowship Hall",
    address: {
      line1: "123 Staging Event Lane",
      city: "Palacios",
      stateCode: "TX",
      postalCode: "77465",
      countyId: "matagorda-county",
      countryCode: "US",
      latitude: 28.708,
      longitude: -96.217,
    },
    onlineUrl: null,
    mapUrl: "https://maps.google.com/?q=Palacios%2C%20TX",
    hostMinistry: "Staging Ministry Team",
    coHostDescription: null,
    contactName: "Staging Event Contact",
    contactPhone: "3615550188",
    contactEmail: `events@${testEmailDomain}`,
    languages: ["English"],
    accessibilityDetails: "Step-free entrance and accessible seating are available in this fictitious record.",
    childcareProvided: true,
    mealProvided: false,
    mealDetails: null,
    costStatus: "free",
    costDetails: null,
    informationUrl: input.externalUrl ?? null,
    additionalInstructions: "Use this event only for staging QA.",
    registration: {
      mode: input.registrationMode,
      opensAt: isoFromNow(-2),
      closesAt: isoFromNow(7),
      capacity: input.capacity ?? null,
      waitlistEnabled: input.waitlistEnabled ?? false,
      externalRegistrationUrl: input.externalUrl ?? null,
      externalRegistrationLabel: input.registrationMode === "google_forms" ? "Open Google Form" : "Open registration link",
      setupEnabled: input.registrationMode === "simple_rsvp" || input.registrationMode === "internal_custom",
    },
    cancellationMessage: input.status === "cancelled" ? "This fictitious staging event has been cancelled." : null,
    createdAt: isoFromNow(-10),
    publishedAt,
    updatedAt: isoFromNow(-1),
    cancelledAt: input.status === "cancelled" ? isoFromNow(-1) : null,
    archivedAt: input.status === "archived" ? isoFromNow(-1) : null,
    wasPublished: input.wasPublished ?? Boolean(publishedAt),
  };
}

function registrationConfiguration(event: EventRecord): EventRegistrationConfigurationRecord {
  const now = isoFromNow(-5);
  return {
    id: event.id,
    eventId: event.id,
    churchId: event.churchId,
    mode: event.registration.mode,
    activeFormVersionId: `${event.id}-form-v1`,
    draftFormVersionId: null,
    opensAt: event.registration.opensAt,
    closesAt: event.registration.closesAt,
    capacity: event.registration.capacity,
    capacityUnit: "attendees",
    maximumAttendeesPerRegistration: 8,
    waitlistEnabled: event.registration.waitlistEnabled,
    waitlistCapacity: event.registration.waitlistEnabled ? 20 : null,
    automaticWaitlistPromotion: true,
    allowRegistrantEditing: true,
    allowRegistrantCancellation: true,
    showCapacityStatus: true,
    confirmationEmailEnabled: true,
    reminderEmailEnabled: true,
    organizerNewRegistrationEmail: true,
    organizerDailyDigestEmail: true,
    registrationClosingReportEnabled: true,
    preEventReportEnabled: true,
    scheduledReportFormats: ["pdf", "xlsx"],
    successMessage: "Your fictitious staging registration was received.",
    closedMessage: "Registration is closed for this staging event.",
    waitlistMessage: "You have been added to the staging waitlist.",
    consentText: "I understand this is fictitious staging data.",
    retentionDays: 30,
    createdAt: now,
    updatedAt: now,
    updatedByUserId: `${idPrefix}-rep-user-1`,
  };
}

function formVersion(event: EventRecord): RegistrationFormVersionRecord {
  return {
    id: `${event.id}-form-v1`,
    eventId: event.id,
    churchId: event.churchId,
    version: 1,
    status: "active",
    title: `${event.title} Registration`,
    presetId: "staging_custom",
    schemaFingerprint: hash(`${event.id}-form-v1`),
    createdByUserId: `${idPrefix}-rep-user-1`,
    createdAt: isoFromNow(-5),
    activatedAt: isoFromNow(-4),
    retiredAt: null,
    sections: [
      {
        id: "contact",
        title: "Contact information",
        displayOrder: 1,
        fields: [
          { id: "full_name", type: "full_name", label: "Full name", required: true, options: [], displayOrder: 1, includeInExports: true, sensitiveClassification: "standard_contact" },
          { id: "email", type: "email", label: "Email", required: false, options: [], displayOrder: 2, includeInExports: true, sensitiveClassification: "standard_contact" },
          { id: "attendee_count", type: "number", label: "Number attending", required: true, options: [], minValue: 1, maxValue: 8, displayOrder: 3, includeInExports: true, sensitiveClassification: "none" },
        ],
      },
      {
        id: "participants",
        title: "Participants",
        displayOrder: 2,
        fields: [
          {
            id: "participants",
            type: "repeating_attendee_group",
            label: "Participant names",
            required: false,
            options: [],
            displayOrder: 1,
            includeInExports: true,
            sensitiveClassification: "none",
            participantFields: [
              { id: "participant_name", type: "short_text", label: "Participant name", required: true, options: [], displayOrder: 1, includeInExports: true, sensitiveClassification: "none" },
            ],
          },
        ],
      },
    ],
  };
}

function registration(event: EventRecord, index: number, status: RegistrationRecord["status"]): RegistrationRecord {
  const id = `${idPrefix}-registration-${event.id}-${index}`;
  const name = `Staging Registrant ${index}`;
  const submittedAt = isoFromNow(-1, -index);
  return {
    id,
    eventId: event.id,
    churchId: event.churchId,
    formVersionId: `${event.id}-form-v1`,
    formVersion: 1,
    formTitle: `${event.title} Registration`,
    confirmationNumber: `FYC-${hash(id).slice(0, 12).toUpperCase()}`,
    status,
    contactName: name,
    contactNameNormalized: name.toLowerCase(),
    contactSearchPrefixes: createSearchPrefixes(name),
    contactEmail: `registrant-${index}@${testEmailDomain}`,
    contactPhone: "3615550166",
    attendeeCount: index % 3 === 0 ? 3 : 1,
    capacityUnits: index % 3 === 0 ? 3 : 1,
    answers: {
      full_name: name,
      email: `registrant-${index}@${testEmailDomain}`,
      attendee_count: index % 3 === 0 ? 3 : 1,
      participants: [{ participant_name: `Staging Participant ${index}` }],
      formula_injection_probe: index === 1 ? "=1+1" : index === 2 ? "+not-a-formula" : index === 3 ? "-not-a-formula" : "@not-a-formula",
    },
    answerLabels: {
      full_name: "Full name",
      email: "Email",
      attendee_count: "Number attending",
      participants: "Participant names",
      formula_injection_probe: "Formula injection probe",
    },
    privateOrganizerNotes: null,
    source: "public",
    idempotencyKeyHash: hash(`${id}-idempotency`),
    submittedAt,
    updatedAt: submittedAt,
    cancelledAt: status === "cancelled" ? submittedAt : null,
    checkedInAt: status === "checked_in" || status === "attended" ? submittedAt : null,
    attendedAt: status === "attended" ? submittedAt : null,
    noShowAt: status === "no_show" ? submittedAt : null,
    lastEditedByUserId: null,
  };
}

async function commitBatches(records: Array<{ collection: string; id: string; data: unknown }>) {
  const markedRecords = records.map((record) => ({
    ...record,
    data: stripUndefinedDeep({ ...(record.data as Record<string, unknown>), stagingQaMarker: marker }),
  }));

  if (hasStagingOAuthAccessToken()) {
    await commitStagingRecordsWithOAuth(markedRecords);
    return;
  }

  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");

  for (let index = 0; index < markedRecords.length; index += 400) {
    const batch = firestore.batch();
    markedRecords.slice(index, index + 400).forEach((record) => {
      batch.set(
        firestore.collection(record.collection).doc(record.id),
        record.data,
      );
    });
    await batch.commit();
  }
}

async function upsertAuthUsers(users: AppUserRecord[], password: string) {
  const auth = await getStagingOAuthAuth() ?? getFirebaseAdminAuth();
  if (!auth) return { created: 0, skipped: users.length };

  let created = 0;
  let skipped = 0;
  for (const record of users) {
    try {
      await auth.getUser(record.firebaseUid);
      skipped += 1;
    } catch {
      await verifyStagingOAuthTarget();
      await auth.createUser({
        uid: record.firebaseUid,
        email: record.email,
        displayName: record.name,
        password,
        emailVerified: true,
        disabled: false,
      });
      created += 1;
    }
  }
  return { created, skipped };
}

async function main() {
  const dryRun = hasArg("--dry-run");
  const confirm = hasArg("--confirm");
  const large = hasArg("--large");

  if (!dryRun && !confirm) {
    throw new Error("Use --dry-run to preview or --confirm to seed staging data.");
  }

  const target = assertSafeNonProductionTarget("Community Hub staging seed");
  const password = process.env.STAGING_TEST_USER_PASSWORD;
  if (confirm && (!password || password.length < 12)) {
    throw new Error("Set STAGING_TEST_USER_PASSWORD to at least 12 characters before --confirm.");
  }

  const churches = [church(`${idPrefix}-church-a`, 1), church(`${idPrefix}-church-b`, 2), church(`${idPrefix}-church-c`, 3)];
  const users = [
    user(`${idPrefix}-admin`, "admin", "Staging Platform Admin"),
    user(`${idPrefix}-rep-user-1`, "church_primary", "Staging Church A Owner"),
    user(`${idPrefix}-rep-user-2`, "church_primary", "Staging Church B Owner"),
    user(`${idPrefix}-rep-user-3`, "church_primary", "Staging Church C Owner"),
    user(`${idPrefix}-event-manager`, "church_editor", "Staging Limited Event Manager"),
  ];
  const representatives = [
    representative(`${idPrefix}-rep-1`, churches[0].id, users[1].id, "Primary Owner", "primary_owner"),
    representative(`${idPrefix}-rep-2`, churches[1].id, users[2].id, "Primary Owner", "primary_owner"),
    representative(`${idPrefix}-rep-3`, churches[2].id, users[3].id, "Primary Owner", "primary_owner"),
    representative(`${idPrefix}-event-manager-rep`, churches[0].id, users[4].id, "Limited Event Manager", "editor"),
  ];

  const events = [
    baseEvent({ id: `${idPrefix}-event-draft`, churchId: churches[0].id, churchName: churches[0].name, title: "Staging Draft Community Meal", status: "draft", registrationMode: "none", startsAt: isoFromNow(9), wasPublished: false }),
    baseEvent({ id: `${idPrefix}-event-published`, churchId: churches[0].id, churchName: churches[0].name, title: "Staging Published Family Night", status: "published", registrationMode: "simple_rsvp", startsAt: isoFromNow(8), flyer: true, capacity: 20, waitlistEnabled: true }),
    baseEvent({ id: `${idPrefix}-event-unlisted`, churchId: churches[1].id, churchName: churches[1].name, title: "Staging Unlisted Volunteer Training", status: "unlisted", registrationMode: "internal_custom", startsAt: isoFromNow(10), visibility: "unlisted", capacity: 12 }),
    baseEvent({ id: `${idPrefix}-event-cancelled`, churchId: churches[1].id, churchName: churches[1].name, title: "Staging Cancelled Outreach", status: "cancelled", registrationMode: "none", startsAt: isoFromNow(6) }),
    baseEvent({ id: `${idPrefix}-event-full`, churchId: churches[2].id, churchName: churches[2].name, title: "Staging Full Capacity Workshop", status: "published", registrationMode: "internal_custom", startsAt: isoFromNow(11), capacity: 5, waitlistEnabled: true }),
    baseEvent({ id: `${idPrefix}-event-google`, churchId: churches[2].id, churchName: churches[2].name, title: "Staging Google Forms Signup", status: "published", registrationMode: "google_forms", startsAt: isoFromNow(12), externalUrl: "https://docs.google.com/forms/d/e/staging-form/viewform" }),
    baseEvent({ id: `${idPrefix}-event-external`, churchId: churches[0].id, churchName: churches[0].name, title: "Staging External Registration", status: "published", registrationMode: "external", startsAt: isoFromNow(13), externalUrl: "https://example.org/staging-registration" }),
  ];

  if (large) {
    for (let index = 0; index < 100; index += 1) {
      events.push(baseEvent({
        id: `${idPrefix}-load-event-${index + 1}`,
        churchId: churches[index % churches.length].id,
        churchName: churches[index % churches.length].name,
        title: `Staging Load Event ${index + 1}`,
        status: "published",
        registrationMode: index % 2 === 0 ? "simple_rsvp" : "internal_custom",
        startsAt: isoFromNow(14 + index),
        capacity: 1000,
      }));
    }
  }

  const configurableEvents = events.filter((event) => event.registration.mode === "simple_rsvp" || event.registration.mode === "internal_custom");
  const registrations = configurableEvents.flatMap((event) => {
    const statuses: RegistrationRecord["status"][] = ["confirmed", "waitlisted", "cancelled", "checked_in", "attended", "no_show"];
    const base = statuses.map((status, index) => registration(event, index + 1, status));
    if (large && event.id === `${idPrefix}-event-full`) {
      for (let index = 7; index <= 500; index += 1) {
        base.push(registration(event, index, index > 480 ? "waitlisted" : "confirmed"));
      }
    }
    return base;
  });

  const counters = configurableEvents.map<RegistrationCounterRecord>((event) => {
    const eventRegistrations = registrations.filter((record) => record.eventId === event.id);
    return {
      eventId: event.id,
      churchId: event.churchId,
      submitted: eventRegistrations.length,
      confirmed: eventRegistrations.filter((record) => ["confirmed", "checked_in", "attended", "no_show"].includes(record.status)).length,
      waitlisted: eventRegistrations.filter((record) => record.status === "waitlisted").length,
      cancelled: eventRegistrations.filter((record) => record.status === "cancelled").length,
      checkedIn: eventRegistrations.filter((record) => record.status === "checked_in" || record.status === "attended").length,
      attended: eventRegistrations.filter((record) => record.status === "attended").length,
      noShow: eventRegistrations.filter((record) => record.status === "no_show").length,
      confirmedAttendees: eventRegistrations.filter((record) => ["confirmed", "checked_in", "attended", "no_show"].includes(record.status)).reduce((sum, record) => sum + record.attendeeCount, 0),
      waitlistedAttendees: eventRegistrations.filter((record) => record.status === "waitlisted").reduce((sum, record) => sum + record.attendeeCount, 0),
      updatedAt: isoFromNow(-1),
    };
  });

  const records: Array<{ collection: string; id: string; data: unknown }> = [
    ...churches.map((record) => ({ collection: firestoreCollectionNames.churches, id: record.id, data: record })),
    ...users.map((record) => ({ collection: firestoreCollectionNames.users, id: record.id, data: record })),
    ...representatives.map((record) => ({ collection: firestoreCollectionNames.churchRepresentatives, id: record.id, data: record })),
    ...events.map((record) => ({ collection: firestoreCollectionNames.events, id: record.id, data: record })),
    ...events.filter((event) => event.wasPublished).map((record) => ({ collection: firestoreCollectionNames.publicEvents, id: record.id, data: record })),
    ...configurableEvents.map((event) => ({ collection: firestoreCollectionNames.eventRegistrationConfigurations, id: event.id, data: registrationConfiguration(event) })),
    ...configurableEvents.map((event) => ({ collection: firestoreCollectionNames.eventFormVersions, id: `${event.id}-form-v1`, data: formVersion(event) })),
    ...registrations.map((record) => ({ collection: firestoreCollectionNames.eventRegistrations, id: record.id, data: record })),
    ...registrations.map((record) => ({ collection: firestoreCollectionNames.eventRegistrationConfirmations, id: record.confirmationNumber, data: { registrationId: record.id, eventId: record.eventId, churchId: record.churchId, createdAt: record.submittedAt } })),
    ...counters.map((record) => ({ collection: firestoreCollectionNames.eventRegistrationCounters, id: record.eventId, data: record })),
    { collection: firestoreCollectionNames.eventReports, id: `${idPrefix}-event-report-1`, data: { id: `${idPrefix}-event-report-1`, eventId: `${idPrefix}-event-published`, eventTitle: "Staging Published Family Night", eventSlug: "staging-published-family-night", churchId: churches[0].id, churchName: churches[0].name, reason: "incorrect_information", message: "Fictitious report for moderation QA.", status: "new", createdAt: isoFromNow(-1), updatedAt: isoFromNow(-1), reporterName: "Staging Reporter", reporterEmail: `reporter@${testEmailDomain}`, ipHash: hash("staging-ip"), userAgentHash: hash("staging-user-agent") } },
    { collection: firestoreCollectionNames.operationalEvents, id: `${idPrefix}-operational-event-1`, data: { id: `${idPrefix}-operational-event-1`, type: "staging_seed", severity: "info", entityType: "staging", entityId: marker, actorId: `${idPrefix}-admin`, summary: "Staging QA seed created.", metadata: { large }, createdAt: isoFromNow(0) } },
  ];

  const manifest = {
    dryRun,
    confirm,
    large,
    environment: target.environment,
    projectIds: target.projectIds,
    authUsers: users.length,
    firestoreWrites: records.length,
    churches: churches.length,
    events: events.length,
    registrations: registrations.length,
    marker,
  };

  console.log(JSON.stringify(manifest, null, 2));

  if (dryRun) {
    console.log("Dry run complete. No staging records were written.");
    return;
  }

  const authResult = await upsertAuthUsers(users, password!);
  await commitBatches(records);
  console.log(JSON.stringify({ ok: true, authResult, marker }, null, 2));
}

main().catch((error) => {
  console.error("Failed to seed Community Hub staging data.", error);
  process.exit(1);
});

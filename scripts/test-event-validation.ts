import { validateEventFormData } from "@/lib/validation/event-management";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createBaseEventFormData(overrides?: Record<string, string | string[] | boolean>) {
  const formData = new FormData();
  const entries: Record<string, string | string[] | boolean> = {
    churchId: "church-a",
    title: "Community Prayer Night",
    summary: "A simple community prayer gathering for families.",
    description: "Join us for a community prayer gathering hosted by the local church.",
    primaryType: "prayer-meeting-or-prayer-vigil",
    audienceTags: ["everyone-or-community"],
    languages: "English, Spanish",
    startDate: "2027-03-15",
    startTime: "18:30",
    endDate: "2027-03-15",
    endTime: "20:00",
    timeZone: "America/Chicago",
    locationMode: "in_person",
    venueName: "Main Sanctuary",
    addressLine1: "100 Main Street",
    city: "Palacios",
    stateCode: "TX",
    postalCode: "77465",
    costStatus: "free",
    visibility: "public",
    registrationMode: "none",
    ...(overrides ?? {}),
  };

  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => formData.append(key, entry));
    } else if (typeof value === "boolean") {
      if (value) {
        formData.set(key, "on");
      }
    } else {
      formData.set(key, value);
    }
  }

  return formData;
}

async function expectValidationError(
  formData: FormData,
  expectedMessagePart: string,
) {
  try {
    await validateEventFormData(formData);
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(expectedMessagePart),
      `Expected error containing "${expectedMessagePart}", received "${
        error instanceof Error ? error.message : String(error)
      }".`,
    );
    return;
  }

  throw new Error(`Expected validation to fail with "${expectedMessagePart}".`);
}

async function main() {
  const validEvent = await validateEventFormData(createBaseEventFormData());

  assert(validEvent.title === "Community Prayer Night", "Valid event title should parse.");
  assert(validEvent.primaryType === "Prayer Meeting or Prayer Vigil", "Primary event type should normalize.");
  assert(validEvent.registrationMode === "none", "Registration mode should parse.");
  assert(validEvent.address?.city === "Palacios", "Address should parse for in-person events.");

  await expectValidationError(
    createBaseEventFormData({
      registrationMode: "external",
      externalRegistrationUrl: "http://example.com/register",
    }),
    "Use a secure HTTPS URL.",
  );

  await expectValidationError(
    createBaseEventFormData({
      registrationMode: "google_forms",
      externalRegistrationUrl: "https://example.com/register",
    }),
    "Use a Google Forms URL",
  );

  await expectValidationError(
    createBaseEventFormData({
      endDate: "2027-03-14",
      endTime: "20:00",
    }),
    "after the start date",
  );

  await expectValidationError(
    createBaseEventFormData({
      capacity: "0",
    }),
    "Capacity must be",
  );

  await expectValidationError(
    createBaseEventFormData({
      locationMode: "online",
      onlineUrl: "",
    }),
    "Add a secure online meeting",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "valid event parses",
          "event type normalizes",
          "external registration requires HTTPS",
          "Google Forms mode requires Google Forms URL",
          "end date must be after start",
          "capacity must be positive",
          "online events require HTTPS online URL",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

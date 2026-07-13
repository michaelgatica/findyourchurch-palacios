import type {
  RegistrationFieldSchema,
  RegistrationFormSection,
  SensitiveDataClassification,
} from "@/lib/types/registrations";

interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  sections: RegistrationFormSection[];
}

function field(
  id: string,
  label: string,
  type: RegistrationFieldSchema["type"],
  displayOrder: number,
  options: Partial<RegistrationFieldSchema> = {},
): RegistrationFieldSchema {
  return {
    id,
    label,
    type,
    displayOrder,
    required: options.required ?? false,
    options: options.options ?? [],
    includeInExports: options.includeInExports ?? true,
    sensitiveClassification: options.sensitiveClassification ?? "none",
    helpText: options.helpText,
    placeholder: options.placeholder,
    minValue: options.minValue,
    maxValue: options.maxValue,
    minSelections: options.minSelections,
    maxSelections: options.maxSelections,
    minLength: options.minLength,
    maxLength: options.maxLength,
    defaultValue: options.defaultValue,
    condition: options.condition,
    organizerExplanation: options.organizerExplanation,
    participantFields: options.participantFields,
  };
}

function optionValues(values: string[]) {
  return values.map((value, index) => ({
    id: `option-${index + 1}`,
    label: value,
    value: value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  }));
}

function section(id: string, title: string, fields: RegistrationFieldSchema[], displayOrder = 0) {
  return { id, title, displayOrder, fields } satisfies RegistrationFormSection;
}

function contactField(
  id: string,
  label: string,
  type: RegistrationFieldSchema["type"],
  order: number,
  required = true,
  classification: SensitiveDataClassification = "standard_contact",
) {
  return field(id, label, type, order, {
    required,
    sensitiveClassification: classification,
    maxLength: type === "email" ? 254 : 120,
  });
}

const simpleRsvp: PresetDefinition = {
  id: "simple_rsvp",
  name: "Simple RSVP",
  description: "A short contact and household attendance form.",
  sections: [
    section("contact", "Your RSVP", [
      contactField("contact_name", "Contact name", "full_name", 0),
      field("attendee_count", "Number attending", "number", 1, {
        required: true,
        minValue: 1,
        maxValue: 25,
      }),
      contactField("contact_email", "Email", "email", 2, false),
      contactField("contact_phone", "Phone", "phone", 3, false),
      field("notes", "Notes", "long_text", 4, { maxLength: 500 }),
    ]),
  ],
};

const adultWorkshop: PresetDefinition = {
  id: "adult_workshop",
  name: "Adult Conference or Workshop",
  description: "Contact, church, meal, apparel, and accommodation details.",
  sections: [
    section("attendee", "Attendee information", [
      contactField("first_name", "First name", "first_name", 0),
      contactField("last_name", "Last name", "last_name", 1),
      contactField("email", "Email", "email", 2),
      contactField("phone", "Phone", "phone", 3),
      field("address", "Street address", "street_address", 4, { sensitiveClassification: "address" }),
      field("city", "City", "city", 5, { sensitiveClassification: "address" }),
      field("state", "State", "state", 6, { sensitiveClassification: "address", maxLength: 2 }),
      field("zip", "ZIP code", "zip_code", 7, { sensitiveClassification: "address" }),
      field("church_affiliation", "Church affiliation", "short_text", 8, { maxLength: 160 }),
    ]),
    section("preferences", "Event preferences", [
      field("shirt_size", "T-shirt size", "dropdown", 0, { options: optionValues(["XS", "S", "M", "L", "XL", "2XL", "3XL"]) }),
      field("meal_choice", "Meal choice", "dropdown", 1, { options: optionValues(["Standard", "Vegetarian", "No meal"]) }),
      field("dietary_restrictions", "Dietary restrictions", "long_text", 2, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
      field("accessibility", "Accessibility accommodations", "long_text", 3, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
      field("notes", "Additional notes", "long_text", 4, { maxLength: 750 }),
    ], 1),
  ],
};

const childParticipantFields = [
  field("child_legal_name", "Child's legal name", "full_name", 0, { required: true, sensitiveClassification: "minor" }),
  field("child_preferred_name", "Preferred name", "short_text", 1, { sensitiveClassification: "minor" }),
  field("child_birth_date", "Date of birth", "date", 2, { required: true, sensitiveClassification: "minor" }),
  field("child_grade", "Grade", "short_text", 3, { sensitiveClassification: "minor" }),
  field("child_school", "School", "short_text", 4, { sensitiveClassification: "minor" }),
  field("child_allergies", "Allergies", "long_text", 5, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
  field("child_dietary", "Dietary restrictions", "long_text", 6, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
  field("child_accessibility", "Accessibility or accommodation information", "long_text", 7, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
  field("child_emergency", "Important emergency information", "long_text", 8, { sensitiveClassification: "emergency", maxLength: 750 }),
];

const vbs: PresetDefinition = {
  id: "children_event",
  name: "Vacation Bible School or Children's Event",
  description: "Guardian, child, pickup, emergency, and consent information.",
  sections: [
    section("guardian", "Parent or guardian", [
      contactField("guardian_name", "Parent or guardian name", "full_name", 0),
      contactField("guardian_phone", "Parent or guardian phone", "phone", 1),
      contactField("guardian_email", "Parent or guardian email", "email", 2),
      field("address", "Street address", "street_address", 3, { sensitiveClassification: "address" }),
      field("children", "Children", "repeating_child_group", 4, {
        required: true,
        minValue: 1,
        maxValue: 10,
        sensitiveClassification: "minor",
        participantFields: childParticipantFields,
      }),
    ]),
    section("safety", "Safety and permissions", [
      field("emergency_contact_name", "Emergency contact name", "full_name", 0, { required: true, sensitiveClassification: "emergency" }),
      field("emergency_contact_phone", "Emergency contact phone", "phone", 1, { required: true, sensitiveClassification: "emergency" }),
      field("authorized_pickup", "Authorized pickup information", "long_text", 2, { required: true, sensitiveClassification: "minor", maxLength: 750 }),
      field("media_permission", "Photo or media permission", "yes_no", 3, { required: true, sensitiveClassification: "consent" }),
      field("participation_permission", "Participation permission", "consent", 4, { required: true, sensitiveClassification: "consent" }),
      field("liability_acknowledgment", "Liability acknowledgment", "electronic_acknowledgment", 5, { required: true, sensitiveClassification: "consent" }),
      field("notes", "Additional notes", "long_text", 6, { maxLength: 750 }),
    ], 1),
  ],
};

const youthEvent: PresetDefinition = {
  id: "youth_event",
  name: "Youth Event",
  description: "Participant, guardian, emergency, accommodation, and permission details.",
  sections: [
    section("participant", "Participant", [
      contactField("participant_name", "Participant name", "full_name", 0, true, "minor"),
      field("age", "Age", "number", 1, { required: true, minValue: 10, maxValue: 21, sensitiveClassification: "minor" }),
      field("grade", "Grade", "short_text", 2, { required: true, sensitiveClassification: "minor" }),
      contactField("guardian_name", "Parent or guardian name", "full_name", 3),
      contactField("guardian_email", "Parent or guardian email", "email", 4),
      contactField("guardian_phone", "Parent or guardian phone", "phone", 5),
      field("emergency_contact", "Emergency contact", "long_text", 6, { required: true, sensitiveClassification: "emergency", maxLength: 300 }),
      field("allergies", "Allergies", "long_text", 7, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
      field("dietary", "Dietary restrictions", "long_text", 8, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
      field("accessibility", "Accessibility accommodations", "long_text", 9, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
    ]),
    section("permissions", "Permissions", [
      field("transportation_permission", "Transportation permission", "consent", 0, { required: true, sensitiveClassification: "consent" }),
      field("media_permission", "Photo or media permission", "yes_no", 1, { required: true, sensitiveClassification: "consent" }),
      field("participation_consent", "Participation consent", "electronic_acknowledgment", 2, { required: true, sensitiveClassification: "consent" }),
    ], 1),
  ],
};

const volunteer: PresetDefinition = {
  id: "volunteer",
  name: "Volunteer Registration",
  description: "Contact information, interests, availability, skills, and acknowledgments.",
  sections: [
    section("volunteer", "Volunteer information", [
      contactField("name", "Name", "full_name", 0),
      contactField("email", "Email", "email", 1),
      contactField("phone", "Phone", "phone", 2),
      field("church_affiliation", "Church affiliation", "short_text", 3, { maxLength: 160 }),
      field("interests", "Volunteer interests", "multiple_checkboxes", 4, { options: optionValues(["Welcome team", "Setup", "Food service", "Children", "Prayer", "Cleanup"]) }),
      field("preferred_role", "Preferred role", "short_text", 5, { maxLength: 160 }),
      field("availability", "Availability", "long_text", 6, { required: true, maxLength: 500 }),
      field("experience", "Relevant experience or skills", "long_text", 7, { maxLength: 750 }),
      field("shirt_size", "T-shirt size", "dropdown", 8, { options: optionValues(["XS", "S", "M", "L", "XL", "2XL", "3XL"]) }),
      field("acknowledgment", "Volunteer acknowledgment", "consent", 9, { required: true, sensitiveClassification: "consent" }),
    ]),
  ],
};

const communityMeal: PresetDefinition = {
  id: "community_meal",
  name: "Community Meal or Distribution",
  description: "Household attendance, timing, dietary, and accessibility needs.",
  sections: [
    section("household", "Household information", [
      contactField("contact_name", "Contact name", "full_name", 0),
      contactField("phone", "Phone", "phone", 1),
      contactField("email", "Email", "email", 2, false),
      field("household_size", "Household size", "number", 3, { required: true, minValue: 1, maxValue: 30 }),
      field("adult_count", "Number of adults", "number", 4, { required: true, minValue: 0, maxValue: 30 }),
      field("child_count", "Number of children", "number", 5, { required: true, minValue: 0, maxValue: 30, sensitiveClassification: "minor" }),
      field("attendance_time", "Preferred pickup or attendance time", "short_text", 6, { maxLength: 120 }),
      field("dietary_accessibility", "Dietary or accessibility needs", "long_text", 7, { sensitiveClassification: "health_accommodation", maxLength: 500 }),
      field("notes", "Notes", "long_text", 8, { maxLength: 500 }),
    ]),
  ],
};

export const registrationPresets: PresetDefinition[] = [
  simpleRsvp,
  adultWorkshop,
  vbs,
  youthEvent,
  volunteer,
  communityMeal,
];

export function getRegistrationPreset(presetId: string) {
  return registrationPresets.find((preset) => preset.id === presetId) ?? null;
}

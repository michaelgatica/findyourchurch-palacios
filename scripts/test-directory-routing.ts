import { buildChurchProfilePath, isReservedChurchShareSlug } from "@/lib/config/site";
import { filterChurches } from "@/lib/church-utils";
import { emptyDirectoryFilters, type ChurchRecord } from "@/lib/types/directory";

function createFixtureChurch(overrides: Partial<ChurchRecord>): ChurchRecord {
  const now = new Date("2026-01-01T12:00:00.000Z").toISOString();

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
    description: "A fixture church used for routing and directory regression checks.",
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
    listingVerificationStatus: "current",
    lastVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const churches = [
    createFixtureChurch({
      id: "published-palacios",
      slug: "agape-family-outreach-church",
      name: "Agape Family Outreach Church",
      customShareSlug: "agape-palacios",
    }),
    createFixtureChurch({
      id: "published-blessing",
      slug: "blessing-community-church",
      name: "Blessing Community Church",
      cityId: "tx-blessing",
      countyId: "tx-matagorda",
      stateId: "tx",
      address: {
        line1: "200 Main Street",
        line2: "",
        city: "Blessing",
        stateCode: "TX",
        postalCode: "77419",
        countryCode: "US",
        latitude: null,
        longitude: null,
      },
    }),
    createFixtureChurch({
      id: "pending-palacios",
      slug: "pending-palacios-church",
      name: "Pending Palacios Church",
      status: "pending_review",
    }),
  ];

  const publishedChurches = churches.filter((church) => church.status === "published");
  const directoryDefaultResults = filterChurches(publishedChurches, emptyDirectoryFilters);

  assert(
    directoryDefaultResults.length === publishedChurches.length,
    `Directory default count (${directoryDefaultResults.length}) must match published homepage count (${publishedChurches.length}).`,
  );

  assert(
    buildChurchProfilePath(publishedChurches[0]) === "/tx/palacios/agape-family-outreach-church",
    "Palacios church canonical route should use /tx/palacios/[churchSlug].",
  );

  assert(
    buildChurchProfilePath(publishedChurches[1]) === "/tx/blessing/blessing-community-church",
    "Nearby town church canonical route should use the correct Texas city segment.",
  );

  assert(
    buildChurchProfilePath("agape-family-outreach-church") ===
      "/churches/agape-family-outreach-church",
    "String-only route should remain the legacy /churches/[slug] fallback for redirects and old links.",
  );

  assert(isReservedChurchShareSlug("events"), "Events must remain reserved as a church share slug.");
  assert(isReservedChurchShareSlug("TX"), "State abbreviations must remain reserved as share slugs.");
  assert(!isReservedChurchShareSlug("agape-palacios"), "Valid custom church share slugs should be allowed.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        publishedChurches: publishedChurches.length,
        directoryDefaultResults: directoryDefaultResults.length,
        canonicalRoutes: publishedChurches.map((church) => buildChurchProfilePath(church)),
        reservedSlugChecks: {
          events: isReservedChurchShareSlug("events"),
          tx: isReservedChurchShareSlug("TX"),
          agapePalacios: isReservedChurchShareSlug("agape-palacios"),
        },
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

import assert from "node:assert/strict";

import {
  buildChangedPublicListingText,
  getAiListingReviewConfiguration,
  parseModerationResponse,
} from "../src/lib/services/church-update-ai-review-service";
import type { ChurchListingDraft, ChurchRecord } from "../src/lib/types/directory";

const baseDraft: ChurchListingDraft = {
  cityId: "palacios",
  countyId: "matagorda",
  stateId: "tx",
  name: "Grace Community Church",
  logoSrc: null,
  photos: [],
  denomination: "Non-denominational",
  additionalLeaders: [],
  description: "A welcoming church family.",
  serviceTimes: [],
  address: {
    line1: "123 Public Street",
    city: "Palacios",
    stateCode: "TX",
    postalCode: "77465",
    countryCode: "US",
    latitude: null,
    longitude: null,
  },
  mailingAddress: {
    line1: "Private Mailbox 77",
    city: "Palacios",
    stateCode: "TX",
    postalCode: "77465",
    countryCode: "US",
    latitude: null,
    longitude: null,
  },
  phone: "361-555-0111",
  email: "private-contact@example.test",
  socialLinks: {},
  languages: ["English"],
  features: {
    childrenMinistry: false,
    youthMinistry: false,
    nurseryCare: false,
    spanishService: false,
    livestream: false,
    wheelchairAccessible: true,
  },
  ministryTags: [],
};

const currentChurch: ChurchRecord = {
  ...baseDraft,
  id: "church-a",
  slug: "grace-community-church",
  status: "published",
  updatedAt: "2026-08-07T00:00:00.000Z",
};

const proposedChanges: ChurchListingDraft = {
  ...baseDraft,
  description: "A welcoming church family with practical support for our neighbors.",
  ministryTags: [{ id: "service", label: "Community Service", slug: "community-service" }],
  phone: "361-555-0999",
  email: "do-not-send@example.test",
};

function testConfiguration() {
  assert.deepEqual(getAiListingReviewConfiguration({}), { mode: "off" });
  assert.equal(
    getAiListingReviewConfiguration({ AI_LISTING_REVIEW_MODE: "recommend" }).configurationError,
    "OPENAI_MODERATION_API_KEY is required when AI listing review is enabled.",
  );
  assert.deepEqual(
    getAiListingReviewConfiguration({
      AI_LISTING_REVIEW_MODE: "shadow",
      OPENAI_MODERATION_API_KEY: "test-key",
    }),
    { mode: "shadow", apiKey: "test-key" },
  );
}

function testDataMinimization() {
  const text = buildChangedPublicListingText(currentChurch, proposedChanges);

  assert.match(text, /practical support/);
  assert.match(text, /Community Service/);
  assert.doesNotMatch(text, /361-555/);
  assert.doesNotMatch(text, /private-contact/);
  assert.doesNotMatch(text, /do-not-send/);
  assert.doesNotMatch(text, /Private Mailbox/);
  assert.doesNotMatch(text, /123 Public Street/);
}

function testResponseParsing() {
  assert.deepEqual(
    parseModerationResponse({
      results: [
        { flagged: false, categories: { harassment: false } },
        { flagged: true, categories: { violence: true } },
      ],
    }),
    { flagged: true, categories: ["violence"] },
  );
  assert.equal(parseModerationResponse({ results: [] }), null);
}

testConfiguration();
testDataMinimization();
testResponseParsing();

console.log("Church update AI review tests passed.");

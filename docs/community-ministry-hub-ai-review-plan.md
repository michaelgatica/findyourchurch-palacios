# Future AI-assisted church listing review plan

Status: design-only backlog item. This document does not change the current listing, claim, representative, or administrator workflow.

## Product decision

The initial request for church access remains a human decision owned by Michael Gatica (`michaelgatica@elroidigital.org`). The AI reviewer must never be granted Firebase superadmin, platform-admin, Auth-admin, Storage-admin, or direct publish authority.

The existing workflow remains the safety fallback:

1. A church submits an initial listing or claim.
2. Michael reviews and approves access.
3. A representative submits a listing update.
4. The update remains pending until the existing authorized administrator action approves it.

AI review is intended to reduce routine update reviews after a staged pilot. It is not a replacement for ownership verification, legal judgment, doctrinal judgment, or the existing security boundaries.

## Proposed workflow

1. Keep the existing schema validation, file validation, authorization, and `pending_review` state unchanged.
2. Enqueue an idempotent, bounded `church-update-ai-review` job containing only the changed public fields and approved image references.
3. Run deterministic checks first: profanity and obfuscation patterns, file type/size/dimensions, image decode safety, duplicate/spam signals, and prohibited URL patterns.
4. Use the OpenAI Moderations endpoint for text and image classification. The endpoint supports text and image inputs; the API key must remain server-side. See the [official OpenAI Moderations reference](https://developers.openai.com/api/reference/resources/moderations).
5. Store a structured recommendation, not a free-form model transcript:
   - `clear`: no policy signal detected;
   - `needs_human`: ambiguous, borderline, or policy-sensitive content;
   - `block`: a deterministic or high-confidence violation;
   - `error`: provider timeout, quota failure, malformed response, or unavailable key.
6. Keep the update pending for `needs_human`, `block`, and `error`. Notify Michael for `needs_human` and `error`; show the representative a neutral “awaiting review” message rather than the model’s internal reasoning.
7. Only after a measured pilot and explicit owner approval may `clear` recommendations be eligible for automatic approval. The existing administrator approve/reject action remains the final authority and emergency override.

## Least-privilege authorization

The future reviewer should run as a dedicated server-side workload identity or service account with access limited to:

- reading the specific pending update and public image references;
- writing an AI-review result and safe audit/operational metadata;
- enqueueing or retrying its own bounded review job.

It must not write `status=published`, modify claims, create representatives, change user roles, read registrations, access private exports, or modify unrelated churches. The existing server action must re-check the human administrator’s authorization at approval time.

Do not expose the reviewer endpoint to the browser. Do not let a church representative submit an AI result, choose the result, or bypass the pending state.

## Secret handling

The API key supplied through the clipboard has not been copied into source, Git, documentation, terminal output, or a local environment file in this task. This is intentional: OpenAI’s guidance says API keys are secrets and should be loaded from a server environment variable or key-management service, never client-side. See the [official API authentication guidance](https://developers.openai.com/api/reference/overview#backwards-compatibility).

When implementation is authorized, use separate versioned Secret Manager entries, for example:

- `FYC_STAGING_OPENAI_MODERATION_API_KEY`
- `FYC_PROD_OPENAI_MODERATION_API_KEY`

Grant access only to the review workload identity. Keep the key out of App Hosting client variables, browser bundles, screenshots, logs, pull requests, and test fixtures. Add a spend limit, request timeout, retry budget, and rotation procedure before enabling production use.

## Privacy and data minimization

Send only the changed public listing text and the image under review. Do not send registration answers, child information, medical/allergy details, emergency contacts, access tokens, or private exports. Prefer short-lived signed image URLs or server-side image bytes and never expose Storage credentials.

OpenAI documents that API usage can produce abuse-monitoring logs retained for up to 30 days by default. Before production use, the owner must approve the provider data-control posture, retention implications, and any applicable church/privacy notice. Do not claim zero retention unless the organization has actually enabled and verified an eligible control.

## Rollout plan

### Phase 0 — shadow mode

- AI runs after a normal update submission but cannot affect approval.
- Compare recommendations with Michael’s decision.
- Measure false positives, false negatives, latency, cost, and image/text coverage.

### Phase 1 — recommendation mode

- Show the recommendation and safe category labels in the existing admin update-review page.
- Michael remains required for every approval.
- `needs_human` and `error` notifications go to Michael; no church receives model-internal details.

### Phase 2 — narrowly bounded auto-clear

- Only explicitly approved, low-risk listing updates may auto-clear.
- Initial claims, ownership changes, representative invitations, logos, and any ambiguous result remain human-reviewed.
- Any provider error, policy change, missing image, or uncertain classification fails closed to human review.

### Phase 3 — monitored operation

- Alert on provider failures, queue age, repeated `needs_human`, auto-clear reversals, and disagreement with human decisions.
- Provide a one-switch kill control that returns all updates to the current manual-review path.
- Review samples monthly and before changing thresholds or model configuration.

## Required tests before enabling auto-clear

- Clean church descriptions, service times, ministry names, and religious terms do not produce avoidable false positives.
- Profanity, obfuscated profanity, harassment, hate, threats, sexual content, and unsafe imagery remain pending or blocked as designed.
- Logos and photos are reviewed without stretching, mutation, or unsafe public access.
- Provider timeout, quota exhaustion, invalid JSON, missing secret, and rate-limit responses fail closed to manual review.
- Duplicate job delivery is idempotent and cannot publish twice.
- Church A cannot inspect or alter Church B’s AI-review record.
- AI cannot approve a claim, grant a role, publish an update, read registrations, or access private exports.
- Existing admin approval, audit, notification, rollback, and cleanup tests remain green.

## Owner decisions required later

- Approve the provider data-retention posture for public listing text and images.
- Choose the notification channel and escalation timing for `needs_human` and `error`.
- Define which update categories may ever auto-clear.
- Set the maximum review latency, monthly API spend, retry count, and queue age alert.
- Approve the exact Secret Manager project and workload identity bindings.
- Approve the pilot sample size and the false-positive/false-negative exit criteria.

Until those decisions are recorded and the pilot passes, the recommendation is **manual review remains authoritative; no AI auto-approval is enabled**.

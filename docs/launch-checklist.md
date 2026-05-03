# Launch Checklist

## Public visitor checks

- Homepage loads.
- Directory loads.
- Search works.
- Filters work.
- Clear filters works.
- Result count updates.
- Church profile loads.
- Call, email, website, and directions buttons work.
- Submit church flow works.
- Claim church flow works.
- About page loads.
- Contact page loads.
- Privacy page loads.
- Terms page loads.
- Listing guidelines page loads.
- Donation buttons and embed appear only when donations are enabled.

## Admin checks

- Admin login works.
- Non-admin cannot access `/admin`.
- Approve submission works.
- Deny submission works.
- Request changes works.
- Approve claim works.
- Approve update works.
- Audit logs are created.
- Email logs are created.
- Pending queues show accurate counts.

## Representative checks

- Portal login works.
- Non-representative cannot access `/portal`.
- Approved representative can access `/portal`.
- Edit church works.
- Auto-publish true works.
- Auto-publish false creates pending update request.
- Editor invite works.
- Second editor invite is blocked.
- Ownership transfer request works.
- Messages work.
- Suspended representative is blocked.

## Security checks

- Public users cannot view pending submissions.
- Public users cannot view internal notes.
- Representative cannot edit another church.
- Only primary owner can invite editor.
- Only primary owner can request ownership transfer.
- Admin-only actions are still protected server-side.
- `.env.local` is not tracked by Git.
- No service account key or email provider secret is exposed client-side.

## Content and data checks

- Demo/sample churches are removed or clearly labeled.
- Workflow test data is removed if tests were run against live Firebase.
- Duplicate listings have been reviewed.
- Real church contact details have been verified.
- Last verified dates are reasonable.

## Deployment checks

- `NEXT_PUBLIC_SITE_URL` matches the live domain.
- Firebase Auth is enabled.
- Firestore named database is configured.
- Storage bucket exists and uploads work.
- Firestore rules reviewed.
- Storage rules reviewed.
- Email provider configured and tested.
- Donation URL configured.
- Sitemap verified.
- Mobile layout checked on a phone-sized viewport.

## Cleanup safety

- Preview demo cleanup with `npm run cleanup:demo-data -- --dry-run`.
- Preview workflow cleanup with `npm run cleanup:test-data -- --dry-run`.
- Only use `--confirm` after reviewing what will be removed.
- Do not run destructive cleanup against production unless you understand exactly what the script will delete.

## Final Launch Test Flow

### Public visitor

1. Visit homepage.
2. Browse directory.
3. Search and filter churches.
4. Open a church profile.
5. Use call, email, website, and directions buttons.
6. Submit a test church.
7. Confirm the pending submission message appears.

### Admin

1. Sign in as admin through the real UI.
2. View the pending submission.
3. Request changes on one test submission.
4. Deny a test submission.
5. Approve a test submission.
6. Confirm the approved church appears publicly.
7. Review email logs and audit logs.

### Claim and representative

1. Visit a public church profile.
2. Click `Claim This Church`.
3. Create or sign in as a user.
4. Submit the claim.
5. Approve the claim in admin.
6. Sign into the representative portal.
7. Edit the listing.
8. Test `autoPublishUpdates = true`.
9. Test `autoPublishUpdates = false`.
10. Approve the pending update in admin.
11. Send an admin message from the portal.
12. Invite an editor.
13. Submit an ownership transfer request.

### Security

1. Confirm a non-admin cannot use `/admin`.
2. Confirm a non-representative cannot use `/portal`.
3. Confirm a representative cannot edit another church.
4. Confirm a suspended representative cannot edit.

## Launch Day Manual Test

### Public

1. Visit the homepage on the live domain.
2. Visit the church directory.
3. Search and filter churches.
4. Open a church profile.
5. Test the Call button.
6. Test the Email button.
7. Test the Website button.
8. Test the Directions button.
9. Test the Claim This Church button.
10. Test the Submit Your Church form.
11. Confirm the donation modal opens if enabled.
12. Confirm the donation embed or iframe fallback renders if enabled.
13. Confirm the mobile layout on a phone-sized viewport.

### Admin

1. Sign in with the real admin account.
2. View the dashboard.
3. View pending submissions.
4. Approve a test submission.
5. Deny a test submission.
6. Request changes on a test submission.
7. Approve a claim request.
8. Toggle `autoPublishUpdates`.
9. View email logs if available.
10. View audit logs if available.

### Representative

1. Create or sign in as a test representative.
2. Submit a claim request.
3. Have admin approve the claim.
4. Log into the representative portal.
5. Edit the listing with `autoPublishUpdates=true`.
6. Edit the listing with `autoPublishUpdates=false`.
7. Have admin approve the pending update.
8. Send a message to admin.
9. Invite one editor.
10. Verify the second editor invite is blocked.
11. Request ownership transfer.

### Security

1. Confirm a non-admin cannot access `/admin`.
2. Confirm a non-representative cannot access `/portal`.
3. Confirm a suspended representative cannot edit.
4. Confirm a representative cannot edit another church.
5. Confirm pending submissions do not appear publicly.
6. Confirm pending claims do not appear publicly.

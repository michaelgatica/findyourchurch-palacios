"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitChurchAction } from "@/lib/actions/submit-church";
import { denominationOptions, worshipStyleOptions } from "@/lib/data/options";
import { emptySubmissionFormState } from "@/lib/types/directory";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="field__error">{message}</p>;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="field__label">
      {children} <span className="field__required">Required</span>
    </span>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending}>
      {pending ? "Submitting..." : "Submit Church Listing"}
    </button>
  );
}

export function SubmitChurchForm() {
  const [state, formAction] = useActionState(submitChurchAction, emptySubmissionFormState);
  const formState = state ?? emptySubmissionFormState;
  const [createManagerAccount, setCreateManagerAccount] = useState(
    formState.values.createManagerAccount,
  );

  useEffect(() => {
    setCreateManagerAccount(formState.values.createManagerAccount);
  }, [formState.values.createManagerAccount]);

  return (
    <form
      key={JSON.stringify(formState.values)}
      action={formAction}
      className="submission-form"
      encType="multipart/form-data"
    >
      <div className="submission-form__intro panel">
        <p className="eyebrow eyebrow--gold">Church Listing Submission</p>
        <h2>Share your church listing with the Palacios directory</h2>
        <p>
          Submitted listings are saved as <strong>pending review</strong> and are not published
          automatically. Please allow up to 24 hours for approval.
        </p>
        <p className="supporting-text">
          Fields marked Required are needed before we can review the listing.
        </p>
        {formState.formError ? <div className="form-alert">{formState.formError}</div> : null}
      </div>

      <section className="form-section panel">
        <h3>Church information</h3>
        <div className="form-grid">
          <label className="field">
            <RequiredLabel>Church name</RequiredLabel>
            <input name="churchName" defaultValue={formState.values.churchName} required />
            <FieldError message={formState.errors.churchName} />
          </label>

          <label className="field">
            <RequiredLabel>Denomination / tradition</RequiredLabel>
            <select name="denomination" defaultValue={formState.values.denomination} required>
              <option value="">Choose one</option>
              {denominationOptions.map((denomination) => (
                <option key={denomination} value={denomination}>
                  {denomination}
                </option>
              ))}
            </select>
            <FieldError message={formState.errors.denomination} />
          </label>

          <label className="field">
            <span className="field__label">Custom share link</span>
            <input
              name="customShareSlug"
              defaultValue={formState.values.customShareSlug}
              placeholder="first-baptist-palacios"
            />
            <span className="field__hint">
              Optional. If approved, this can create a short church link like
              {" "}
              <strong>/first-baptist-palacios</strong>.
            </span>
            <FieldError message={formState.errors.customShareSlug} />
          </label>

          <label className="field field--full">
            <RequiredLabel>Short church description</RequiredLabel>
            <textarea
              name="churchDescription"
              maxLength={300}
              defaultValue={formState.values.churchDescription}
              placeholder="Up to 300 characters"
              required
            />
            <span className="field__hint">Keep this brief and welcoming.</span>
            <FieldError message={formState.errors.churchDescription} />
          </label>

          <label className="field field--full">
            <RequiredLabel>Service times</RequiredLabel>
            <textarea
              name="serviceTimes"
              defaultValue={formState.values.serviceTimes}
              placeholder="Enter one service per line"
              required
            />
            <span className="field__hint">Example: Sunday Worship - 10:30 AM</span>
            <FieldError message={formState.errors.serviceTimes} />
          </label>

          <label className="field">
            <span className="field__label">Pastor / Priest / Reverend name</span>
            <input name="clergyName" defaultValue={formState.values.clergyName} />
            <FieldError message={formState.errors.clergyName} />
          </label>

          <label className="field">
            <span className="field__label">Specific affiliation</span>
            <input
              name="specificAffiliation"
              defaultValue={formState.values.specificAffiliation}
              placeholder="Example: Southern Baptist Convention"
            />
            <FieldError message={formState.errors.specificAffiliation} />
          </label>

          <label className="field field--full">
            <span className="field__label">Additional clergy / leaders</span>
            <textarea
              name="additionalLeaders"
              defaultValue={formState.values.additionalLeaders}
              placeholder="One leader per line"
            />
            <FieldError message={formState.errors.additionalLeaders} />
          </label>

          <label className="field field--full">
            <span className="field__label">Statement of faith</span>
            <textarea
              name="statementOfFaith"
              maxLength={200}
              defaultValue={formState.values.statementOfFaith}
              placeholder="Up to 200 characters"
            />
            <FieldError message={formState.errors.statementOfFaith} />
          </label>
        </div>
      </section>

      <section className="form-section panel">
        <h3>Location and contact</h3>
        <div className="form-grid">
          <label className="field field--full">
            <RequiredLabel>Address line 1</RequiredLabel>
            <input name="addressLine1" defaultValue={formState.values.addressLine1} required />
            <FieldError message={formState.errors.addressLine1} />
          </label>

          <label className="field field--full">
            <span className="field__label">Address line 2</span>
            <input name="addressLine2" defaultValue={formState.values.addressLine2} />
          </label>

          <label className="field">
            <RequiredLabel>City</RequiredLabel>
            <input name="city" defaultValue={formState.values.city} required />
            <FieldError message={formState.errors.city} />
          </label>

          <label className="field">
            <RequiredLabel>State</RequiredLabel>
            <input
              name="stateCode"
              defaultValue={formState.values.stateCode}
              maxLength={2}
              placeholder="TX"
              required
            />
            <FieldError message={formState.errors.stateCode} />
          </label>

          <label className="field">
            <RequiredLabel>ZIP code</RequiredLabel>
            <input name="postalCode" defaultValue={formState.values.postalCode} required />
            <FieldError message={formState.errors.postalCode} />
          </label>

          <label className="field">
            <RequiredLabel>Phone number</RequiredLabel>
            <input name="phone" defaultValue={formState.values.phone} required />
            <FieldError message={formState.errors.phone} />
          </label>

          <label className="field">
            <RequiredLabel>Email address</RequiredLabel>
            <input name="email" type="email" defaultValue={formState.values.email} required />
            <FieldError message={formState.errors.email} />
          </label>

          <label className="field">
            <span className="field__label">Website URL</span>
            <input
              name="websiteUrl"
              type="url"
              defaultValue={formState.values.websiteUrl}
              placeholder="https://"
            />
            <FieldError message={formState.errors.websiteUrl} />
          </label>

          <label className="field">
            <span className="field__label">Facebook URL</span>
            <input
              name="facebookUrl"
              type="url"
              defaultValue={formState.values.facebookUrl}
              placeholder="https://"
            />
            <FieldError message={formState.errors.facebookUrl} />
          </label>

          <label className="field">
            <span className="field__label">YouTube URL</span>
            <input
              name="youtubeUrl"
              type="url"
              defaultValue={formState.values.youtubeUrl}
              placeholder="https://"
            />
            <FieldError message={formState.errors.youtubeUrl} />
          </label>

          <label className="field">
            <span className="field__label">Instagram URL</span>
            <input
              name="instagramUrl"
              type="url"
              defaultValue={formState.values.instagramUrl}
              placeholder="https://"
            />
            <FieldError message={formState.errors.instagramUrl} />
          </label>
        </div>
      </section>

      <section className="form-section panel">
        <h3>Ministry details</h3>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Worship style</span>
            <select name="worshipStyle" defaultValue={formState.values.worshipStyle}>
              <option value="">Choose one</option>
              {worshipStyleOptions.map((worshipStyle) => (
                <option key={worshipStyle} value={worshipStyle}>
                  {worshipStyle}
                </option>
              ))}
            </select>
            <FieldError message={formState.errors.worshipStyle} />
          </label>

          <label className="field">
            <span className="field__label">Languages offered</span>
            <input
              name="languagesOffered"
              defaultValue={formState.values.languagesOffered}
              placeholder="English, Spanish"
            />
            <FieldError message={formState.errors.languagesOffered} />
          </label>

          <label className="field">
            <span className="field__label">Online giving link</span>
            <input
              name="onlineGivingUrl"
              type="url"
              defaultValue={formState.values.onlineGivingUrl}
              placeholder="https://"
            />
            <FieldError message={formState.errors.onlineGivingUrl} />
          </label>

          <label className="field field--full">
            <span className="field__label">Active ministries / tags</span>
            <input
              name="ministryTags"
              defaultValue={formState.values.ministryTags}
              placeholder="Prayer, Youth, Community Care"
            />
            <FieldError message={formState.errors.ministryTags} />
          </label>

          <label className="field field--full">
            <span className="field__label">Visitor parking details</span>
            <textarea
              name="visitorParkingDetails"
              defaultValue={formState.values.visitorParkingDetails}
            />
            <FieldError message={formState.errors.visitorParkingDetails} />
          </label>

          <label className="field field--full">
            <span className="field__label">First-time visitor notes</span>
            <textarea
              name="firstTimeVisitorNotes"
              defaultValue={formState.values.firstTimeVisitorNotes}
            />
            <FieldError message={formState.errors.firstTimeVisitorNotes} />
          </label>

          <label className="field field--full">
            <span className="field__label">Accessibility details</span>
            <textarea
              name="accessibilityDetails"
              defaultValue={formState.values.accessibilityDetails}
            />
            <span className="field__hint">
              Include anything first-time visitors should know about accessibility or getting
              around the property.
            </span>
            <FieldError message={formState.errors.accessibilityDetails} />
          </label>
        </div>

        <div className="checkbox-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="childrenMinistryAvailable"
              defaultChecked={formState.values.childrenMinistryAvailable}
            />
            <span>Children&apos;s ministry available</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="youthMinistryAvailable"
              defaultChecked={formState.values.youthMinistryAvailable}
            />
            <span>Youth ministry available</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="nurseryCareAvailable"
              defaultChecked={formState.values.nurseryCareAvailable}
            />
            <span>Nursery care available</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="spanishServiceAvailable"
              defaultChecked={formState.values.spanishServiceAvailable}
            />
            <span>Spanish service available</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="livestreamAvailable"
              defaultChecked={formState.values.livestreamAvailable}
            />
            <span>Livestream available</span>
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="wheelchairAccessible"
              defaultChecked={formState.values.wheelchairAccessible}
            />
            <span>Wheelchair accessible</span>
          </label>
        </div>
      </section>

      <section className="form-section panel">
        <h3>Primary contact and uploads</h3>
        <div className="form-grid">
          <label className="field">
            <RequiredLabel>Primary contact name</RequiredLabel>
            <input
              name="primaryContactName"
              defaultValue={formState.values.primaryContactName}
              required
            />
            <FieldError message={formState.errors.primaryContactName} />
          </label>

          <label className="field">
            <RequiredLabel>Primary contact email</RequiredLabel>
            <input
              name="primaryContactEmail"
              type="email"
              defaultValue={formState.values.primaryContactEmail}
              required
            />
            <FieldError message={formState.errors.primaryContactEmail} />
          </label>

          <label className="field">
            <RequiredLabel>Primary contact role / title</RequiredLabel>
            <input
              name="primaryContactRole"
              defaultValue={formState.values.primaryContactRole}
              required
            />
            <FieldError message={formState.errors.primaryContactRole} />
          </label>

          <label className="field">
            <span className="field__label">Primary contact phone</span>
            <input
              name="primaryContactPhone"
              defaultValue={formState.values.primaryContactPhone}
              placeholder="Optional"
            />
            <FieldError message={formState.errors.primaryContactPhone} />
          </label>

          <label className="field">
            <span className="field__label">Church logo upload</span>
            <input name="churchLogo" type="file" accept=".png,.jpg,.jpeg,.webp" />
            <span className="field__hint">PNG, JPG, or WebP. Maximum 512x512 pixels.</span>
            <FieldError message={formState.errors.churchLogo} />
          </label>

          <label className="field field--full">
            <span className="field__label">Church photos</span>
            <input
              name="churchPhotos"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              multiple
            />
            <span className="field__hint">Upload 3 to 4 photos if available.</span>
            <FieldError message={formState.errors.churchPhotos} />
          </label>
        </div>
      </section>

      <section className="form-section panel">
        <h3>Create the future listing manager account</h3>
        <p className="supporting-text">
          If you would like, you can create the Find Your Church account that will manage this
          listing after approval. The sign-in email will match the primary contact email above.
        </p>

        <label className="checkbox-field">
          <input
            type="checkbox"
            name="createManagerAccount"
            checked={createManagerAccount}
            onChange={(event) => setCreateManagerAccount(event.target.checked)}
          />
          <span>Create the managing account for this church listing now</span>
        </label>

        {createManagerAccount ? (
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            <label className="field">
              <RequiredLabel>Account password</RequiredLabel>
              <input
                name="managerAccountPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required={createManagerAccount}
              />
              <span className="field__hint">
                Use at least 6 characters. This account can sign in after the listing is
                approved.
              </span>
              <FieldError message={formState.errors.managerAccountPassword} />
            </label>

            <label className="field">
              <RequiredLabel>Confirm password</RequiredLabel>
              <input
                name="managerAccountPasswordConfirmation"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required={createManagerAccount}
              />
              <FieldError message={formState.errors.managerAccountPasswordConfirmation} />
            </label>
          </div>
        ) : null}
      </section>

      <div className="submission-form__actions">
        <SubmitButton />
      </div>
    </form>
  );
}


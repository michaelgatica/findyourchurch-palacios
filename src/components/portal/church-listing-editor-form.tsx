"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateChurchListingAction } from "@/lib/actions/portal";
import {
  createChurchListingFormState,
} from "@/lib/portal-church-form-state";
import { denominationOptions, worshipStyleOptions } from "@/lib/data/options";
import type { ChurchRecord } from "@/lib/types/directory";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="field__error">{message}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending}>
      {pending ? "Saving changes..." : "Save church listing changes"}
    </button>
  );
}

export function ChurchListingEditorForm({ church }: { church: ChurchRecord }) {
  const initialState = createChurchListingFormState(church);
  const [state, formAction] = useActionState(updateChurchListingAction, initialState);
  const formState = state ?? initialState;

  return (
    <form
      key={JSON.stringify(formState.values)}
      action={formAction}
      className="submission-form"
      encType="multipart/form-data"
    >
      <input type="hidden" name="churchId" value={formState.values.churchId} />
      <input type="hidden" name="churchSlug" value={formState.values.churchSlug} />

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Church Listing Editor</p>
        <h2>Update public listing information</h2>
        <p className="supporting-text">
          Depending on your church settings, changes will either publish immediately or be held for
          admin review.
        </p>
        {formState.formError ? <div className="form-alert">{formState.formError}</div> : null}
      </div>

      <section className="form-section panel">
        <h3>Church information</h3>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Church name</span>
            <input name="churchName" defaultValue={formState.values.churchName} required />
            <FieldError message={formState.errors.churchName} />
          </label>

          <label className="field">
            <span className="field__label">Denomination / tradition</span>
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
              Optional. This can create a short share link like
              {" "}
              <strong>/first-baptist-palacios</strong>.
            </span>
            <FieldError message={formState.errors.customShareSlug} />
          </label>

          <label className="field field--full">
            <span className="field__label">Short church description</span>
            <textarea
              name="churchDescription"
              maxLength={300}
              defaultValue={formState.values.churchDescription}
              required
            />
            <FieldError message={formState.errors.churchDescription} />
          </label>

          <label className="field field--full">
            <span className="field__label">Service times</span>
            <textarea
              name="serviceTimes"
              defaultValue={formState.values.serviceTimes}
              placeholder="Enter one service per line"
              required
            />
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
            />
            <FieldError message={formState.errors.statementOfFaith} />
          </label>
        </div>
      </section>

      <section className="form-section panel">
        <h3>Location and contact</h3>
        <div className="form-grid">
          <label className="field field--full">
            <span className="field__label">Address line 1</span>
            <input name="addressLine1" defaultValue={formState.values.addressLine1} required />
            <FieldError message={formState.errors.addressLine1} />
          </label>

          <label className="field field--full">
            <span className="field__label">Address line 2</span>
            <input name="addressLine2" defaultValue={formState.values.addressLine2} />
          </label>

          <label className="field">
            <span className="field__label">City</span>
            <input name="city" defaultValue={formState.values.city} required />
            <FieldError message={formState.errors.city} />
          </label>

          <label className="field">
            <span className="field__label">County</span>
            <input name="county" defaultValue={formState.values.county} />
          </label>

          <label className="field">
            <span className="field__label">State</span>
            <input
              name="stateCode"
              maxLength={2}
              defaultValue={formState.values.stateCode}
              required
            />
            <FieldError message={formState.errors.stateCode} />
          </label>

          <label className="field">
            <span className="field__label">ZIP code</span>
            <input name="postalCode" defaultValue={formState.values.postalCode} required />
            <FieldError message={formState.errors.postalCode} />
          </label>

          <label className="field">
            <span className="field__label">Phone number</span>
            <input name="phone" defaultValue={formState.values.phone} required />
            <FieldError message={formState.errors.phone} />
          </label>

          <label className="field">
            <span className="field__label">Email address</span>
            <input name="email" type="email" defaultValue={formState.values.email} required />
            <FieldError message={formState.errors.email} />
          </label>

          <label className="field">
            <span className="field__label">Website URL</span>
            <input name="websiteUrl" type="url" defaultValue={formState.values.websiteUrl} />
            <FieldError message={formState.errors.websiteUrl} />
          </label>

          <label className="field">
            <span className="field__label">Facebook URL</span>
            <input name="facebookUrl" type="url" defaultValue={formState.values.facebookUrl} />
            <FieldError message={formState.errors.facebookUrl} />
          </label>

          <label className="field">
            <span className="field__label">YouTube URL</span>
            <input name="youtubeUrl" type="url" defaultValue={formState.values.youtubeUrl} />
            <FieldError message={formState.errors.youtubeUrl} />
          </label>

          <label className="field">
            <span className="field__label">Instagram URL</span>
            <input name="instagramUrl" type="url" defaultValue={formState.values.instagramUrl} />
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
          </label>

          <label className="field">
            <span className="field__label">Online giving link</span>
            <input
              name="onlineGivingUrl"
              type="url"
              defaultValue={formState.values.onlineGivingUrl}
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
          </label>

          <label className="field field--full">
            <span className="field__label">Visitor parking details</span>
            <textarea
              name="visitorParkingDetails"
              defaultValue={formState.values.visitorParkingDetails}
            />
          </label>

          <label className="field field--full">
            <span className="field__label">First-time visitor notes</span>
            <textarea
              name="firstTimeVisitorNotes"
              defaultValue={formState.values.firstTimeVisitorNotes}
            />
          </label>

          <label className="field field--full">
            <span className="field__label">Accessibility details</span>
            <textarea
              name="accessibilityDetails"
              defaultValue={formState.values.accessibilityDetails}
            />
            <span className="field__hint">
              TODO for a future phase: add address autocomplete and geocoding.
            </span>
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
        <h3>Logo and photos</h3>
        <div className="form-grid">
          <div className="field field--full">
            <span className="field__label">Current logo</span>
            {church.logoSrc ? (
              <div className="portal-media-card">
                <Image
                  src={church.logoSrc}
                  alt={`${church.name} logo`}
                  width={160}
                  height={160}
                  className="admin-media-card__image admin-media-card__image--square"
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    name="removeLogo"
                    defaultChecked={formState.values.removeLogo}
                  />
                  <span>Remove current logo</span>
                </label>
              </div>
            ) : (
              <p className="supporting-text">No church logo is currently saved.</p>
            )}
          </div>

          <label className="field">
            <span className="field__label">Upload new logo</span>
            <input name="churchLogo" type="file" accept=".png,.jpg,.jpeg,.webp" />
            <span className="field__hint">PNG, JPG, or WebP. Maximum 512x512 pixels.</span>
            <FieldError message={formState.errors.churchLogo} />
          </label>

          <label className="field field--full">
            <span className="field__label">Upload new photos</span>
            <input name="churchPhotos" type="file" accept=".png,.jpg,.jpeg,.webp" multiple />
            <span className="field__hint">Keep or upload up to 4 photos total.</span>
            <FieldError message={formState.errors.churchPhotos} />
          </label>
        </div>

        <div className="admin-media-grid">
          {church.photos.length === 0 ? (
            <p className="supporting-text">No church photos are currently saved.</p>
          ) : (
            church.photos.map((photo) => (
              <div key={photo.id} className="panel admin-media-card portal-media-card">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={220}
                  height={160}
                  className="admin-media-card__image"
                />
                <label className="checkbox-field">
                  <input type="checkbox" name={`keepPhoto_${photo.id}`} defaultChecked />
                  <span>Keep this photo</span>
                </label>
                <label className="field">
                  <span className="field__label">Display order</span>
                  <input
                    name={`photoOrder_${photo.id}`}
                    type="number"
                    min={1}
                    defaultValue={photo.sortOrder}
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="submission-form__actions">
        <SubmitButton />
      </div>
    </form>
  );
}

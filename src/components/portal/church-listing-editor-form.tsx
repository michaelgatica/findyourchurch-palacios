"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { ServiceTimesFieldset } from "@/components/service-times-fieldset";
import { updateChurchListingAction } from "@/lib/actions/portal";
import {
  createChurchListingFormState,
} from "@/lib/portal-church-form-state";
import { denominationOptions, worshipStyleOptions } from "@/lib/data/options";
import type { ChurchRecord } from "@/lib/types/directory";

const maximumUploadSizeInBytes = 8 * 1024 * 1024;
const maximumTotalUploadSizeInBytes = 45 * 1024 * 1024;
const maximumPhotoUploadCount = 4;

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="field__error">{message}</p>;
}

function FormErrorSummary({
  message,
  errors,
}: {
  message?: string;
  errors: Record<string, string | undefined>;
}) {
  if (!message) {
    return null;
  }

  const uniqueErrors = Array.from(
    new Set(Object.values(errors).filter((error): error is string => Boolean(error))),
  );

  return (
    <div className="form-alert" role="alert">
      <p>{message}</p>
      {uniqueErrors.length > 0 ? (
        <ul className="form-alert__list">
          {uniqueErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending || disabled}>
      {pending ? "Saving changes..." : "Save church listing changes"}
    </button>
  );
}

function UploadSelectionSummary({
  selectedLogoFile,
  selectedPhotoFiles,
  errorMessage,
}: {
  selectedLogoFile: File | null;
  selectedPhotoFiles: File[];
  errorMessage?: string;
}) {
  if (!selectedLogoFile && selectedPhotoFiles.length === 0 && !errorMessage) {
    return null;
  }

  return (
    <div
      className={
        errorMessage
          ? "upload-selection-summary upload-selection-summary--error"
          : "upload-selection-summary"
      }
      aria-live="polite"
    >
      {errorMessage ? <p>{errorMessage}</p> : null}
      {selectedLogoFile ? (
        <p>
          Logo selected: <strong>{selectedLogoFile.name}</strong>{" "}
          ({formatFileSize(selectedLogoFile.size)})
        </p>
      ) : null}
      {selectedPhotoFiles.length > 0 ? (
        <div>
          <p>
            {selectedPhotoFiles.length} photo{selectedPhotoFiles.length === 1 ? "" : "s"} selected.
            Photos upload after you click save.
          </p>
          <ul>
            {selectedPhotoFiles.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                {file.name} ({formatFileSize(file.size)})
              </li>
            ))}
          </ul>
        </div>
      ) : selectedLogoFile ? (
        <p>Logo uploads after you click save.</p>
      ) : null}
    </div>
  );
}

export function ChurchListingEditorForm({ church }: { church: ChurchRecord }) {
  const initialState = createChurchListingFormState(church);
  const [state, formAction] = useActionState(updateChurchListingAction, initialState);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([]);
  const [keptPhotoIds, setKeptPhotoIds] = useState(
    () => new Set(church.photos.map((photo) => photo.id)),
  );
  const formState = state ?? initialState;
  const selectedUploadError = useMemo(() => {
    const selectedFiles = [
      ...(selectedLogoFile ? [selectedLogoFile] : []),
      ...selectedPhotoFiles,
    ];
    const oversizedFile = selectedFiles.find((file) => file.size > maximumUploadSizeInBytes);
    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);

    if (oversizedFile) {
      return `${oversizedFile.name} is ${formatFileSize(
        oversizedFile.size,
      )}. Please choose images that are 8 MB or smaller.`;
    }

    if (selectedPhotoFiles.length > maximumPhotoUploadCount) {
      return `Please upload no more than ${maximumPhotoUploadCount} new photos at one time.`;
    }

    if (keptPhotoIds.size + selectedPhotoFiles.length > maximumPhotoUploadCount) {
      return `You are keeping ${keptPhotoIds.size} existing photo${
        keptPhotoIds.size === 1 ? "" : "s"
      } and adding ${selectedPhotoFiles.length}. Keep the total at ${maximumPhotoUploadCount} photos or fewer.`;
    }

    if (totalSize > maximumTotalUploadSizeInBytes) {
      return `The selected uploads total ${formatFileSize(
        totalSize,
      )}. Please keep one save under ${formatFileSize(maximumTotalUploadSizeInBytes)}.`;
    }

    return undefined;
  }, [keptPhotoIds.size, selectedLogoFile, selectedPhotoFiles]);

  return (
    <form
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
        <FormErrorSummary message={formState.formError} errors={formState.errors} />
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
              placeholder="church-name"
            />
            <span className="field__hint">
              Optional. This can create a short share link like
              {" "}
              <strong>/church-name</strong>.
            </span>
            <FieldError message={formState.errors.customShareSlug} />
          </label>

          <label className="field field--full">
            <span className="field__label">Short church description</span>
            <textarea
              name="churchDescription"
              maxLength={500}
              defaultValue={formState.values.churchDescription}
              required
            />
            <span className="field__hint">
              Keep this to one warm paragraph. Maximum 500 characters.
            </span>
            <FieldError message={formState.errors.churchDescription} />
          </label>

          <ServiceTimesFieldset
            serviceTimesText={formState.values.serviceTimes}
            errorMessage={formState.errors.serviceTimes}
          />

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
            <input
              name="churchLogo"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                setSelectedLogoFile(event.currentTarget.files?.[0] ?? null);
              }}
            />
            <span className="field__hint">
              PNG, JPG, or WebP. Square logos are preferred. Maximum 8 MB.
            </span>
            <FieldError message={formState.errors.churchLogo} />
          </label>

          <label className="field field--full">
            <span className="field__label">Upload new photos</span>
            <input
              name="churchPhotos"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              multiple
              onChange={(event) => {
                setSelectedPhotoFiles(Array.from(event.currentTarget.files ?? []));
              }}
            />
            <span className="field__hint">
              Keep or upload up to 4 photos total. Uncheck an existing photo before adding a
              replacement.
            </span>
            <FieldError message={formState.errors.churchPhotos} />
          </label>
        </div>

        <UploadSelectionSummary
          selectedLogoFile={selectedLogoFile}
          selectedPhotoFiles={selectedPhotoFiles}
          errorMessage={selectedUploadError}
        />

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
                  <input
                    type="checkbox"
                    name={`keepPhoto_${photo.id}`}
                    checked={keptPhotoIds.has(photo.id)}
                    onChange={(event) => {
                      setKeptPhotoIds((currentIds) => {
                        const nextIds = new Set(currentIds);

                        if (event.currentTarget.checked) {
                          nextIds.add(photo.id);
                        } else {
                          nextIds.delete(photo.id);
                        }

                        return nextIds;
                      });
                    }}
                  />
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
        {selectedUploadError ? (
          <div className="form-alert form-alert--inline" role="alert">
            <p>{selectedUploadError}</p>
          </div>
        ) : formState.formError ? (
          <div className="form-alert form-alert--inline" role="alert">
            <p>{formState.formError}</p>
            {Object.values(formState.errors).some(Boolean) ? (
              <ul className="form-alert__list">
                {Array.from(
                  new Set(
                    Object.values(formState.errors).filter(
                      (error): error is string => Boolean(error),
                    ),
                  ),
                ).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <SubmitButton disabled={Boolean(selectedUploadError)} />
      </div>
    </form>
  );
}

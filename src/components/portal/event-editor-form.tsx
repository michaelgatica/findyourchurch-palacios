import Image from "next/image";
import Link from "next/link";

import { saveEventAction } from "@/lib/actions/portal-events";
import {
  audienceAndMinistryOptions,
  primaryEventTypeOptions,
} from "@/lib/data/event-taxonomy";
import { buildGoogleCalendarUrl } from "@/lib/event-utils";
import type { ChurchRecord } from "@/lib/types/directory";
import type { EventRecord } from "@/lib/types/events";

function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toTimeInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  })
    .format(new Date(value))
    .replace("24:", "00:");
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((valuePart) => valuePart.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour").replace("24", "00")}:${part("minute")}`;
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function isSelected(value: string, values?: string[]) {
  return values?.includes(value) ?? false;
}

export function EventEditorForm({
  church,
  event,
  errorMessage,
  successMessage,
}: {
  church: ChurchRecord;
  event?: EventRecord | null;
  errorMessage?: string;
  successMessage?: string;
}) {
  const isPublished = event?.status === "published" || event?.status === "unlisted";
  const customTags = event?.customTags?.join(", ") ?? "";
  const languages = event?.languages?.join(", ") ?? "English";
  const primaryTypeSlug =
    primaryEventTypeOptions.find((option) => option.label === event?.primaryType)?.slug ??
    (event?.primaryType ? "other" : "");
  const externalRegistrationLabel =
    event?.registration.externalRegistrationLabel ??
    (event?.registration.mode === "google_forms" ? "Register with Google Forms" : "Register");
  const hasActiveInternalRegistration = Boolean(
    event?.registration.setupEnabled &&
      (event.registration.mode === "simple_rsvp" || event.registration.mode === "internal_custom"),
  );

  return (
    <form action={saveEventAction} className="event-editor-form" encType="multipart/form-data">
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <input type="hidden" name="churchId" value={church.id} />

      {errorMessage ? <div className="form-alert" role="alert">{errorMessage}</div> : null}
      {successMessage ? (
        <div className="form-alert form-alert--success" role="status">
          {successMessage}
        </div>
      ) : null}

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 1</p>
        <h2>Basic information</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Event title <span className="field__required">Required</span></span>
            <input name="title" defaultValue={event?.title ?? ""} maxLength={120} required />
          </label>
          <label className="field">
            <span className="field__label">Host ministry</span>
            <input name="hostMinistry" defaultValue={event?.hostMinistry ?? ""} placeholder="Youth Ministry, Women's Ministry, Outreach Team" />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Short summary <span className="field__required">Required</span></span>
          <textarea name="summary" defaultValue={event?.summary ?? ""} maxLength={220} required rows={3} />
          <span className="field__hint">Brief public card description. Keep it under 220 characters.</span>
        </label>
        <label className="field">
          <span className="field__label">Full description <span className="field__required">Required</span></span>
          <textarea name="description" defaultValue={event?.description ?? ""} maxLength={3000} required rows={6} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Primary event type <span className="field__required">Required</span></span>
            <select name="primaryType" defaultValue={primaryTypeSlug} required>
              <option value="">Choose type</option>
              {primaryEventTypeOptions.map((option) => (
                <option key={option.slug} value={option.slug}>{option.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">If Other, enter type</span>
            <input name="otherPrimaryType" defaultValue={primaryTypeSlug === "other" ? event?.primaryType : ""} />
          </label>
        </div>
        <fieldset className="event-checkbox-grid">
          <legend>Audience and ministry tags</legend>
          {audienceAndMinistryOptions.map((option) => (
            <label key={option.slug} className="event-checkbox-pill">
              <input
                type="checkbox"
                name="audienceTags"
                value={option.slug}
                defaultChecked={isSelected(option.label, event?.audienceTags)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Custom tags</span>
            <input name="customTags" defaultValue={customTags} placeholder="Prayer, outreach, family night" />
          </label>
          <label className="field">
            <span className="field__label">Languages</span>
            <input name="languages" defaultValue={languages} placeholder="English, Spanish" />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Contact name</span>
            <input name="contactName" defaultValue={event?.contactName ?? ""} />
          </label>
          <label className="field">
            <span className="field__label">Contact email</span>
            <input name="contactEmail" type="email" defaultValue={event?.contactEmail ?? ""} />
          </label>
          <label className="field">
            <span className="field__label">Contact phone</span>
            <input name="contactPhone" defaultValue={event?.contactPhone ?? ""} />
          </label>
        </div>
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 2</p>
        <h2>Date and time</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Start date <span className="field__required">Required</span></span>
            <input name="startDate" type="date" defaultValue={toDateInputValue(event?.startsAt) || getDefaultStartDate()} required />
          </label>
          <label className="field">
            <span className="field__label">Start time</span>
            <input name="startTime" type="time" defaultValue={toTimeInputValue(event?.startsAt)} />
          </label>
          <label className="field">
            <span className="field__label">End date</span>
            <input name="endDate" type="date" defaultValue={toDateInputValue(event?.endsAt)} />
          </label>
          <label className="field">
            <span className="field__label">End time</span>
            <input name="endTime" type="time" defaultValue={toTimeInputValue(event?.endsAt)} />
          </label>
        </div>
        <div className="event-inline-options">
          <label><input type="checkbox" name="allDay" defaultChecked={event?.allDay ?? false} /> All-day event</label>
          <label className="field field--compact">
            <span className="field__label">Time zone</span>
            <select name="timeZone" defaultValue={event?.timeZone ?? "America/Chicago"}>
              <option value="America/Chicago">Central Time</option>
            </select>
          </label>
        </div>
        <div className="form-grid__note">
          Recurring events are planned for a later phase. This editor intentionally supports single events only right now.
          <input type="hidden" name="recurrenceMode" value="single" />
        </div>
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 3</p>
        <h2>Location</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Location type</span>
            <select name="locationMode" defaultValue={event?.locationMode ?? "in_person"}>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Venue name</span>
            <input name="venueName" defaultValue={event?.venueName ?? church.name} />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Street address</span>
            <input name="addressLine1" defaultValue={event?.address?.line1 ?? church.address.line1} />
          </label>
          <label className="field">
            <span className="field__label">Address line 2</span>
            <input name="addressLine2" defaultValue={event?.address?.line2 ?? church.address.line2 ?? ""} />
          </label>
          <label className="field">
            <span className="field__label">City</span>
            <input name="city" defaultValue={event?.address?.city ?? church.address.city} />
          </label>
          <label className="field">
            <span className="field__label">State</span>
            <input name="stateCode" defaultValue={event?.address?.stateCode ?? church.address.stateCode} maxLength={2} />
          </label>
          <label className="field">
            <span className="field__label">ZIP code</span>
            <input name="postalCode" defaultValue={event?.address?.postalCode ?? church.address.postalCode} />
          </label>
          <label className="field">
            <span className="field__label">Online meeting or stream URL</span>
            <input name="onlineUrl" type="url" defaultValue={event?.onlineUrl ?? ""} placeholder="https://" />
          </label>
          <label className="field">
            <span className="field__label">Map or directions URL</span>
            <input name="mapUrl" type="url" defaultValue={event?.mapUrl ?? ""} placeholder="https://" />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Accessibility information</span>
          <textarea name="accessibilityDetails" defaultValue={event?.accessibilityDetails ?? ""} rows={3} />
        </label>
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 4</p>
        <h2>Event details</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Cost status</span>
            <select name="costStatus" defaultValue={event?.costStatus ?? "free"}>
              <option value="free">Free</option>
              <option value="donation_requested">Donation requested</option>
              <option value="fee_required">Fee required</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Fee or donation details</span>
            <input name="costDetails" defaultValue={event?.costDetails ?? ""} />
          </label>
          <label className="field">
            <span className="field__label">External information/payment link</span>
            <input name="informationUrl" type="url" defaultValue={event?.informationUrl ?? ""} placeholder="https://" />
          </label>
          <label className="field">
            <span className="field__label">Capacity</span>
            <input name="capacity" type="number" min={1} defaultValue={event?.registration.capacity ?? ""} readOnly={hasActiveInternalRegistration} />
          </label>
        </div>
        <div className="event-inline-options">
          <label><input type="checkbox" name="childcareProvided" defaultChecked={event?.childcareProvided ?? false} /> Childcare available</label>
          <label><input type="checkbox" name="mealProvided" defaultChecked={event?.mealProvided ?? false} /> Meal or refreshments</label>
        </div>
        <label className="field">
          <span className="field__label">Meal details</span>
          <input name="mealDetails" defaultValue={event?.mealDetails ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Additional instructions</span>
          <textarea name="additionalInstructions" defaultValue={event?.additionalInstructions ?? ""} rows={3} />
        </label>
        <label className="field">
          <span className="field__label">Visibility</span>
          <select name="visibility" defaultValue={event?.visibility ?? "public"}>
            <option value="public">Public calendar</option>
            <option value="unlisted">Unlisted direct link</option>
          </select>
        </label>
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 5</p>
        <h2>Registration</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Registration mode</span>
            <select name="registrationMode" defaultValue={event?.registration.mode ?? "none"}>
              <option value="none">No registration</option>
              <option value="simple_rsvp">Simple RSVP</option>
              <option value="internal_custom">Internal custom registration</option>
              <option value="google_forms">Google Forms registration</option>
              <option value="external">Other external registration</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Registration opens</span>
            <input name="registrationOpensAt" type="datetime-local" defaultValue={toDateTimeInputValue(event?.registration.opensAt)} readOnly={hasActiveInternalRegistration} />
          </label>
          <label className="field">
            <span className="field__label">Registration closes</span>
            <input name="registrationClosesAt" type="datetime-local" defaultValue={toDateTimeInputValue(event?.registration.closesAt)} readOnly={hasActiveInternalRegistration} />
          </label>
          <label className="field">
            <span className="field__label">External registration URL</span>
            <input name="externalRegistrationUrl" type="url" defaultValue={event?.registration.externalRegistrationUrl ?? ""} placeholder="https://" />
          </label>
          <label className="field">
            <span className="field__label">External button label</span>
            <input name="externalRegistrationLabel" defaultValue={externalRegistrationLabel} />
          </label>
        </div>
        {hasActiveInternalRegistration && event ? (
          <p className="field__hint">
            This event has an active internal form. Manage capacity, waitlist, dates, messages, and questions in{" "}
            <Link href={`/portal/events/${event.id}/registration/form`} className="text-link">registration setup</Link>.
          </p>
        ) : (
          <p className="field__hint">
            Choose Simple RSVP or Internal custom registration, save the event, then activate its registration form before publishing a signup button.
          </p>
        )}
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Step 6</p>
        <h2>Flyer and media</h2>
        {event?.flyerImage?.src ? (
          <div className="event-flyer-preview">
            <Image src={event.flyerImage.src} alt={event.flyerImage.alt} width={360} height={220} />
            <label><input type="checkbox" name="removeFlyer" /> Remove current flyer</label>
          </div>
        ) : null}
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Flyer upload</span>
            <input name="flyer" type="file" accept="image/jpeg,image/png,image/webp" />
            <span className="field__hint">JPG, PNG, or WebP only. Maximum 8 MB. Minimum 400x300 pixels.</span>
          </label>
          <label className="field">
            <span className="field__label">Flyer alt text</span>
            <input name="flyerAlt" defaultValue={event?.flyerImage?.alt ?? ""} />
          </label>
        </div>
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Preview</p>
        <h2>{event?.title ?? "Your event preview"}</h2>
        <p className="supporting-text">
          Preview the public calendar card and event page after saving. Existing published events can also be opened directly.
        </p>
        <div className="button-row">
          {event ? (
            <>
              <a href={`/events/${event.slug}`} className="button button--ghost" target="_blank" rel="noreferrer">
                Open public event page
              </a>
              <a href={buildGoogleCalendarUrl(event)} className="button button--ghost" target="_blank" rel="noreferrer">
                Test Google Calendar link
              </a>
            </>
          ) : null}
          <button type="submit" name="intent" value={isPublished ? "update" : "save_draft"} className="button button--ghost">
            {event ? "Save changes" : "Save draft"}
          </button>
          <button type="submit" name="intent" value="publish" className="button button--primary">
            {isPublished ? "Update published event" : "Publish event"}
          </button>
        </div>
      </section>
    </form>
  );
}

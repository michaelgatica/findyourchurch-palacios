"use client";

import { useState } from "react";

import { RegistrationFieldsEditor } from "@/components/registration/registration-fields-editor";
import { saveRegistrationSetupAction } from "@/lib/actions/registrations";
import { registrationPresets } from "@/lib/data/registration-presets";
import {
  registrationFieldTypes,
  sensitiveDataClassifications,
  type EventRegistrationConfigurationRecord,
  type RegistrationFieldSchema,
  type RegistrationFormSection,
} from "@/lib/types/registrations";

const participantFieldTypes = registrationFieldTypes.filter(
  (type) =>
    type !== "section_heading" &&
    type !== "informational_text" &&
    type !== "repeating_attendee_group" &&
    type !== "repeating_child_group",
);

function localDateTimeValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function createField(type: RegistrationFieldSchema["type"] = "short_text"): RegistrationFieldSchema {
  const id = `field-${crypto.randomUUID()}`;
  const repeating = type === "repeating_attendee_group" || type === "repeating_child_group";
  return {
    id,
    type,
    label: repeating ? (type === "repeating_child_group" ? "Children" : "Attendees") : "New field",
    required: false,
    options: [
      { id: `option-${crypto.randomUUID()}`, label: "Option 1", value: "option_1" },
    ],
    displayOrder: 0,
    includeInExports: true,
    sensitiveClassification: type === "repeating_child_group" ? "minor" : "none",
    participantFields: repeating
      ? [
          {
            id: "participant_name",
            type: "full_name",
            label: "Name",
            required: true,
            options: [],
            displayOrder: 0,
            includeInExports: true,
            sensitiveClassification: type === "repeating_child_group" ? "minor" : "none",
          },
        ]
      : undefined,
  };
}

function createParticipantField(
  type: RegistrationFieldSchema["type"] = "short_text",
): RegistrationFieldSchema {
  const field = createField(type);
  return {
    ...field,
    id: `participant-${crypto.randomUUID()}`,
    label: "New participant field",
    participantFields: undefined,
  };
}

function normalizeOrder(sections: RegistrationFormSection[]) {
  return sections.map((section, sectionIndex) => ({
    ...section,
    displayOrder: sectionIndex,
    fields: section.fields.map((field, fieldIndex) => ({ ...field, displayOrder: fieldIndex })),
  }));
}

function clonePresetSections(sections: RegistrationFormSection[]) {
  return normalizeOrder(structuredClone(sections));
}

function blankSections(): RegistrationFormSection[] {
  return [{
    id: `section-${crypto.randomUUID()}`,
    title: "Registration information",
    description: "",
    displayOrder: 0,
    fields: [createField("full_name")],
  }];
}

export function RegistrationFormBuilder(props: {
  eventId: string;
  churchId: string;
  eventTitle: string;
  configuration: EventRegistrationConfigurationRecord;
  initialSections?: RegistrationFormSection[] | null;
  initialFormTitle?: string | null;
  initialPresetId?: string | null;
}) {
  const [mode, setMode] = useState(props.configuration.mode);
  const [presetId, setPresetId] = useState(props.initialPresetId ?? "");
  const [sections, setSections] = useState<RegistrationFormSection[]>(
    () => props.initialSections?.length ? clonePresetSections(props.initialSections) : blankSections(),
  );
  const [previewVisible, setPreviewVisible] = useState(false);
  const sensitiveFieldCount = sections
    .flatMap((section) => section.fields)
    .flatMap((field) => [field, ...(field.participantFields ?? [])])
    .filter(
      (field) =>
        field.sensitiveClassification !== "none" &&
        field.sensitiveClassification !== "standard_contact",
    ).length;

  function updateSection(sectionId: string, updates: Partial<RegistrationFormSection>) {
    setSections((current) => current.map((section) => section.id === sectionId ? { ...section, ...updates } : section));
  }

  function updateField(sectionId: string, fieldId: string, updates: Partial<RegistrationFieldSchema>) {
    setSections((current) => current.map((section) => section.id !== sectionId ? section : {
      ...section,
      fields: section.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
    }));
  }

  function updateParticipantFields(
    sectionId: string,
    groupFieldId: string,
    update: (participantFields: RegistrationFieldSchema[]) => RegistrationFieldSchema[],
  ) {
    setSections((current) => normalizeOrder(current.map((section) => section.id !== sectionId ? section : {
      ...section,
      fields: section.fields.map((field) => field.id !== groupFieldId ? field : {
        ...field,
        participantFields: update(field.participantFields ?? []).map((participantField, index) => ({
          ...participantField,
          displayOrder: index,
        })),
      }),
    })));
  }

  function updateParticipantField(
    sectionId: string,
    groupFieldId: string,
    participantFieldId: string,
    updates: Partial<RegistrationFieldSchema>,
  ) {
    updateParticipantFields(sectionId, groupFieldId, (participantFields) =>
      participantFields.map((participantField) =>
        participantField.id === participantFieldId
          ? { ...participantField, ...updates }
          : participantField,
      ),
    );
  }

  function moveField(sectionId: string, fieldIndex: number, direction: -1 | 1) {
    setSections((current) => normalizeOrder(current.map((section) => {
      if (section.id !== sectionId) return section;
      const nextIndex = fieldIndex + direction;
      if (nextIndex < 0 || nextIndex >= section.fields.length) return section;
      const fields = [...section.fields];
      [fields[fieldIndex], fields[nextIndex]] = [fields[nextIndex], fields[fieldIndex]];
      return { ...section, fields };
    })));
  }

  function applyPreset(nextPresetId: string) {
    setPresetId(nextPresetId);
    const preset = registrationPresets.find((candidate) => candidate.id === nextPresetId);
    if (preset) setSections(clonePresetSections(preset.sections));
  }

  function changeMode(nextMode: EventRegistrationConfigurationRecord["mode"]) {
    setMode(nextMode);
    if (nextMode === "simple_rsvp" && mode !== "simple_rsvp") {
      applyPreset("simple_rsvp");
    }
  }

  const availableConditionFields = sections.flatMap((section) => section.fields).filter(
    (field) => field.type !== "section_heading" && field.type !== "informational_text",
  );
  const internalMode = mode === "simple_rsvp" || mode === "internal_custom";

  return (
    <form action={saveRegistrationSetupAction} className="registration-builder">
      <input type="hidden" name="eventId" value={props.eventId} />
      <input type="hidden" name="churchId" value={props.churchId} />
      <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
      <input type="hidden" name="presetId" value={presetId} />

      <section className="panel event-editor-section">
        <p className="eyebrow eyebrow--gold">Registration mode</p>
        <h2>How people will register</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Registration mode</span>
            <select name="mode" value={mode} onChange={(event) => changeMode(event.target.value as EventRegistrationConfigurationRecord["mode"])}>
              <option value="none">No registration</option>
              <option value="simple_rsvp">Simple RSVP</option>
              <option value="internal_custom">Internal custom registration</option>
              <option value="google_forms">Google Forms</option>
              <option value="external">Other external registration</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Form title</span>
            <input name="formTitle" defaultValue={props.initialFormTitle ?? `${props.eventTitle} registration`} maxLength={160} />
          </label>
        </div>
        {!internalMode && mode !== "none" ? (
          <div className="form-grid__note">
            External registration URLs are managed in the event editor. They are validated as HTTPS links and open in a new tab with an external-service notice.
          </div>
        ) : null}
      </section>

      <section className="panel event-editor-section">
        <p className="eyebrow">Registration window and capacity</p>
        <div className="form-grid">
          <label className="field"><span className="field__label">Opens</span><input name="opensAt" type="datetime-local" defaultValue={localDateTimeValue(props.configuration.opensAt)} /></label>
          <label className="field"><span className="field__label">Closes</span><input name="closesAt" type="datetime-local" defaultValue={localDateTimeValue(props.configuration.closesAt)} /></label>
          <label className="field"><span className="field__label">Capacity</span><input name="capacity" type="number" min={1} max={100000} defaultValue={props.configuration.capacity ?? ""} /></label>
          <label className="field"><span className="field__label">Capacity counts</span><select name="capacityUnit" defaultValue={props.configuration.capacityUnit}><option value="attendees">People attending</option><option value="registrations">Registration submissions</option></select></label>
          <label className="field"><span className="field__label">Maximum attendees per registration</span><input name="maximumAttendeesPerRegistration" type="number" min={1} max={100} defaultValue={props.configuration.maximumAttendeesPerRegistration} required /></label>
          <label className="field"><span className="field__label">Waitlist capacity</span><input name="waitlistCapacity" type="number" min={1} max={100000} defaultValue={props.configuration.waitlistCapacity ?? ""} /></label>
        </div>
        <div className="registration-toggle-grid">
          <label><input type="checkbox" name="waitlistEnabled" defaultChecked={props.configuration.waitlistEnabled} /> Enable waitlist</label>
          <label><input type="checkbox" name="automaticWaitlistPromotion" defaultChecked={props.configuration.automaticWaitlistPromotion} /> Automatically promote in submission order</label>
          <label><input type="checkbox" name="showCapacityStatus" defaultChecked={props.configuration.showCapacityStatus} /> Show capacity status publicly</label>
          <label><input type="checkbox" name="allowRegistrantEditing" defaultChecked={props.configuration.allowRegistrantEditing} /> Allow registrant editing</label>
          <label><input type="checkbox" name="allowRegistrantCancellation" defaultChecked={props.configuration.allowRegistrantCancellation} /> Allow registrant cancellation</label>
          <label><input type="checkbox" name="confirmationEmailEnabled" defaultChecked={props.configuration.confirmationEmailEnabled} /> Send confirmation emails</label>
          <label><input type="checkbox" name="reminderEmailEnabled" defaultChecked={props.configuration.reminderEmailEnabled} /> Enable event reminders</label>
          <label><input type="checkbox" name="organizerNewRegistrationEmail" defaultChecked={props.configuration.organizerNewRegistrationEmail} /> Notify event contact of new registrations</label>
          <label><input type="checkbox" name="organizerDailyDigestEmail" defaultChecked={props.configuration.organizerDailyDigestEmail} /> Enable daily digest job</label>
          <label><input type="checkbox" name="registrationClosingReportEnabled" defaultChecked={props.configuration.registrationClosingReportEnabled} /> Email a final report when registration closes</label>
          <label><input type="checkbox" name="preEventReportEnabled" defaultChecked={props.configuration.preEventReportEnabled} /> Email a report 24 hours before the event</label>
        </div>
        <fieldset className="registration-export-fields registration-scheduled-formats">
          <legend>Scheduled report formats</legend>
          <label className="registration-export-field"><input type="checkbox" name="scheduledReportFormats" value="pdf" defaultChecked={(props.configuration.scheduledReportFormats ?? ["pdf"]).includes("pdf")} /> PDF roster</label>
          <label className="registration-export-field"><input type="checkbox" name="scheduledReportFormats" value="xlsx" defaultChecked={(props.configuration.scheduledReportFormats ?? []).includes("xlsx")} /> Excel workbook</label>
          <p className="field__hint">Scheduled reports go only to the event contact email. No report is scheduled unless its option above is enabled.</p>
        </fieldset>
      </section>

      {internalMode ? (
        <section className="panel event-editor-section">
          <div className="admin-panel__header">
            <div><p className="eyebrow eyebrow--gold">Form builder</p><h2>Registration questions</h2></div>
            <button type="button" className="button button--ghost" onClick={() => setPreviewVisible((value) => !value)}>{previewVisible ? "Close preview" : "Preview exact form"}</button>
          </div>
          <div className="registration-safety-notice">
            <strong>Collect only information your church genuinely needs for this event.</strong>
            <p>Social Security numbers, government ID numbers, driver&apos;s-license numbers, bank information, and payment-card information are prohibited.</p>
            {sensitiveFieldCount > 0 ? <p><strong>{sensitiveFieldCount} sensitive field{sensitiveFieldCount === 1 ? "" : "s"}</strong> will be excluded from standard exports unless deliberately selected.</p> : null}
          </div>
          <label className="field registration-preset-picker">
            <span className="field__label">Start from a preset</span>
            <select value={presetId} onChange={(event) => applyPreset(event.target.value)}>
              <option value="">Blank or current form</option>
              {registrationPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>

          {previewVisible ? (
            <div className="registration-builder-preview"><RegistrationFieldsEditor sections={sections} /></div>
          ) : (
            <div className="registration-builder-sections">
              {sections.map((section, sectionIndex) => (
                <article key={section.id} className="registration-builder-section">
                  <div className="form-grid">
                    <label className="field"><span className="field__label">Section title</span><input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></label>
                    <label className="field"><span className="field__label">Section description</span><input value={section.description ?? ""} onChange={(event) => updateSection(section.id, { description: event.target.value })} /></label>
                  </div>
                  <div className="registration-builder-fields">
                    {section.fields.map((field, fieldIndex) => (
                      <div key={field.id} className="registration-builder-field">
                        <div className="registration-builder-field__header">
                          <strong>{field.label || "Untitled field"}</strong><span>{field.type.replaceAll("_", " ")}</span>
                        </div>
                        <div className="form-grid">
                          <label className="field"><span className="field__label">Public label</span><input value={field.label} maxLength={160} onChange={(event) => updateField(section.id, field.id, { label: event.target.value })} /></label>
                          <label className="field"><span className="field__label">Field type</span><select value={field.type} onChange={(event) => updateField(section.id, field.id, { ...createField(event.target.value as RegistrationFieldSchema["type"]), id: field.id, label: field.label })}>{registrationFieldTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
                          <label className="field"><span className="field__label">Help text</span><input value={field.helpText ?? ""} maxLength={500} onChange={(event) => updateField(section.id, field.id, { helpText: event.target.value })} /></label>
                          <label className="field"><span className="field__label">Placeholder</span><input value={field.placeholder ?? ""} maxLength={160} onChange={(event) => updateField(section.id, field.id, { placeholder: event.target.value })} /></label>
                          <label className="field"><span className="field__label">Sensitive-data classification</span><select value={field.sensitiveClassification} onChange={(event) => updateField(section.id, field.id, { sensitiveClassification: event.target.value as RegistrationFieldSchema["sensitiveClassification"] })}>{sensitiveDataClassifications.map((classification) => <option key={classification} value={classification}>{classification.replaceAll("_", " ")}</option>)}</select></label>
                          <label className="field"><span className="field__label">Options (one per line)</span><textarea rows={3} value={field.options.map((option) => option.label).join("\n")} onChange={(event) => updateField(section.id, field.id, { options: event.target.value.split("\n").map((label, index) => ({ id: field.options[index]?.id ?? `option-${crypto.randomUUID()}`, label: label.trim(), value: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") })).filter((option) => option.label) })} /></label>
                          <label className="field"><span className="field__label">Character limit</span><input type="number" min={1} max={5000} value={field.maxLength ?? ""} onChange={(event) => updateField(section.id, field.id, { maxLength: event.target.value ? Number(event.target.value) : null })} /></label>
                          <label className="field"><span className="field__label">Show when field</span><select value={field.condition?.sourceFieldId ?? ""} onChange={(event) => updateField(section.id, field.id, { condition: event.target.value ? { sourceFieldId: event.target.value, operator: "equals", value: "yes" } : null })}><option value="">Always show</option>{availableConditionFields.filter((candidate) => candidate.id !== field.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select></label>
                          {field.condition ? <><label className="field"><span className="field__label">Condition</span><select value={field.condition.operator} onChange={(event) => updateField(section.id, field.id, { condition: { ...field.condition!, operator: event.target.value as "equals" | "checked" | "greater_than" } })}><option value="equals">Equals</option><option value="checked">Is checked</option><option value="greater_than">Number is greater than</option></select></label><label className="field"><span className="field__label">Condition value</span><input value={String(field.condition.value ?? "")} onChange={(event) => updateField(section.id, field.id, { condition: { ...field.condition!, value: event.target.value } })} /></label></> : null}
                        </div>
                        {field.type === "repeating_attendee_group" || field.type === "repeating_child_group" ? (
                          <div className="registration-participant-builder">
                            <div>
                              <h4>Fields for each {field.type === "repeating_child_group" ? "child" : "attendee"}</h4>
                              <p className="supporting-text">These questions repeat for every participant added to the registration.</p>
                            </div>
                            {(field.participantFields ?? []).map((participantField, participantIndex) => {
                              const siblingFields = field.participantFields ?? [];
                              return (
                                <div key={participantField.id} className="registration-participant-builder__field">
                                  <div className="form-grid">
                                    <label className="field">
                                      <span className="field__label">Public label</span>
                                      <input value={participantField.label} maxLength={160} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { label: event.target.value })} />
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Field type</span>
                                      <select value={participantField.type} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { ...createParticipantField(event.target.value as RegistrationFieldSchema["type"]), id: participantField.id, label: participantField.label })}>
                                        {participantFieldTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                                      </select>
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Help text</span>
                                      <input value={participantField.helpText ?? ""} maxLength={500} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { helpText: event.target.value })} />
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Sensitive-data classification</span>
                                      <select value={participantField.sensitiveClassification} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { sensitiveClassification: event.target.value as RegistrationFieldSchema["sensitiveClassification"] })}>
                                        {sensitiveDataClassifications.map((classification) => <option key={classification} value={classification}>{classification.replaceAll("_", " ")}</option>)}
                                      </select>
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Options (one per line)</span>
                                      <textarea rows={3} value={participantField.options.map((option) => option.label).join("\n")} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { options: event.target.value.split("\n").map((label, index) => ({ id: participantField.options[index]?.id ?? `option-${crypto.randomUUID()}`, label: label.trim(), value: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") })).filter((option) => option.label) })} />
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Character limit</span>
                                      <input type="number" min={1} max={5000} value={participantField.maxLength ?? ""} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { maxLength: event.target.value ? Number(event.target.value) : null })} />
                                    </label>
                                    <label className="field">
                                      <span className="field__label">Show when participant field</span>
                                      <select value={participantField.condition?.sourceFieldId ?? ""} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { condition: event.target.value ? { sourceFieldId: event.target.value, operator: "equals", value: "yes" } : null })}>
                                        <option value="">Always show</option>
                                        {siblingFields.filter((candidate) => candidate.id !== participantField.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                                      </select>
                                    </label>
                                    {participantField.condition ? (
                                      <>
                                        <label className="field"><span className="field__label">Condition</span><select value={participantField.condition.operator} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { condition: { ...participantField.condition!, operator: event.target.value as "equals" | "checked" | "greater_than" } })}><option value="equals">Equals</option><option value="checked">Is checked</option><option value="greater_than">Number is greater than</option></select></label>
                                        <label className="field"><span className="field__label">Condition value</span><input value={String(participantField.condition.value ?? "")} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { condition: { ...participantField.condition!, value: event.target.value } })} /></label>
                                      </>
                                    ) : null}
                                  </div>
                                  <div className="event-inline-options">
                                    <label><input type="checkbox" checked={participantField.required} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { required: event.target.checked })} /> Required</label>
                                    <label><input type="checkbox" checked={participantField.includeInExports} onChange={(event) => updateParticipantField(section.id, field.id, participantField.id, { includeInExports: event.target.checked })} /> Include in standard exports</label>
                                  </div>
                                  <div className="button-row">
                                    <button type="button" className="button button--ghost button--small" aria-label={`Move ${participantField.label || "untitled participant field"} up`} disabled={participantIndex === 0} onClick={() => updateParticipantFields(section.id, field.id, (participantFields) => { const fields = [...participantFields]; [fields[participantIndex - 1], fields[participantIndex]] = [fields[participantIndex], fields[participantIndex - 1]]; return fields; })}>Move up</button>
                                    <button type="button" className="button button--ghost button--small" aria-label={`Move ${participantField.label || "untitled participant field"} down`} disabled={participantIndex === siblingFields.length - 1} onClick={() => updateParticipantFields(section.id, field.id, (participantFields) => { const fields = [...participantFields]; [fields[participantIndex], fields[participantIndex + 1]] = [fields[participantIndex + 1], fields[participantIndex]]; return fields; })}>Move down</button>
                                    <button type="button" className="button button--ghost button--small" aria-label={`Duplicate ${participantField.label || "untitled participant field"}`} onClick={() => updateParticipantFields(section.id, field.id, (participantFields) => [...participantFields.slice(0, participantIndex + 1), { ...structuredClone(participantField), id: `participant-${crypto.randomUUID()}` }, ...participantFields.slice(participantIndex + 1)])}>Duplicate</button>
                                    <button type="button" className="button button--danger button--small" aria-label={`Remove ${participantField.label || "untitled participant field"}`} disabled={siblingFields.length === 1} onClick={() => updateParticipantFields(section.id, field.id, (participantFields) => participantFields.filter((candidate) => candidate.id !== participantField.id))}>Remove</button>
                                  </div>
                                </div>
                              );
                            })}
                            <button type="button" className="button button--ghost button--small" onClick={() => updateParticipantFields(section.id, field.id, (participantFields) => [...participantFields, createParticipantField()])}>
                              Add participant field
                            </button>
                          </div>
                        ) : null}
                        <div className="event-inline-options">
                          <label><input type="checkbox" checked={field.required} onChange={(event) => updateField(section.id, field.id, { required: event.target.checked })} /> Required</label>
                          <label><input type="checkbox" checked={field.includeInExports} onChange={(event) => updateField(section.id, field.id, { includeInExports: event.target.checked })} /> Include in standard exports</label>
                        </div>
                        <div className="button-row">
                          <button type="button" className="button button--ghost button--small" aria-label={`Move ${field.label || "untitled field"} up`} disabled={fieldIndex === 0} onClick={() => moveField(section.id, fieldIndex, -1)}>Move up</button>
                          <button type="button" className="button button--ghost button--small" aria-label={`Move ${field.label || "untitled field"} down`} disabled={fieldIndex === section.fields.length - 1} onClick={() => moveField(section.id, fieldIndex, 1)}>Move down</button>
                          <button type="button" className="button button--ghost button--small" aria-label={`Duplicate ${field.label || "untitled field"}`} onClick={() => setSections((current) => normalizeOrder(current.map((candidate) => candidate.id === section.id ? { ...candidate, fields: [...candidate.fields.slice(0, fieldIndex + 1), { ...structuredClone(field), id: `field-${crypto.randomUUID()}` }, ...candidate.fields.slice(fieldIndex + 1)] } : candidate)))}>Duplicate</button>
                          <button type="button" className="button button--danger button--small" aria-label={`Remove ${field.label || "untitled field"}`} onClick={() => setSections((current) => normalizeOrder(current.map((candidate) => candidate.id === section.id ? { ...candidate, fields: candidate.fields.filter((candidateField) => candidateField.id !== field.id) } : candidate)))}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="button-row">
                    <button type="button" className="button button--ghost button--small" aria-label={`Add field to ${section.title || "untitled section"}`} onClick={() => setSections((current) => normalizeOrder(current.map((candidate) => candidate.id === section.id ? { ...candidate, fields: [...candidate.fields, createField()] } : candidate)))}>Add field</button>
                    {sections.length > 1 ? <button type="button" className="button button--danger button--small" aria-label={`Remove ${section.title || "untitled section"}`} onClick={() => setSections((current) => normalizeOrder(current.filter((candidate) => candidate.id !== section.id)))}>Remove section</button> : null}
                    <span className="supporting-text">Section {sectionIndex + 1}</span>
                  </div>
                </article>
              ))}
              <button type="button" className="button button--ghost" onClick={() => setSections((current) => normalizeOrder([...current, { id: `section-${crypto.randomUUID()}`, title: "New section", description: "", displayOrder: current.length, fields: [createField()] }]))}>Add section</button>
            </div>
          )}
        </section>
      ) : null}

      <section className="panel event-editor-section">
        <p className="eyebrow">Messages and retention</p>
        <div className="form-grid">
          <label className="field"><span className="field__label">Success message</span><textarea name="successMessage" rows={3} defaultValue={props.configuration.successMessage} required maxLength={1000} /></label>
          <label className="field"><span className="field__label">Registration closed message</span><textarea name="closedMessage" rows={3} defaultValue={props.configuration.closedMessage} required maxLength={1000} /></label>
          <label className="field"><span className="field__label">Waitlist message</span><textarea name="waitlistMessage" rows={3} defaultValue={props.configuration.waitlistMessage} required maxLength={1000} /></label>
          <label className="field"><span className="field__label">Required consent text</span><textarea name="consentText" rows={3} defaultValue={props.configuration.consentText ?? ""} maxLength={3000} /></label>
          <label className="field"><span className="field__label">Retain registration data after event (days)</span><input name="retentionDays" type="number" min={30} max={730} defaultValue={props.configuration.retentionDays} required /><span className="field__hint">Default: 180 days. Choose a shorter period when collecting information about minors.</span></label>
        </div>
      </section>

      <div className="event-editor-actions">
        <button type="submit" name="intent" value="save" className="button button--ghost">Save draft setup</button>
        <button type="submit" name="intent" value="activate" className="button button--primary" disabled={internalMode && sections.length === 0}>Activate registration</button>
      </div>
    </form>
  );
}

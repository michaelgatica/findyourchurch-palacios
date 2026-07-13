"use client";

import { useState } from "react";

import { conditionIsMet } from "@/lib/registration-utils";
import type {
  RegistrationAnswerValue,
  RegistrationFieldSchema,
  RegistrationFormSection,
} from "@/lib/types/registrations";

function inputTypeForField(field: RegistrationFieldSchema) {
  if (field.type === "email") return "email";
  if (field.type === "phone") return "tel";
  if (field.type === "number") return "number";
  if (field.type === "date") return "date";
  return "text";
}

function isRepeatingField(field: RegistrationFieldSchema) {
  return field.type === "repeating_attendee_group" || field.type === "repeating_child_group";
}

function RegistrationFieldControl(props: {
  field: RegistrationFieldSchema;
  value: RegistrationAnswerValue | undefined;
  onChange: (value: RegistrationAnswerValue) => void;
  readOnly: boolean;
  inputId: string;
}) {
  const { field, value, onChange, readOnly, inputId } = props;
  const commonProps = {
    id: inputId,
    disabled: readOnly,
    required: field.required,
    "aria-describedby": field.helpText ? `${inputId}-help` : undefined,
  };

  if (field.type === "long_text") {
    return (
      <textarea
        {...commonProps}
        rows={4}
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        minLength={field.minLength ?? undefined}
        maxLength={field.maxLength ?? 2000}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "dropdown") {
    return (
      <select {...commonProps} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose an option</option>
        {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.type === "radio" || field.type === "yes_no") {
    const options = field.type === "yes_no"
      ? [{ id: "yes", label: "Yes", value: "yes" }, { id: "no", label: "No", value: "no" }]
      : field.options;
    return (
      <div className="registration-choice-grid" role="radiogroup" aria-labelledby={`${inputId}-label`}>
        {options.map((option) => (
          <label key={option.id} className="registration-choice">
            <input
              type="radio"
              name={inputId}
              value={option.value}
              checked={value === option.value}
              disabled={readOnly}
              required={field.required}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "multiple_checkboxes" || field.type === "multi_select") {
    const selectedValues = Array.isArray(value) ? value.map(String) : [];
    if (field.type === "multi_select") {
      return (
        <select
          {...commonProps}
          multiple
          value={selectedValues}
          onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}
        >
          {field.options.map((option) => <option key={option.id} value={option.value}>{option.label}</option>)}
        </select>
      );
    }
    return (
      <div className="registration-choice-grid">
        {field.options.map((option) => (
          <label key={option.id} className="registration-choice">
            <input
              type="checkbox"
              value={option.value}
              checked={selectedValues.includes(option.value)}
              disabled={readOnly}
              onChange={(event) => {
                onChange(event.target.checked
                  ? [...selectedValues, option.value]
                  : selectedValues.filter((entry) => entry !== option.value));
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "single_checkbox" || field.type === "consent") {
    return (
      <label className="registration-consent">
        <input
          {...commonProps}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.helpText || "I agree."}</span>
      </label>
    );
  }

  return (
    <input
      {...commonProps}
      type={inputTypeForField(field)}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      placeholder={field.placeholder}
      min={field.minValue ?? undefined}
      max={field.maxValue ?? undefined}
      minLength={field.minLength ?? undefined}
      maxLength={field.maxLength ?? (field.type === "electronic_acknowledgment" ? 160 : 500)}
      onChange={(event) => onChange(field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)}
    />
  );
}

function RepeatingGroup(props: {
  field: RegistrationFieldSchema;
  value: RegistrationAnswerValue | undefined;
  onChange: (value: RegistrationAnswerValue) => void;
  readOnly: boolean;
}) {
  const records = Array.isArray(props.value) && props.value.every((entry) => typeof entry === "object")
    ? props.value as Record<string, string | number | boolean | string[]>[]
    : [];

  function updateRecord(index: number, fieldId: string, value: RegistrationAnswerValue) {
    const nextRecords = records.map((record, recordIndex) =>
      recordIndex === index ? { ...record, [fieldId]: value as string | number | boolean | string[] } : record,
    );
    props.onChange(nextRecords);
  }

  return (
    <div className="registration-repeating-group">
      {records.map((record, recordIndex) => (
        <fieldset key={`${props.field.id}-${recordIndex}`} className="registration-participant-card">
          <legend>{props.field.type === "repeating_child_group" ? "Child" : "Attendee"} {recordIndex + 1}</legend>
          {(props.field.participantFields ?? []).filter((participantField) =>
            conditionIsMet(participantField.condition, record),
          ).map((participantField) => (
            <label key={participantField.id} className="field">
              <span className="field__label">
                {participantField.label}
                {participantField.required ? <span className="field__required">Required</span> : null}
              </span>
              <RegistrationFieldControl
                field={participantField}
                value={record[participantField.id] ?? null}
                onChange={(value) => updateRecord(recordIndex, participantField.id, value)}
                readOnly={props.readOnly}
                inputId={`${props.field.id}-${recordIndex}-${participantField.id}`}
              />
            </label>
          ))}
          {!props.readOnly && (records.length > 1 || !props.field.required) ? (
            <button type="button" className="button button--ghost button--small" onClick={() => props.onChange(records.filter((_, index) => index !== recordIndex))}>
              Remove {props.field.type === "repeating_child_group" ? "child" : "attendee"}
            </button>
          ) : null}
        </fieldset>
      ))}
      {!props.readOnly && records.length < (props.field.maxValue ?? 25) ? (
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => props.onChange([...records, {}])}
        >
          Add {props.field.type === "repeating_child_group" ? "child" : "attendee"}
        </button>
      ) : null}
    </div>
  );
}

export function RegistrationFieldsEditor(props: {
  sections: RegistrationFormSection[];
  initialAnswers?: Record<string, RegistrationAnswerValue>;
  readOnly?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, RegistrationAnswerValue>>(() => {
    const initial = { ...(props.initialAnswers ?? {}) };
    for (const section of props.sections) {
      for (const field of section.fields) {
        if (isRepeatingField(field) && !Array.isArray(initial[field.id])) {
          initial[field.id] = field.required ? [{}] : [];
        } else if (initial[field.id] === undefined && field.defaultValue !== undefined) {
          initial[field.id] = field.defaultValue ?? null;
        }
      }
    }
    return initial;
  });

  return (
    <div className="registration-form-sections">
      <input type="hidden" name="answersJson" value={JSON.stringify(answers)} />
      {props.sections.toSorted((left, right) => left.displayOrder - right.displayOrder).map((section) => (
        <section key={section.id} className="registration-form-section" aria-labelledby={`${section.id}-title`}>
          <div className="registration-form-section__heading">
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.description ? <p>{section.description}</p> : null}
          </div>
          <div className="registration-form-grid">
            {section.fields.toSorted((left, right) => left.displayOrder - right.displayOrder).map((field) => {
              if (!conditionIsMet(field.condition, answers)) {
                return null;
              }
              if (field.type === "section_heading") {
                return <h3 key={field.id} className="registration-subheading">{field.label}</h3>;
              }
              if (field.type === "informational_text") {
                return <p key={field.id} className="registration-information">{field.helpText || field.label}</p>;
              }

              const inputId = `registration-${field.id}`;
              return (
                <div key={field.id} className={`field registration-field registration-field--${field.type}`}>
                  <label id={`${inputId}-label`} htmlFor={inputId} className="field__label">
                    {field.label}
                    {field.required ? <span className="field__required">Required</span> : null}
                  </label>
                  {isRepeatingField(field) ? (
                    <RepeatingGroup
                      field={field}
                      value={answers[field.id]}
                      onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
                      readOnly={props.readOnly ?? false}
                    />
                  ) : (
                    <RegistrationFieldControl
                      field={field}
                      value={answers[field.id]}
                      onChange={(value) => setAnswers((current) => ({ ...current, [field.id]: value }))}
                      readOnly={props.readOnly ?? false}
                      inputId={inputId}
                    />
                  )}
                  {field.helpText && field.type !== "consent" ? (
                    <span id={`${inputId}-help`} className="field__hint">{field.helpText}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

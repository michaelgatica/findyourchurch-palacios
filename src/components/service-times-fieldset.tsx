import {
  createServiceTimeRowsFromText,
  serviceTimeDayOptions,
  serviceTimeEventOptions,
  serviceTimeStartOptions,
} from "@/lib/service-time-options";

export function ServiceTimesFieldset({
  serviceTimesText,
  errorMessage,
}: {
  serviceTimesText: string;
  errorMessage?: string;
}) {
  const serviceTimeRows = createServiceTimeRowsFromText(serviceTimesText);

  return (
    <fieldset className="field field--full service-time-fieldset">
      <legend className="field__label">
        Service times <span className="field__required">Required</span>
      </legend>
      <p className="field__hint">
        Choose a main service for browse cards. Additional services will appear on the church page.
      </p>

      <div className="service-time-grid">
        {serviceTimeRows.map((row, index) => (
          <div key={`service-time-row-${index}`} className="service-time-row">
            <label className="service-time-row__primary">
              <input
                type="radio"
                name="primaryServiceTimeIndex"
                value={index}
                defaultChecked={row.isPrimary}
              />
              <span>Main</span>
            </label>

            <label className="field service-time-row__field">
              <span className="field__label">Event</span>
              <select name="serviceTimeTitle" defaultValue={row.title}>
                <option value="">Choose event</option>
                {serviceTimeEventOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field service-time-row__field">
              <span className="field__label">Day</span>
              <select name="serviceTimeDay" defaultValue={row.dayLabel}>
                <option value="">Choose day</option>
                {serviceTimeDayOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field service-time-row__field">
              <span className="field__label">Time</span>
              <select name="serviceTimeStart" defaultValue={row.startTime}>
                <option value="">Choose time</option>
                {serviceTimeStartOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field service-time-row__notes">
              <span className="field__label">Notes</span>
              <input
                name="serviceTimeNotes"
                defaultValue={row.notes}
                placeholder="Optional, such as nursery provided"
              />
            </label>
          </div>
        ))}
      </div>

      {errorMessage ? <p className="field__error">{errorMessage}</p> : null}
    </fieldset>
  );
}

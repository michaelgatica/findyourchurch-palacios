import type { ServiceTime } from "@/lib/types/directory";

export const serviceTimeRowCount = 5;

export const serviceTimeContactValue = "Contact church for time";
export const serviceTimeVariesDayValue = "Schedule varies";

export const serviceTimeEventOptions = [
  "Worship Service",
  "Sunday School",
  "Bible Study",
  "Prayer Meeting",
  "Youth Service",
  "Children's Classes",
  "Mass",
  "Confession",
  "Fellowship",
  "Small Groups",
  "Midweek Service",
  "Evangelistic Service",
  "Service Schedule",
  "Other Gathering",
] as const;

export const serviceTimeDayOptions = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  serviceTimeVariesDayValue,
] as const;

function createClockTimeOptions() {
  const options: string[] = [];

  for (let hour = 5; hour <= 23; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      options.push(`${displayHour}:${minute.toString().padStart(2, "0")} ${period}`);
    }
  }

  return options;
}

export const serviceTimeStartOptions = [
  ...createClockTimeOptions(),
  serviceTimeContactValue,
] as const;

export interface ServiceTimeFormRow {
  title: string;
  dayLabel: string;
  startTime: string;
  notes: string;
  isPrimary: boolean;
}

export function createEmptyServiceTimeRow(isPrimary = false): ServiceTimeFormRow {
  return {
    title: "",
    dayLabel: "",
    startTime: "",
    notes: "",
    isPrimary,
  };
}

export function formatServiceTimeLabel(row: Pick<ServiceTimeFormRow, "title" | "dayLabel" | "startTime">) {
  if (row.startTime === serviceTimeContactValue) {
    return row.dayLabel === serviceTimeVariesDayValue
      ? `${row.title} - ${serviceTimeContactValue}`
      : `${row.dayLabel} ${row.title} - ${serviceTimeContactValue}`;
  }

  return row.dayLabel === serviceTimeVariesDayValue
    ? `${row.title} - ${row.startTime}`
    : `${row.dayLabel} ${row.title} - ${row.startTime}`;
}

function findMatchingEventTitle(title: string) {
  const normalizedTitle = title.trim().toLowerCase();

  return (
    serviceTimeEventOptions.find((option) => option.toLowerCase() === normalizedTitle) ??
    serviceTimeEventOptions.find((option) => normalizedTitle.includes(option.toLowerCase())) ??
    "Other Gathering"
  );
}

function findMatchingStartTime(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue || normalizedValue.includes("contact")) {
    return serviceTimeContactValue;
  }

  return (
    serviceTimeStartOptions.find((option) => option.toLowerCase() === normalizedValue) ??
    serviceTimeContactValue
  );
}

export function parseServiceTimeLabelToRow(label: string, isPrimary = false): ServiceTimeFormRow {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    return createEmptyServiceTimeRow(isPrimary);
  }

  if (trimmedLabel.toLowerCase().includes("contact")) {
    return {
      title: "Service Schedule",
      dayLabel: serviceTimeVariesDayValue,
      startTime: serviceTimeContactValue,
      notes: trimmedLabel,
      isPrimary,
    };
  }

  const [leftSide = trimmedLabel, rightSide = ""] = trimmedLabel.split(/\s+-\s+/, 2);
  const matchedDay = serviceTimeDayOptions.find(
    (dayOption) =>
      dayOption !== serviceTimeVariesDayValue &&
      leftSide.toLowerCase().startsWith(dayOption.toLowerCase()),
  );
  const title = matchedDay
    ? leftSide.slice(matchedDay.length).trim()
    : leftSide.trim();

  return {
    title: findMatchingEventTitle(title || leftSide),
    dayLabel: matchedDay ?? serviceTimeVariesDayValue,
    startTime: findMatchingStartTime(rightSide),
    notes: "",
    isPrimary,
  };
}

export function createServiceTimeRowsFromText(serviceTimesText: string) {
  const parsedRows = serviceTimesText
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, serviceTimeRowCount)
    .map((entry, index) => parseServiceTimeLabelToRow(entry, index === 0));

  const rows = parsedRows.length > 0 ? parsedRows : [createEmptyServiceTimeRow(true)];

  while (rows.length < serviceTimeRowCount) {
    rows.push(createEmptyServiceTimeRow(false));
  }

  return rows;
}

export function createServiceTimesTextFromRows(rows: ServiceTimeFormRow[]) {
  return rows
    .filter((row) => row.title && row.dayLabel && row.startTime)
    .sort((leftRow, rightRow) => Number(rightRow.isPrimary) - Number(leftRow.isPrimary))
    .map(formatServiceTimeLabel)
    .join("\n");
}

export function createStructuredServiceTime(row: ServiceTimeFormRow, index: number): ServiceTime {
  return {
    id: `service-time-${index + 1}`,
    label: formatServiceTimeLabel(row),
    dayLabel: row.dayLabel,
    startTime: row.startTime,
    notes: row.notes.trim() || undefined,
    isPrimary: index === 0 || row.isPrimary,
  };
}

export function normalizeServiceTimeInput(serviceTime: ServiceTime | string, index: number): ServiceTime {
  if (typeof serviceTime !== "string") {
    return {
      ...serviceTime,
      id: serviceTime.id || `service-time-${index + 1}`,
      label: serviceTime.label,
      isPrimary: index === 0 ? true : Boolean(serviceTime.isPrimary),
    };
  }

  return {
    id: `service-time-${index + 1}`,
    label: serviceTime,
    isPrimary: index === 0,
  };
}

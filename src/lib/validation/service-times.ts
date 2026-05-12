import {
  createEmptyServiceTimeRow,
  createServiceTimesTextFromRows,
  createStructuredServiceTime,
  serviceTimeRowCount,
  type ServiceTimeFormRow,
} from "@/lib/service-time-options";

function getString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function getStringValues(formData: FormData, fieldName: string) {
  return formData
    .getAll(fieldName)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseServiceTimesFromFormData(formData: FormData, fallbackServiceTimesText: string) {
  const titles = getStringValues(formData, "serviceTimeTitle");
  const dayLabels = getStringValues(formData, "serviceTimeDay");
  const startTimes = getStringValues(formData, "serviceTimeStart");
  const notes = getStringValues(formData, "serviceTimeNotes");
  const hasStructuredRows =
    titles.length > 0 || dayLabels.length > 0 || startTimes.length > 0 || notes.length > 0;

  if (!hasStructuredRows) {
    const serviceTimes = splitLines(fallbackServiceTimesText);

    return {
      serviceTimes,
      serviceTimesText: serviceTimes.join("\n"),
      error: serviceTimes.length === 0 ? "Add at least one service time." : undefined,
    };
  }

  const selectedPrimaryIndex = Number.parseInt(getString(formData, "primaryServiceTimeIndex"), 10);
  const rows = Array.from({ length: serviceTimeRowCount }, (_, index): ServiceTimeFormRow => ({
    title: titles[index] ?? "",
    dayLabel: dayLabels[index] ?? "",
    startTime: startTimes[index] ?? "",
    notes: notes[index] ?? "",
    isPrimary: Number.isFinite(selectedPrimaryIndex) && selectedPrimaryIndex === index,
  }));
  const usedRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.title || row.dayLabel || row.startTime || row.notes);

  if (usedRows.length === 0) {
    return {
      serviceTimes: [],
      serviceTimesText: "",
      error: "Add at least one service time.",
    };
  }

  const incompleteRow = usedRows.find(
    ({ row }) => !row.title || !row.dayLabel || !row.startTime,
  );

  if (incompleteRow) {
    return {
      serviceTimes: [],
      serviceTimesText: createServiceTimesTextFromRows(usedRows.map(({ row }) => row)),
      error: "Complete the event, day, and time for each service time row you use.",
    };
  }

  const completeRows = usedRows.map(({ row }) => row);
  const primaryRow = completeRows.find((row) => row.isPrimary) ?? completeRows[0] ?? createEmptyServiceTimeRow(true);
  const orderedRows = [
    { ...primaryRow, isPrimary: true },
    ...completeRows
      .filter((row) => row !== primaryRow)
      .map((row) => ({ ...row, isPrimary: false })),
  ];

  return {
    serviceTimes: orderedRows.map(createStructuredServiceTime),
    serviceTimesText: createServiceTimesTextFromRows(orderedRows),
    error: undefined,
  };
}

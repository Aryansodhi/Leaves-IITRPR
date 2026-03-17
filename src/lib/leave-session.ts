export const SESSION_VALUES = ["MORNING", "AFTERNOON", "EVENING"] as const;

export type DaySession = (typeof SESSION_VALUES)[number];

export const SESSION_OFFSET: Record<DaySession, number> = {
  MORNING: 0,
  AFTERNOON: 0.5,
  EVENING: 1,
};

export const getTodayIso = () => new Date().toISOString().slice(0, 10);

export const resolveCurrentSession = (): DaySession => {
  const hour = new Date().getHours();
  if (hour < 12) return "MORNING";
  if (hour < 17) return "AFTERNOON";
  return "EVENING";
};

export const formatSessionDays = (value: number) =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

export const computeSessionLeaveDays = (
  fromDate: Date,
  fromSession: DaySession,
  toDate: Date,
  toSession: DaySession,
) => {
  const fromMarker =
    fromDate.getTime() / 86400000 + SESSION_OFFSET[fromSession];
  const toMarker = toDate.getTime() / 86400000 + SESSION_OFFSET[toSession];
  const value = Number((toMarker - fromMarker).toFixed(1));
  return value > 0 ? value : null;
};

export const computeSessionLeaveDaysFromInput = (
  fromDateRaw: string,
  fromSession: DaySession,
  toDateRaw: string,
  toSession: DaySession,
) => {
  if (!fromDateRaw || !toDateRaw) return null;

  const fromDate = new Date(`${fromDateRaw}T00:00:00`);
  const toDate = new Date(`${toDateRaw}T00:00:00`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  return computeSessionLeaveDays(fromDate, fromSession, toDate, toSession);
};

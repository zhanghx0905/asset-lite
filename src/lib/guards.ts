import type { AppState, MonthRecord, Subject, MonthlyEntry, Currency } from "../types";

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function isCurrency(v: unknown): v is Currency {
  return v === "CNY" || v === "USD";
}

export function isBucket(v: unknown): v is Subject["bucket"] {
  return v === "Cash" || v === "Invest" || v === "Social" || v === "Other";
}

export function isYYYYMM(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function validateSubject(s: unknown): s is Subject {
  if (!isRecord(s)) return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    isBucket(r.bucket) &&
    isCurrency(r.defaultCurrency) &&
    (r.isIndexLike === undefined || typeof r.isIndexLike === "boolean") &&
    (r.includeInNetWorth === undefined || typeof r.includeInNetWorth === "boolean")
  );
}

export function validateMonthlyEntry(e: unknown): e is MonthlyEntry {
  if (!isRecord(e)) return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.subjectId === "string" &&
    isCurrency(r.currency) &&
    typeof r.formula === "string" &&
    typeof r.amount === "number" &&
    Number.isFinite(r.amount)
  );
}

export function validateMonthRecord(m: unknown): m is MonthRecord {
  if (!isRecord(m)) return false;
  const r = m as Record<string, unknown>;
  const entries = r.entries;
  return (
    isYYYYMM(r.month) &&
    Array.isArray(entries) &&
    entries.every(validateMonthlyEntry) &&
    (r.note === undefined || typeof r.note === "string")
  );
}

export function validateAppStateLike(v: unknown): v is AppState {
  if (!isRecord(v)) return false;
  const r = v as Record<string, unknown>;

  const subjects = r.subjects;
  const months = r.months;
  const settings = r.settings;

  if (!Array.isArray(subjects) || !subjects.every(validateSubject)) return false;
  if (!Array.isArray(months) || !months.every(validateMonthRecord)) return false;
  if (!isRecord(settings)) return false;

  const s = settings as Record<string, unknown>;
  return typeof s.usdcnhManual === "number" && Number.isFinite(s.usdcnhManual) && typeof s.enableCorsProxyAutoFx === "boolean";
}

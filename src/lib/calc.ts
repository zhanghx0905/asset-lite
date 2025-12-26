import { AppState, MonthRecord, Currency } from "../types";

export function toCny(amount: number, currency: Currency, usdcnh: number): number {
  return currency === "CNY" ? amount : amount * usdcnh;
}
export function toUsd(amount: number, currency: Currency, usdcnh: number): number {
  return currency === "USD" ? amount : (usdcnh === 0 ? 0 : amount / usdcnh);
}

export function ensureMonth(state: AppState, ym: string): MonthRecord {
  const found = state.months.find((m) => m.month === ym);
  if (found) return found;

  return {
    month: ym,
    entries: state.subjects.map((s) => ({
      subjectId: s.id,
      currency: s.defaultCurrency,
      formula: "",
      amount: 0
    }))
  };
}

export function upsertMonth(state: AppState, record: MonthRecord): AppState {
  const existing = new Map(record.entries.map((e) => [e.subjectId, e]));
  const merged: MonthRecord = {
    ...record,
    entries: state.subjects.map((s) => {
      const hit = existing.get(s.id);
      return hit
        ? hit
        : { subjectId: s.id, currency: s.defaultCurrency, formula: "", amount: 0 };
    })
  };

  const months = [...state.months.filter((m) => m.month !== merged.month), merged].sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  return { ...state, months };
}

export function monthNetWorth(state: AppState, m: MonthRecord, usdcnh: number) {
  const subMap = new Map(state.subjects.map((s) => [s.id, s]));
  let totalCny = 0;
  let totalUsd = 0;

  const buckets: Record<string, number> = { Cash: 0, Invest: 0, Social: 0, Other: 0 };
  let indexLikeCny = 0;

  for (const e of m.entries) {
    const s = subMap.get(e.subjectId);
    if (!s || s.includeInNetWorth === false) continue;

    const cny = toCny(e.amount || 0, e.currency, usdcnh);
    const usd = toUsd(e.amount || 0, e.currency, usdcnh);

    totalCny += cny;
    totalUsd += usd;

    buckets[s.bucket] = (buckets[s.bucket] ?? 0) + cny;
    if (s.isIndexLike) indexLikeCny += cny;
  }

  const indexLikePct = totalCny > 0 ? (indexLikeCny / totalCny) * 100 : 0;

  return { totalCny, totalUsd, buckets, indexLikePct };
}

export function netWorthSeries(state: AppState, usdcnh: number) {
  return state.months.map((m) => {
    const nw = monthNetWorth(state, m, usdcnh);
    return { month: m.month, cny: nw.totalCny, usd: nw.totalUsd, indexLikePct: nw.indexLikePct, ...nw.buckets };
  });
}

export function sumBy<T extends string>(obj: Record<T, number>, key: T, add: number) {
  obj[key] = (obj[key] ?? 0) + add;
}

export function ymNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function prevMonthYm(ym: string): string | null {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function prevYearSameMonth(ym: string): string | null {
  const [y, m] = ym.split("-");
  const yy = Number(y);
  if (!Number.isFinite(yy) || !m) return null;
  return `${yy - 1}-${m}`;
}

export function pctChange(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function formatNow(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

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

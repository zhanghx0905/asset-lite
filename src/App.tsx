import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { ensureMonth, monthNetWorth, netWorthSeries, upsertMonth } from "./lib/calc";
import { evalFormula } from "./lib/formula";
import { fetchUSDCNHViaCorsProxy } from "./lib/autoFx";

import { ymNow, prevMonthYm, prevYearSameMonth, pctChange, formatNow } from "./lib/calc";

import MarketPanel from "./components/MarketPanel";
import AddEntryRow from "./components/AddEntryRow";
import SubjectsEditor from "./components/SubjectsEditor";
import BackupPanel from "./components/BackupPanel";

import { PieBreakdown, NetWorthLine, BucketArea, IndexLikeLine, computeLatestBreakdowns } from "./components/Charts";
import { PromptBox } from "./components/InsightsExtras";

import type { AppState, AutoFxState, MonthRecord, MonthlyEntry, Currency, Subject } from "./types";

type TabKey = "overview" | "monthly" | "settings";

function removeSubjectFromState(prev: AppState, subjectId: string): AppState {
  const nextSubjects = prev.subjects.filter((s) => s.id !== subjectId);
  const nextMonths = prev.months.map((m) => ({
    ...m,
    entries: m.entries.filter((e) => e.subjectId !== subjectId)
  }));
  return { ...prev, subjects: nextSubjects, months: nextMonths };
}

function upsertSubject(prev: AppState, subject: Subject): AppState {
  const exists = prev.subjects.some((s) => s.id === subject.id);
  return {
    ...prev,
    subjects: exists ? prev.subjects.map((s) => (s.id === subject.id ? subject : s)) : [...prev.subjects, subject]
  };
}

function ensureEntryInMonth(record: MonthRecord, subject: Subject): MonthRecord {
  if (record.entries.some((e) => e.subjectId === subject.id)) return record;

  const entry: MonthlyEntry = {
    subjectId: subject.id,
    currency: subject.defaultCurrency ?? "CNY",
    formula: "",
    amount: 0
  };

  return {
    ...record,
    entries: [...record.entries, entry]
  };
}

function AssetKPI({
  totalCny,
  totalUsd
}: {
  totalCny: number;
  totalUsd: number;
}) {
  return (
    <div className="kpi">
      <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Asset（CNY）
        </div>
        <div className="big">￥{totalCny.toFixed(2)}</div>
      </div>

      <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Asset（USD）
        </div>
        <div className="big">${totalUsd.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState() as AppState);
  const [tab, setTab] = useState<TabKey>("overview");
  const [ym, setYm] = useState<string>(() => state.months[state.months.length - 1]?.month || ymNow());
  const [autoFx, setAutoFx] = useState<AutoFxState>({ status: "idle" });
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (!state.settings.enableCorsProxyAutoFx) return;
      const res = await fetchUSDCNHViaCorsProxy();
      if (!alive) return;

      if (res.ok) {
        setAutoFx({ status: "ok", usdcnh: res.rate, updatedAt: Date.now() });
      } else {
        setAutoFx({ status: "error", message: res.error });
      }
    };

    tick();
    const t = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [state.settings.enableCorsProxyAutoFx]);

  const workingFx = useMemo<number>(() => {
    return autoFx.status === "ok" && autoFx.usdcnh ? autoFx.usdcnh : state.settings.usdcnhManual;
  }, [autoFx.status, autoFx.usdcnh, state.settings.usdcnhManual]);

  const record = useMemo<MonthRecord>(() => ensureMonth(state, ym), [state, ym]);
  const nw = useMemo(() => monthNetWorth(state, record, workingFx), [state, record, workingFx]);
  const series = useMemo(() => netWorthSeries(state, workingFx), [state, workingFx]);

  const latest = record;

  const { bucketItems, ccyItems } = useMemo(
    () => computeLatestBreakdowns({ state, record: latest, fx: workingFx }),
    [state, latest, workingFx]
  );

  const updateMonth = useCallback((next: MonthRecord) => {
    setState((prev) => upsertMonth(prev, next));
  }, []);

  const updateEntry = useCallback(
    (idx: number, patch: Partial<MonthlyEntry>) => {
      const next: MonthRecord = { ...record, entries: [...record.entries] };
      next.entries[idx] = { ...next.entries[idx], ...patch };
      updateMonth(next);
    },
    [record, updateMonth]
  );

  const addEntryBySubjectId = useCallback(
    (subjectId: string) => {
      const subj = state.subjects.find((s) => s.id === subjectId);
      if (!subj) return;
      updateMonth(ensureEntryInMonth(record, subj));
    },
    [record, state.subjects, updateMonth]
  );

  const headerFxBadge = useMemo(() => {
    if (autoFx.status === "ok" && autoFx.usdcnh)
      return <span className="badge">USDCNH 自动：{autoFx.usdcnh.toFixed(5)}</span>;
    if (autoFx.status === "error") return <span className="badge">USDCNH 自动失败</span>;
    return <span className="badge">USDCNH：手动</span>;
  }, [autoFx.status, autoFx.usdcnh]);

  const momYoy = useMemo(() => {
    const curYm = record.month;

    const prevYm = prevMonthYm(curYm);
    const yoyYm = prevYearSameMonth(curYm);

    const prevRecord = prevYm ? state.months.find((m) => m.month === prevYm) : undefined;
    const yoyRecord = yoyYm ? state.months.find((m) => m.month === yoyYm) : undefined;

    const prevNw = prevRecord ? monthNetWorth(state, prevRecord, workingFx) : null;
    const yoyNw = yoyRecord ? monthNetWorth(state, yoyRecord, workingFx) : null;

    const momDeltaCny = prevNw ? nw.totalCny - prevNw.totalCny : null;
    const momPctCny = prevNw ? pctChange(nw.totalCny, prevNw.totalCny) : null;

    const yoyDeltaCny = yoyNw ? nw.totalCny - yoyNw.totalCny : null;
    const yoyPctCny = yoyNw ? pctChange(nw.totalCny, yoyNw.totalCny) : null;

    return {
      prevYm,
      yoyYm,
      mom: prevNw
        ? { ok: true as const, deltaCny: momDeltaCny!, pctCny: momPctCny, baseCny: prevNw.totalCny }
        : { ok: false as const },
      yoy: yoyNw
        ? { ok: true as const, deltaCny: yoyDeltaCny!, pctCny: yoyPctCny, baseCny: yoyNw.totalCny }
        : { ok: false as const }
    };
  }, [record.month, state.months, nw.totalCny, workingFx, state]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">Asset Lite</div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-end"
          }}
        >
          <span className="badge">当前时间：{formatNow(nowTs)}</span>
          {headerFxBadge}
          <span className="badge">FX={Number.isFinite(workingFx) ? workingFx.toFixed(5) : "--"}</span>
        </div>
      </div>

      <div className="card pad" style={{ marginTop: 12 }}>
        <div className="row wrap" style={{ gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <div className="row" style={{ gap: 8 }}>
            <button className={`btn ${tab === "overview" ? "primary" : ""}`} onClick={() => setTab("overview")}>
              概览
            </button>
            <button className={`btn ${tab === "monthly" ? "primary" : ""}`} onClick={() => setTab("monthly")}>
              月度录入
            </button>
            <button className={`btn ${tab === "settings" ? "primary" : ""}`} onClick={() => setTab("settings")}>
              设置
            </button>
          </div>

        </div>
      </div>

      {tab === "overview" && (
        <>
          <MarketPanel />

          <div className="card pad" style={{ marginTop: 12 }}>

            <div className="sectionTitle">
              <div className="h2">趋势洞察</div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="badge">月份</span>
                <input className="input" style={{ width: 170, color: "white" }} type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
              </div>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <span className="badge">指数类占比：{nw.indexLikePct.toFixed(1)}%</span>

                <span className="badge" title={momYoy.prevYm ? `对比上月 ${momYoy.prevYm}` : ""}>
                  环比：
                  {momYoy.mom.ok
                    ? ` ${momYoy.mom.deltaCny >= 0 ? "+" : ""}${momYoy.mom.deltaCny.toFixed(2)} CNY` +
                    (momYoy.mom.pctCny == null
                      ? ""
                      : `（${momYoy.mom.pctCny >= 0 ? "+" : ""}${momYoy.mom.pctCny.toFixed(1)}%）`)
                    : " —"}
                </span>

                <span className="badge" title={momYoy.yoyYm ? `对比去年同月 ${momYoy.yoyYm}` : ""}>
                  同比：
                  {momYoy.yoy.ok
                    ? ` ${momYoy.yoy.deltaCny >= 0 ? "+" : ""}${momYoy.yoy.deltaCny.toFixed(2)} CNY` +
                    (momYoy.yoy.pctCny == null
                      ? ""
                      : `（${momYoy.yoy.pctCny >= 0 ? "+" : ""}${momYoy.yoy.pctCny.toFixed(1)}%）`)
                    : " —"}
                </span>
              </div>
            </div>

            <AssetKPI totalCny={nw.totalCny} totalUsd={nw.totalUsd}></AssetKPI>
            <div className="split" style={{ marginTop: 12 }}>
              <PieBreakdown title="资产占比（按大类，折算CNY）" items={bucketItems} />
              <PieBreakdown title="资产占比（按币种，折算CNY）" items={ccyItems} />
            </div>

            <div className="split" style={{ marginTop: 12 }}>
              <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  净资产趋势（CNY）
                </div>
                <NetWorthLine data={series} />
              </div>
              <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  指数化占比趋势
                </div>
                <IndexLikeLine data={series} />
              </div>
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.04)", marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                结构变化（按大类堆叠）
              </div>
              <BucketArea data={series} />
            </div>

            <div style={{ marginTop: 12 }}>
              <PromptBox state={state} record={latest} fx={workingFx} />
            </div>
          </div>
        </>
      )}

      {tab === "monthly" && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <div className="sectionTitle">
            <div className="h2">月度录入</div>
          </div>

          <AssetKPI totalCny={nw.totalCny} totalUsd={nw.totalUsd}></AssetKPI>
          <div className="subtleLine" />

          <AddEntryRow state={state} record={record} onAdd={addEntryBySubjectId} />

          <div className="subtleLine" />

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>科目</th>
                <th style={{ width: 110 }}>币种</th>
                <th>金额/公式</th>
                <th style={{ width: 170 }}>计算值</th>
                <th style={{ width: 170 }}>折算(CNY)</th>
                <th style={{ width: 170 }}>折算(USD)</th>
              </tr>
            </thead>
            <tbody>
              {record.entries.map((e, idx) => {
                const s = state.subjects.find((x) => x.id === e.subjectId);
                const res = evalFormula(e.formula);
                const amount = res.ok ? res.value : e.amount;

                if (res.ok && amount !== e.amount) {
                  queueMicrotask(() => updateEntry(idx, { amount: res.value }));
                }

                const cny = e.currency === "USD" ? amount * workingFx : amount;
                const usd = e.currency === "CNY" ? (workingFx === 0 ? 0 : amount / workingFx) : amount;

                return (
                  <tr key={`${e.subjectId}_${idx}`}>
                    <td>
                      <div style={{ fontWeight: 800 }}>{s?.name ?? e.subjectId}</div>
                      <div className="muted2" style={{ fontSize: 12 }}>
                        {s?.bucket ?? ""}
                        {s?.isIndexLike ? " · 指数类" : ""}
                        {s?.includeInNetWorth === false ? " · 不计入净资产" : ""}
                      </div>
                    </td>
                    <td>
                      <select value={e.currency} onChange={(ev) => updateEntry(idx, { currency: ev.target.value as Currency })}>
                        <option value="CNY">CNY</option>
                        <option value="USD">USD</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        value={e.formula}
                        onChange={(ev) => updateEntry(idx, { formula: ev.target.value })}
                        placeholder="可输入公式，如 12000+3000-500"
                      />
                      {!res.ok ? (
                        <div style={{ marginTop: 6 }} className="note">
                          ⚠ {res.error}
                        </div>
                      ) : (
                        <div style={{ marginTop: 6 }} className="note">
                          已解析
                        </div>
                      )}
                    </td>
                    <td style={{ fontFeatureSettings: '"tnum"' as any }}>{Number.isFinite(amount) ? amount.toFixed(2) : "--"}</td>
                    <td style={{ fontFeatureSettings: '"tnum"' as any }}>￥{Number.isFinite(cny) ? cny.toFixed(2) : "--"}</td>
                    <td style={{ fontFeatureSettings: '"tnum"' as any }}>${Number.isFinite(usd) ? usd.toFixed(2) : "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <div className="sectionTitle">
            <div className="h2">设置</div>
          </div>

          <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              汇率（USDCNH）
            </div>
            <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
              <span className="badge">手动</span>
              <input
                className="input"
                style={{ width: 180 }}
                type="number"
                step="0.00001"
                value={state.settings.usdcnhManual}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    settings: { ...prev.settings, usdcnhManual: Number(e.target.value) }
                  }))
                }
                title="手动 USDCNH（自动成功则优先用自动）"
              />
              <label className="badge" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={state.settings.enableCorsProxyAutoFx}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, enableCorsProxyAutoFx: e.target.checked }
                    }))
                  }
                />
                自动抓取（前端）
              </label>
              <span className="badge">当前：{Number.isFinite(workingFx) ? workingFx.toFixed(5) : "--"}</span>
            </div>
            {autoFx.status === "error" && (
              <div className="note" style={{ marginTop: 8 }}>
                自动抓取失败：{autoFx.message}
              </div>
            )}
          </div>

          <div className="subtleLine" />

          <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              个人背景（用于生成 Prompt）
            </div>
            <textarea
              className="input"
              style={{ height: 120, marginTop: 4 }}
              placeholder="可填写：出生日期 ..., 职业 ..., 每年可结余/可投资现金流约 ... 元"
              value={state.settings.backgroundPrompt ?? ""}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, backgroundPrompt: e.target.value }
                }))
              }
            />
            <div className="note" style={{ marginTop: 8 }}>
              这里填写的内容会被加入到生成的 Prompt 中，便于获得更贴合的建议。
            </div>
          </div>

          <div className="subtleLine" />

          <SubjectsEditor
            state={state}
            setState={setState}
            onDeleteSubject={(id) => setState((prev) => removeSubjectFromState(prev, id))}
            onAddSubject={(subject) => setState((prev) => upsertSubject(prev, subject))}
          />

          <div className="subtleLine" />

          <BackupPanel state={state} setState={(s) => setState(s)} />
        </div>
      )}
    </div>
  );
}

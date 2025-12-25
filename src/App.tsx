import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState } from "./lib/storage";
import { ensureMonth, monthNetWorth, netWorthSeries, upsertMonth } from "./lib/calc";
import { evalFormula } from "./lib/formula";
import { fetchUSDCNHViaCorsProxy } from "./lib/autoFx";
import TVMiniChart from "./components/TVMiniChart";
import { NetWorthLine, BucketArea, IndexLikeLine } from "./components/Charts";
import { PieBreakdown, PromptBox, computeLatestBreakdowns } from "./components/InsightsExtras";

const SCHEMA_VERSION = 1;

function ymNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function genId(prefix = "sub") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function removeSubjectFromState(prev, subjectId) {
  const nextSubjects = prev.subjects.filter((s) => s.id !== subjectId);
  const nextMonths = prev.months.map((m) => ({
    ...m,
    entries: m.entries.filter((e) => e.subjectId !== subjectId)
  }));
  return { ...prev, subjects: nextSubjects, months: nextMonths };
}

function upsertSubject(prev, subject) {
  const exists = prev.subjects.some((s) => s.id === subject.id);
  return {
    ...prev,
    subjects: exists ? prev.subjects.map((s) => (s.id === subject.id ? subject : s)) : [...prev.subjects, subject]
  };
}

function ensureEntryInMonth(record, subject) {
  if (record.entries.some((e) => e.subjectId === subject.id)) return record;
  return {
    ...record,
    entries: [
      ...record.entries,
      {
        subjectId: subject.id,
        currency: subject.defaultCurrency ?? "CNY",
        formula: "",
        amount: 0
      }
    ]
  };
}

function prevMonthYm(ym) {
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

function prevYearSameMonth(ym) {
  const [y, m] = ym.split("-");
  const yy = Number(y);
  if (!Number.isFinite(yy) || !m) return null;
  return `${yy - 1}-${m}`;
}

function pctChange(cur, prev) {
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function isRecord(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isCurrency(v) {
  return v === "CNY" || v === "USD";
}

function isBucket(v) {
  return v === "Cash" || v === "Invest" || v === "Social" || v === "Other";
}

function isYYYYMM(v) {
  if (typeof v !== "string") return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

function validateSubject(s) {
  return (
    isRecord(s) &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    isBucket(s.bucket) &&
    isCurrency(s.defaultCurrency) &&
    (s.isIndexLike === undefined || typeof s.isIndexLike === "boolean") &&
    (s.includeInNetWorth === undefined || typeof s.includeInNetWorth === "boolean")
  );
}

function validateMonthlyEntry(e) {
  return (
    isRecord(e) &&
    typeof e.subjectId === "string" &&
    isCurrency(e.currency) &&
    typeof e.formula === "string" &&
    typeof e.amount === "number" &&
    Number.isFinite(e.amount)
  );
}

function validateMonthRecord(m) {
  return (
    isRecord(m) &&
    isYYYYMM(m.month) &&
    Array.isArray(m.entries) &&
    m.entries.every(validateMonthlyEntry) &&
    (m.note === undefined || typeof m.note === "string")
  );
}

function validateAppStateLike(v) {
  return (
    isRecord(v) &&
    Array.isArray(v.subjects) &&
    v.subjects.every(validateSubject) &&
    Array.isArray(v.months) &&
    v.months.every(validateMonthRecord) &&
    isRecord(v.settings) &&
    typeof v.settings.usdcnhManual === "number" &&
    Number.isFinite(v.settings.usdcnhManual) &&
    typeof v.settings.enableCorsProxyAutoFx === "boolean"
  );
}

function formatNow(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [tab, setTab] = useState("overview");
  const [ym, setYm] = useState(() => state.months[state.months.length - 1]?.month || ymNow());
  const [autoFx, setAutoFx] = useState({ status: "idle" });
  const [nowTs, setNowTs] = useState(() => Date.now());

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

  const workingFx = useMemo(() => {
    return autoFx.status === "ok" && autoFx.usdcnh ? autoFx.usdcnh : state.settings.usdcnhManual;
  }, [autoFx.status, autoFx.usdcnh, state.settings.usdcnhManual]);

  const record = useMemo(() => ensureMonth(state, ym), [state, ym]);
  const nw = useMemo(() => monthNetWorth(state, record, workingFx), [state, record, workingFx]);
  const series = useMemo(() => netWorthSeries(state, workingFx), [state, workingFx]);

  const latest = record;

  const { bucketItems, ccyItems } = useMemo(
    () => computeLatestBreakdowns({ state, record: latest, fx: workingFx }),
    [state, latest, workingFx]
  );

  const updateMonth = useCallback(
    (next) => {
      setState((prev) => upsertMonth(prev, next));
    },
    [setState]
  );

  const updateEntry = useCallback(
    (idx, patch) => {
      const next = { ...record, entries: [...record.entries] };
      next.entries[idx] = { ...next.entries[idx], ...patch };
      updateMonth(next);
    },
    [record, updateMonth]
  );

  const addEntryBySubjectId = useCallback(
    (subjectId) => {
      const subj = state.subjects.find((s) => s.id === subjectId);
      if (!subj) return;
      updateMonth(ensureEntryInMonth(record, subj));
    },
    [record, state.subjects, updateMonth]
  );

  const headerFxBadge = useMemo(() => {
    if (autoFx.status === "ok" && autoFx.usdcnh) return <span className="badge">USDCNH 自动：{autoFx.usdcnh.toFixed(5)}</span>;
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
        ? { ok: true, deltaCny: momDeltaCny, pctCny: momPctCny, baseCny: prevNw.totalCny }
        : { ok: false },
      yoy: yoyNw
        ? { ok: true, deltaCny: yoyDeltaCny, pctCny: yoyPctCny, baseCny: yoyNw.totalCny }
        : { ok: false }
    };
  }, [record.month, state, nw.totalCny, workingFx]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">Asset Lite</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
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

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="badge">月份</span>
            <input
              className="input"
              style={{ width: 170 }}
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
            />
            <button className="btn" onClick={() => updateMonth(record)}>
              保存当月
            </button>
          </div>
        </div>
      </div>

      {tab === "overview" && (
        <>
          <div className="card pad" style={{ marginTop: 12 }}>
            <div className="sectionTitle">
              <div className="h2">实时行情</div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="card pad" style={{ background: "rgba(255,255,255,.05)" }}>
                <TVMiniChart symbol="NASDAQ:QQQ" title="QQQ" />
              </div>
              <div className="card pad" style={{ background: "rgba(255,255,255,.05)" }}>
                <TVMiniChart symbol="BINANCE:BTCUSDT" title="BTC" />
              </div>
              <div className="card pad" style={{ background: "rgba(255,255,255,.05)" }}>
                <TVMiniChart symbol="FX:USDCNH" title="USDCNH" />
              </div>
            </div>
          </div>

          <div className="card pad" style={{ marginTop: 12 }}>
            <div className="sectionTitle">
              <div className="h2">趋势洞察</div>

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

            <div className="split" style={{ marginTop: 12 }}>
              <PieBreakdown title="最近一个月：资产占比（按大类，折算CNY）" items={bucketItems} />
              <PieBreakdown title="最近一个月：资产占比（按币种，折算CNY）" items={ccyItems} />
            </div>

            <div className="split">
              <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>净资产趋势（CNY）</div>
                <NetWorthLine data={series} />
              </div>
              <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>指数化占比趋势</div>
                <IndexLikeLine data={series} />
              </div>
            </div>

            <div className="card pad" style={{ background: "rgba(255,255,255,.04)", marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>结构变化（按大类堆叠）</div>
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

          <div className="kpi">
            <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
              <div className="muted" style={{ fontSize: 12 }}>净资产（CNY）</div>
              <div className="big">￥{nw.totalCny.toFixed(2)}</div>
            </div>
            <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
              <div className="muted" style={{ fontSize: 12 }}>净资产（USD）</div>
              <div className="big">${nw.totalUsd.toFixed(2)}</div>
            </div>
          </div>

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
                      <select value={e.currency} onChange={(ev) => updateEntry(idx, { currency: ev.target.value })}>
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
                        <div style={{ marginTop: 6 }} className="note">⚠ {res.error}</div>
                      ) : (
                        <div style={{ marginTop: 6 }} className="note">已解析</div>
                      )}
                    </td>
                    <td style={{ fontFeatureSettings: '"tnum"' }}>
                      {Number.isFinite(amount) ? amount.toFixed(2) : "--"}
                    </td>
                    <td style={{ fontFeatureSettings: '"tnum"' }}>
                      ￥{Number.isFinite(cny) ? cny.toFixed(2) : "--"}
                    </td>
                    <td style={{ fontFeatureSettings: '"tnum"' }}>
                      ${Number.isFinite(usd) ? usd.toFixed(2) : "--"}
                    </td>
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
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>汇率（USDCNH）</div>
            <div className="row wrap" style={{ gap: 10, alignItems: "center" }}>
              <span className="badge">手动</span>
              <input
                className="input"
                style={{ width: 180 }}
                type="number"
                step="0.00001"
                value={state.settings.usdcnhManual}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, settings: { ...prev.settings, usdcnhManual: Number(e.target.value) } }))
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
              <div className="note" style={{ marginTop: 8 }}>自动抓取失败：{autoFx.message}</div>
            )}
          </div>

          <div className="subtleLine" />

          <SubjectsEditor
            state={state}
            setState={setState}
            onDeleteSubject={(id) => setState((prev) => removeSubjectFromState(prev, id))}
            onAddSubject={(subject) => setState((prev) => upsertSubject(prev, subject))}
          />

          <div className="subtleLine" />

          <BackupPanel state={state} setState={setState} />
        </div>
      )}
    </div>
  );
}

function AddEntryRow({ state, record, onAdd }) {
  const [pick, setPick] = useState("");

  const candidates = useMemo(() => {
    const used = new Set(record.entries.map((e) => e.subjectId));
    return state.subjects.filter((s) => !used.has(s.id));
  }, [record.entries, state.subjects]);

  useEffect(() => {
    if (!pick && candidates[0]?.id) setPick(candidates[0].id);
    if (pick && !candidates.some((s) => s.id === pick)) setPick(candidates[0]?.id ?? "");
  }, [pick, candidates, record.month]);

  return (
    <div className="row wrap" style={{ gap: 8, alignItems: "center" }}>
      <span className="badge">新增条目</span>
      <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={candidates.length === 0}>
        {candidates.length === 0 ? (
          <option value="">（无可添加科目）</option>
        ) : (
          candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.bucket}
            </option>
          ))
        )}
      </select>
      <button className="btn" disabled={!pick} onClick={() => pick && onAdd(pick)}>
        添加到当月
      </button>
      <span className="muted2" style={{ fontSize: 12 }}>先在「设置」里新增科目，再回这里添加条目</span>
    </div>
  );
}

function SubjectsEditor({ state, setState, onDeleteSubject, onAddSubject }) {
  const updateSubject = useCallback(
    (id, patch) => {
      setState((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s))
      }));
    },
    [setState]
  );

  const [newName, setNewName] = useState("");
  const [newBucket, setNewBucket] = useState("Cash");
  const [newCurrency, setNewCurrency] = useState("CNY");
  const [newIndexLike, setNewIndexLike] = useState(false);
  const [newIncludeNW, setNewIncludeNW] = useState(true);

  const add = useCallback(() => {
    const name = newName.trim();
    if (!name) return;

    onAddSubject({
      id: genId("sub"),
      name,
      bucket: newBucket,
      defaultCurrency: newCurrency,
      isIndexLike: newIndexLike,
      includeInNetWorth: newIncludeNW
    });

    setNewName("");
    setNewBucket("Cash");
    setNewCurrency("CNY");
    setNewIndexLike(false);
    setNewIncludeNW(true);
  }, [newName, newBucket, newCurrency, newIndexLike, newIncludeNW, onAddSubject]);

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>科目</div>

      <div className="row wrap" style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span className="badge">新增科目</span>
        <input
          className="input"
          style={{ width: 260 }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="科目名称，例如：微信、支付宝、微众银行、应收账款…"
        />
        <select value={newBucket} onChange={(e) => setNewBucket(e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="Invest">Invest</option>
          <option value="Social">Social</option>
          <option value="Other">Other</option>
        </select>
        <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
          <option value="CNY">CNY</option>
          <option value="USD">USD</option>
        </select>
        <label className="badge" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={newIndexLike} onChange={(e) => setNewIndexLike(e.target.checked)} />
          指数类
        </label>
        <label className="badge" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={newIncludeNW} onChange={(e) => setNewIncludeNW(e.target.checked)} />
          计入净资产
        </label>
        <button className="btn primary" onClick={add} disabled={!newName.trim()}>
          添加
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {state.subjects.map((s) => (
          <div
            key={s.id}
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr 140px 120px 220px",
              gap: 8,
              alignItems: "center"
            }}
          >
            <div className="badge" title={s.id}>{s.id}</div>
            <input className="input" value={s.name} onChange={(e) => updateSubject(s.id, { name: e.target.value })} />
            <select value={s.bucket} onChange={(e) => updateSubject(s.id, { bucket: e.target.value })}>
              <option value="Cash">Cash</option>
              <option value="Invest">Invest</option>
              <option value="Social">Social</option>
              <option value="Other">Other</option>
            </select>
            <select value={s.defaultCurrency} onChange={(e) => updateSubject(s.id, { defaultCurrency: e.target.value })}>
              <option value="CNY">CNY</option>
              <option value="USD">USD</option>
            </select>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label className="badge" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!s.isIndexLike}
                  onChange={(e) => updateSubject(s.id, { isIndexLike: e.target.checked })}
                />
                指数类
              </label>
              <label className="badge" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={s.includeInNetWorth !== false}
                  onChange={(e) => updateSubject(s.id, { includeInNetWorth: e.target.checked })}
                />
                计入净资产
              </label>
              <button
                className="btn"
                onClick={() => {
                  const ok = confirm(`删除科目「${s.name}」？将同时移除所有月份的对应条目。`);
                  if (ok) onDeleteSubject(s.id);
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackupPanel({ state, setState }) {
  const [json, setJson] = useState("");

  const exportToTextarea = useCallback(() => {
    setJson(JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }, null, 2));
  }, [state]);

  const downloadJson = useCallback(() => {
    const content = JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const timestamp = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [state]);

  const importJson = useCallback(() => {
    try {
      const raw = JSON.parse(json);

      const candidate =
        isRecord(raw) && typeof raw.schemaVersion === "number" && raw.state !== undefined ? raw.state : raw;

      if (!validateAppStateLike(candidate)) {
        alert("导入失败：JSON 结构不符合 AppState（subjects/months/settings）");
        return;
      }

      setState(candidate);
      alert("导入成功");
    } catch {
      alert("JSON 解析失败");
    }
  }, [json, setState]);

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div className="row wrap" style={{ justifyContent: "space-between" }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>备份</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={exportToTextarea}>导出</button>
          <button className="btn" onClick={downloadJson}>下载</button>
          <button className="btn" onClick={importJson}>导入</button>
        </div>
      </div>

      <textarea
        className="input"
        placeholder="点击“导出”查看内容，或在此粘贴 JSON 进行导入..."
        style={{ height: 220, marginTop: 10 }}
        value={json}
        onChange={(e) => setJson(e.target.value)}
      />

      <div className="note" style={{ marginTop: 8 }}>
        建议每月录入后下载一份 JSON 文件作为离线备份。
      </div>
    </div>
  );
}

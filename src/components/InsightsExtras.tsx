import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import type { AppState, MonthRecord } from "../types";

const fmt2 = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatCny(n: number) {
  if (!Number.isFinite(n)) return "--";
  return "￥" + fmt2.format(n);
}

function toCny(amount: number, currency: "CNY" | "USD", fx: number) {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "USD") return amount * fx;
  return amount;
}

function sumBy<T extends string>(obj: Record<T, number>, key: T, add: number) {
  obj[key] = (obj[key] ?? 0) + add;
}

function DarkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p?.name ?? p?.payload?.name;
  const value = Number(p?.value ?? 0);
  const pct = p?.payload?.pct;
  return (
    <div
      style={{
        background: "rgba(14,18,28,.92)",
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        minWidth: 180
      }}
    >
      <div style={{ color: "rgba(234,240,255,.86)", fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
        {name}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ color: "rgba(234,240,255,.65)", fontSize: 12 }}>金额（折算CNY）</div>
        <div style={{ color: "rgba(234,240,255,.92)", fontWeight: 900, fontSize: 12 }}>
          {formatCny(value)}
        </div>
      </div>
      {Number.isFinite(pct) && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
          <div style={{ color: "rgba(234,240,255,.65)", fontSize: 12 }}>占比</div>
          <div style={{ color: "rgba(234,240,255,.92)", fontWeight: 900, fontSize: 12 }}>
            {(pct * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
const PIE_COLORS = [
  "#60A5FA", // blue
  "#34D399", // green
  "#FBBF24", // amber
  "#A78BFA", // purple
  "#F472B6", // pink
  "#22D3EE", // cyan
  "#FB7185", // rose
  "#F97316"  // orange
];
export function PieBreakdown({
  title,
  items
}: {
  title: string;
  items: { name: string; value: number }[];
}) {
  const data = useMemo(() => {
    const total = items.reduce(
      (s, x) => s + (Number.isFinite(x.value) ? x.value : 0),
      0
    );

    return items
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((x) => ({
        ...x,
        pct: total > 0 ? x.value / total : 0
      }));
  }, [items]);

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div
        className="muted"
        style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}
      >
        {title}
      </div>

      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={32}
              wrapperStyle={{
                color: "rgba(234,240,255,.65)",
                fontSize: 12
              }}
            />

            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={2}
              stroke="rgba(255,255,255,.12)"
              strokeWidth={1}
              isAnimationActive={true}
            >
              {data.map((_, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function buildAssetPrompt({
  state,
  record,
  fx,
  birthYM = "2000-09",
  jobType = "央企职工",
  annualIncomeMinusBaseExpenseRmb = 350000
}: {
  state: AppState;
  record: MonthRecord;
  fx: number;

  // NEW
  birthYM?: string; // "YYYY-MM"
  jobType?: string;
  annualIncomeMinusBaseExpenseRmb?: number; // RMB
}) {
  const subjById = new Map(state.subjects.map((s) => [s.id, s]));
  const included = record.entries.filter((e) => {
    const s = subjById.get(e.subjectId);
    return s?.includeInNetWorth !== false;
  });

  const bucketTotals: Record<string, number> = {};
  const ccyTotals: Record<string, number> = {};
  const subjectTotals: { name: string; cny: number }[] = [];

  for (const e of included) {
    const s = subjById.get(e.subjectId);
    const amount = Number(e.amount ?? 0);
    const currency = (e.currency ?? "CNY") as "CNY" | "USD";
    const cny = toCny(amount, currency, fx);

    sumBy(bucketTotals as any, (s?.bucket ?? "Other") as any, cny);
    sumBy(ccyTotals as any, currency as any, cny);
    subjectTotals.push({ name: s?.name ?? e.subjectId, cny });
  }

  const sum = (o: Record<string, number>) =>
    Object.values(o).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  const totalCny = sum(bucketTotals);

  const topSubjects = subjectTotals
    .filter((x) => x.cny > 0)
    .sort((a, b) => b.cny - a.cny)
    .slice(0, 6);

  const bucketLines = Object.entries(bucketTotals)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) =>
        `- ${k}: ${formatCny(v)}（${totalCny > 0 ? ((v / totalCny) * 100).toFixed(1) : "0"}%）`
    )
    .join("\n");

  const ccyLines = Object.entries(ccyTotals)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([k, v]) =>
        `- ${k}: ${formatCny(v)}（${totalCny > 0 ? ((v / totalCny) * 100).toFixed(1) : "0"}%）`
    )
    .join("\n");

  const topLines = topSubjects.map((x) => `- ${x.name}: ${formatCny(x.cny)}`).join("\n");

  // NEW: age calc from "YYYY-MM" (assume day=01)
  const calcAge = (ym: string) => {
    const [yStr, mStr] = ym.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;

    const now = new Date();
    const birth = new Date(y, m - 1, 1);
    let age = now.getFullYear() - birth.getFullYear();
    const hasHadBirthdayMonth =
      now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= 1);
    if (!hasHadBirthdayMonth) age -= 1;
    return age;
  };

  const age = calcAge(birthYM);
  const personLine = `- 年龄：${age ?? "—"}（${birthYM} 出生）
- 职业：${jobType}
- 预期年收入-基本支出（可投资/可结余）：约 ${formatCny(annualIncomeMinusBaseExpenseRmb)} / 年`;

  return `这是我 ${record.month} 的个人资产快照（仅基于我导出的账本数据，USD->CNY 折算汇率=${fx.toFixed(4)}）。

0) 个人背景与现金流
${personLine}

1) 本月净资产（折算CNY口径）
- 合计: ${formatCny(totalCny)}

2) 资产结构（按大类 Bucket，占比按折算CNY）
${bucketLines || "- （暂无）"}

3) 币种结构（按币种 Currency，占比按折算CNY）
${ccyLines || "- （暂无）"}

4) Top 科目（折算CNY）
${topLines || "- （暂无）"}

请你：
结合我的职业，年龄和每年约 ${formatCny(
    annualIncomeMinusBaseExpenseRmb
  )} 的可结余/可投资现金流，结合各种资产目前的走势，帮助我理清宏观方向。`;
}


export function PromptBox({
  state,
  record,
  fx
}: {
  state: AppState;
  record: MonthRecord;
  fx: number;
}) {
  const [text, setText] = useState("");

  const gen = async () => {
    const t = buildAssetPrompt({ state, record, fx });
    setText(t);
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // ignore; user can manually copy
    }
  };

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>对话起点 Prompt</div>
          <div className="muted2" style={{ fontSize: 12, marginTop: 2 }}>一键生成并复制，直接粘贴到 ChatGPT 开始聊。</div>
        </div>
        <button className="btn primary" onClick={gen}>生成 Prompt</button>
      </div>

      {text && (
        <>
          <div className="subtleLine" />
          <textarea
            className="input"
            style={{ height: 220 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="note" style={{ marginTop: 8 }}>
            已尝试复制到剪贴板（若失败请手动复制）。
          </div>
        </>
      )}
    </div>
  );
}

/** helpers for App to compute pie data */
export function computeLatestBreakdowns({
  state,
  record,
  fx
}: {
  state: AppState;
  record: MonthRecord;
  fx: number;
}) {
  const subjById = new Map(state.subjects.map((s) => [s.id, s]));
  const included = record.entries.filter((e) => {
    const s = subjById.get(e.subjectId);
    return s?.includeInNetWorth !== false;
  });

  const bucketTotals: Record<string, number> = {};
  const ccyTotals: Record<string, number> = {};

  for (const e of included) {
    const s = subjById.get(e.subjectId);
    const amount = Number(e.amount ?? 0);
    const currency = (e.currency ?? "CNY") as "CNY" | "USD";
    const cny = toCny(amount, currency, fx);

    sumBy(bucketTotals as any, (s?.bucket ?? "Other") as any, cny);
    sumBy(ccyTotals as any, currency as any, cny);
  }

  const bucketItems = Object.entries(bucketTotals).map(([name, value]) => ({ name, value }));
  const ccyItems = Object.entries(ccyTotals).map(([name, value]) => ({ name, value }));

  return { bucketItems, ccyItems };
}
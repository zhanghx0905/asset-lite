import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { AppState, MonthRecord } from "../types";
import { toCny, sumBy } from "../lib/calc";

/** ---------- formatting helpers ---------- */
const fmtInt = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCny(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  return "￥" + fmt2.format(n);
}

function formatPct(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  return `${n.toFixed(1)}%`;
}
function formatCompactCny(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "--";
  // 以“万/百万”这种中文单位做紧凑显示（更像 dashboard）
  const abs = Math.abs(n);
  if (abs >= 1e8) return `￥${(n / 1e8).toFixed(0)}亿`;
  if (abs >= 1e4) return `￥${(n / 1e4).toFixed(0)}万`;
  return "￥" + fmtInt.format(n);
}
function formatMonthLabel(m: string) {
  // "2025-09" -> "09"
  if (!m) return m;
  const seg = m.split("-");
  return seg.length === 2 ? seg[1] : m;
}

/** ---------- shared chart style ---------- */
const gridStyle = { stroke: "rgba(255,255,255,.08)" };
const axisStyle = { stroke: "rgba(255,255,255,.25)", fontSize: 12 };
const tickStyle = { fill: "rgba(255,255,255,.55)" };

function DarkTooltip({
  active,
  label,
  payload,
  valueFormatter
}: {
  active?: boolean;
  label?: any;
  payload?: any[];
  valueFormatter?: (name: string, value: any, item?: any) => string;
}) {
  if (!active || !payload?.length) return null;

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
        {label}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.map((p: any) => {
          const name = p.name ?? p.dataKey;
          const val = p.value;
          const color = p.color ?? "rgba(255,255,255,.7)";
          const text = valueFormatter ? valueFormatter(name, val, p) : `${name}: ${fmt2.format(val)}`;
          return (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(234,240,255,.70)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: "inline-block" }} />
                <span style={{ fontSize: 12 }}>{name}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(234,240,255,.92)", fontWeight: 800 }}>{text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ---------- 1) Net worth line (CNY) ---------- */
export function NetWorthLine({ data }: { data: any[] }) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nwGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(99, 179, 237, .95)" />
              <stop offset="100%" stopColor="rgba(167, 139, 250, .95)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
          />
          <YAxis
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
            width={70}
            tickFormatter={(v) => formatCompactCny(v)}
          />
          <Tooltip
            content={
              <DarkTooltip
                valueFormatter={(_, v) => formatCny(v)}
              />
            }
          />
          <Line
            name="净资产"
            type="monotone"
            dataKey="cny"
            dot={false}
            stroke="url(#nwGlow)"
            strokeWidth={3}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** ---------- 2) IndexLike percent line ---------- */
export function IndexLikeLine({ data }: { data: any[] }) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
            width={50}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            content={
              <DarkTooltip valueFormatter={(_, v) => formatPct(v)} />
            }
          />
          <Line
            name="指数类占比"
            type="monotone"
            dataKey="indexLikePct"
            dot={false}
            stroke="rgba(34, 211, 238, .9)"
            strokeWidth={3}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** ---------- 3) Bucket stacked area (absolute CNY) ---------- */
export function BucketArea({ data }: { data: any[] }) {
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthLabel}
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
          />
          <YAxis
            tick={{ ...tickStyle }}
            axisLine={axisStyle}
            tickLine={false}
            width={70}
            tickFormatter={(v) => formatCompactCny(v)}
          />
          <Tooltip
            content={
              <DarkTooltip
                valueFormatter={(name, v, item) => {
                  // 这里把每一层显示成金额
                  return formatCny(v);
                }}
              />
            }
          />
          <Legend
            wrapperStyle={{ color: "rgba(234,240,255,.65)", fontSize: 12 }}
          />

          <Area name="Cash" type="monotone" dataKey="Cash" stackId="1" stroke="rgba(34,197,94,.9)" fill="rgba(34,197,94,.25)" />
          <Area name="Invest" type="monotone" dataKey="Invest" stackId="1" stroke="rgba(59,130,246,.9)" fill="rgba(59,130,246,.25)" />
          <Area name="Social" type="monotone" dataKey="Social" stackId="1" stroke="rgba(168,85,247,.9)" fill="rgba(168,85,247,.25)" />
          <Area name="Other" type="monotone" dataKey="Other" stackId="1" stroke="rgba(245,158,11,.9)" fill="rgba(245,158,11,.25)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
/** ---------- 4) Pie breakdown (various) ---------- */
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
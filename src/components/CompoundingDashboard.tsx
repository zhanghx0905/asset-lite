import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";

function shareRatio(annualReturn: number, totalYears: number, firstYears: number) {
  const r = 1 + annualReturn;
  if (!Number.isFinite(annualReturn) || !Number.isFinite(totalYears) || !Number.isFinite(firstYears)) return NaN;
  if (r <= 0 || totalYears <= 0 || firstYears <= 0) return NaN;

  const t = Math.min(firstYears, totalYears);
  const den = 1 - Math.pow(r, -totalYears);
  if (Math.abs(den) < 1e-12) return t / totalYears;
  return (1 - Math.pow(r, -t)) / den;
}

function contributionWeights(annualReturn: number, totalYears: number) {
  const r = 1 + annualReturn;
  if (r <= 0) return Array.from({ length: totalYears }, () => NaN);

  const raw = Array.from({ length: totalYears }, (_, i) => Math.pow(r, totalYears - 1 - i));
  const s = raw.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(s) || s === 0) return raw.map(() => NaN);
  return raw.map((v) => v / s);
}

const fmtPct1 = (x: any) => {
  const n = Number(x);
  if (!Number.isFinite(n)) return "--";
  return `${(n * 100).toFixed(1)}%`;
};

const gridStyle = { stroke: "rgba(255,255,255,.08)" };
const axisStyle = { stroke: "rgba(255,255,255,.25)", fontSize: 12 };
const tickStyle = { fill: "rgba(255,255,255,.55)", fontSize: 12 };

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
        minWidth: 220
      }}
    >
      <div style={{ color: "rgba(234,240,255,.86)", fontWeight: 900, fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {payload.map((p: any, idx: number) => {
          const name = p.name ?? p.dataKey ?? `series-${idx}`;
          const val = p.value;
          const color = p.color ?? "rgba(255,255,255,.7)";
          const text = valueFormatter ? valueFormatter(name, val, p) : String(val);
          return (
            <div key={`${name}-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
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

function Card({
  title,
  right,
  children,
  style
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(18,22,34,.72)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 18,
        boxShadow: "0 16px 40px rgba(0,0,0,.35)",
        padding: 14,
        ...style
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ color: "rgba(234,240,255,.9)", fontWeight: 900, fontSize: 13, letterSpacing: ".02em" }}>
          {title}
        </div>
        {right}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function Badge({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.06)",
        color: "rgba(234,240,255,.86)",
        fontSize: 12,
        fontWeight: 800
      }}
    >
      {children}
    </span>
  );
}

function SliderRow({
  label,
  valueText,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ color: "rgba(234,240,255,.82)", fontSize: 12, fontWeight: 800 }}>{label}</div>
        <div style={{ color: "rgba(234,240,255,.9)", fontSize: 12, fontWeight: 900 }}>{valueText}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

export default function CompoundingDashboard() {
  const [annualReturnPct, setAnnualReturnPct] = useState(10.0);
  const [totalYears, setTotalYears] = useState(30);
  const [firstYears, setFirstYears] = useState(10);

  const annualReturn = annualReturnPct / 100.0;

  const safe = useMemo(() => {
    const r = 1 + annualReturn;
    const total = Math.max(1, totalYears);
    const first = Math.max(1, Math.min(firstYears, total));
    const invalid = !(r > 0);
    return { total, first, invalid };
  }, [annualReturn, totalYears, firstYears]);

  const warning = useMemo(() => {
    if (safe.invalid) return "年化收益率 ≤ -100% 时模型失效";
    if (firstYears > totalYears) return "已自动把“前几年”限制在“总年限”以内";
    return "";
  }, [safe.invalid, firstYears, totalYears]);

  const earlyShare = useMemo(() => {
    if (safe.invalid) return NaN;
    return shareRatio(annualReturn, safe.total, safe.first);
  }, [annualReturn, safe]);

  const perYearData = useMemo(() => {
    if (safe.invalid) return [];
    const w = contributionWeights(annualReturn, safe.total);
    let cum = 0;
    return w.map((weight, i) => {
      cum += weight;
      return {
        year: i + 1,
        weight,
        cumShare: cum
      };
    });
  }, [annualReturn, safe]);

  const shareCurveData = useMemo(() => {
    if (safe.invalid) return [];
    const rows: Array<{ years: number; earlyShare: number; longRunLimit: number }> = [];
    for (let n = safe.first; n <= 60; n++) {
      rows.push({
        years: n,
        earlyShare: shareRatio(annualReturn, n, safe.first),
        longRunLimit: 1 - Math.pow(1 + annualReturn, -safe.first)
      });
    }
    return rows;
  }, [annualReturn, safe]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(120,99,255,.18), transparent 55%)," +
          "radial-gradient(900px 500px at 80% 0%, rgba(99,179,237,.16), transparent 60%)," +
          "linear-gradient(180deg, rgba(10,12,18,1) 0%, rgba(8,10,16,1) 60%, rgba(6,8,14,1) 100%)",
        padding: 22,
        color: "white"
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: ".01em" }}>复利：越早投入越重要？</div>
            <div style={{ color: "rgba(234,240,255,.65)", fontSize: 12, marginTop: 4 }}>按“每年年末投入同样金额”计算</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge>年化收益率 {annualReturnPct.toFixed(1)}%</Badge>
            <Badge>总年限 {safe.total} 年</Badge>
            <Badge>前 {safe.first} 年</Badge>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, alignItems: "start" }}>
          <Card title="参数" right={warning ? <Badge title={warning}>⚠ 提示</Badge> : <Badge>实时更新</Badge>} style={{ position: "sticky", top: 18 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <SliderRow
                label="年化收益率"
                valueText={`${annualReturnPct.toFixed(1)}%`}
                min={-5}
                max={50}
                step={0.1}
                value={annualReturnPct}
                onChange={setAnnualReturnPct}
              />
              <SliderRow label="总投资年限" valueText={`${totalYears} 年`} min={1} max={120} step={1} value={totalYears} onChange={setTotalYears} />
              <SliderRow label="最开始投入的几年" valueText={`${firstYears} 年`} min={1} max={120} step={1} value={firstYears} onChange={setFirstYears} />

              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.05)",
                  padding: 12,
                  display: "grid",
                  gap: 8
                }}
              >
                <div style={{ color: "rgba(234,240,255,.70)", fontSize: 12, fontWeight: 800 }}>最开始投入的几年，占最终资产的比例</div>
                <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: ".01em" }}>
                  {Number.isFinite(earlyShare) ? fmtPct1(earlyShare) : "—"}
                </div>
                {warning ? <div style={{ color: "rgba(255,210,128,.92)", fontSize: 12, fontWeight: 800 }}>{warning}</div> : null}
              </div>
            </div>
          </Card>

          <div style={{ display: "grid", gap: 14 }}>
            <Card title="累计贡献：从最早那一年开始，累加到现在占了多少">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={perYearData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(167, 139, 250, .95)" />
                        <stop offset="100%" stopColor="rgba(99, 179, 237, .95)" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
                    <XAxis dataKey="year" tick={{ ...tickStyle }} axisLine={axisStyle} tickLine={false} />
                    <YAxis
                      tick={{ ...tickStyle }}
                      axisLine={axisStyle}
                      tickLine={false}
                      width={66}
                      domain={[0, 1]}
                      tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                    />
                    <Tooltip content={<DarkTooltip valueFormatter={(_, v) => fmtPct1(v)} />} />
                    <Line
                      name="累计占比"
                      type="monotone"
                      dataKey="cumShare"
                      dot={false}
                      stroke="url(#cumGlow)"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="总年限拉长时：最开始投入的几年，产生的总回报比例会越来越接近一个极限">
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={shareCurveData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="shareGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(99, 179, 237, .95)" />
                        <stop offset="100%" stopColor="rgba(167, 139, 250, .95)" />
                      </linearGradient>
                      <linearGradient id="limitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(167, 139, 250, .20)" />
                        <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
                    <XAxis dataKey="years" tick={{ ...tickStyle }} axisLine={axisStyle} tickLine={false} type="number" domain={["dataMin", "dataMax"]} />
                    <YAxis
                      tick={{ ...tickStyle }}
                      axisLine={axisStyle}
                      tickLine={false}
                      width={66}
                      tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                      domain={[0, 1]}
                    />
                    <Tooltip content={<DarkTooltip valueFormatter={(_, v) => fmtPct1(v)} />} />

                    <Line
                      name="最开始投入的几年占比"
                      type="monotone"
                      dataKey="earlyShare"
                      dot={false}
                      stroke="url(#shareGlow)"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                    <Area
                      name="最终会接近的上限"
                      type="monotone"
                      dataKey="longRunLimit"
                      stroke="rgba(167, 139, 250, .55)"
                      fill="url(#limitFill)"
                      dot={false}
                      activeDot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="每一年投入的重要性：哪一年更“值钱”">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={perYearData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(99, 179, 237, .22)" />
                        <stop offset="100%" stopColor="rgba(99, 179, 237, 0)" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="4 8" {...gridStyle} />
                    <XAxis dataKey="year" tick={{ ...tickStyle }} axisLine={axisStyle} tickLine={false} />
                    <YAxis
                      tick={{ ...tickStyle }}
                      axisLine={axisStyle}
                      tickLine={false}
                      width={66}
                      tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                    />
                    <Tooltip content={<DarkTooltip valueFormatter={(_, v) => fmtPct1(v)} />} />
                    <Area
                      name="单年权重"
                      type="monotone"
                      dataKey="weight"
                      stroke="rgba(99, 179, 237, .85)"
                      fill="url(#wFill)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

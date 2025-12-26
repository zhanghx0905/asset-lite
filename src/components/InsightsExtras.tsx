import { useState } from "react";
import type { AppState, MonthRecord } from "../types";
import { formatCny } from "./Charts";
import { sumBy, toCny } from "../lib/calc";


function buildAssetPrompt({
  state,
  record,
  fx,
  background = "出生日期 ..., 职业 ...，每年可结余/可投资现金流约 ... 元",
}: {
  state: AppState;
  record: MonthRecord;
  fx: number;

  // NEW
  background?: string;
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


  const personLine = `- ${background}`
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
结合我的职业，年龄和每年的可结余/可投资现金流，结合各种资产目前的走势，帮助我理清宏观方向。`;
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

  const buildAndMaybeCopy = async () => {
    const t = buildAssetPrompt({ state, record, fx });
    setText(t);
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // ignore; user can manually copy
    }
    return t;
  };

  const openChatGPT = async () => {
    const t = text || (await buildAndMaybeCopy());
    const url = `https://chatgpt.com/?q=${encodeURIComponent(t)}`; // community-known way to prefill :contentReference[oaicite:3]{index=3}
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /**
   * 方案A：打开 Gemini 网页版（通常不支持 URL 预填充），但我们已先复制，用户进去直接 Ctrl+V。
   * 方案B：打开 Google AI Studio（支持 ?prompt= 预填充）:contentReference[oaicite:4]{index=4}
   */
  const openGemini = async () => {
    const t = text || (await buildAndMaybeCopy());

    // 方案A：Gemini 网页版（预填充大概率无效，但会打开；prompt 已复制）
    window.open("https://gemini.google.com/app", "_blank", "noopener,noreferrer");
  };

  const gen = async () => {
    await buildAndMaybeCopy();
  };

  return (
    <div className="card pad" style={{ background: "rgba(255,255,255,.04)" }}>
      <div
        className="row wrap"
        style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}
      >
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
            与大模型探讨资产组合
          </div>
          <div className="muted2" style={{ fontSize: 12, marginTop: 2 }}>
            一键生成 Prompt 并复制，直接粘贴到 ChatGPT / Gemini 开始聊。
          </div>
        </div>

        <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={openChatGPT} title="打开新标签页并预填充">
            与 ChatGPT 对话
          </button>
          <button className="btn" onClick={openGemini} title="打开新标签页（会先复制 Prompt）">
            与 Gemini 对话
          </button>
          <button className="btn primary" onClick={gen}>
            生成 Prompt
          </button>
        </div>
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
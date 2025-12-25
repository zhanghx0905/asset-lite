import { Parser } from "expr-eval";

const parser = new Parser({
  operators: {
    // keep it simple: + - * / % ^ and parentheses
    add: true,
    concatenate: false,
    conditional: false,
    divide: true,
    factorial: false,
    multiply: true,
    power: true,
    remainder: true,
    subtract: true,
    logical: false,
    comparison: false,
    in: false,
    assignment: false
  }
});

export function evalFormula(input: string): { ok: true; value: number } | { ok: false; error: string } {
  const s = (input ?? "").trim();
  if (!s) return { ok: true, value: 0 };

  try {
    // Disallow variables/functions by evaluating with empty scope.
    const expr = parser.parse(s);
    const v = expr.evaluate({});
    const n = Number(v);
    if (!Number.isFinite(n)) return { ok: false, error: "结果不是有限数字" };
    return { ok: true, value: n };
  } catch (e: any) {
    return { ok: false, error: e?.message || "公式解析失败" };
  }
}

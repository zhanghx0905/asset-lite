/**
 * Best-effort auto FX fetch without backend.
 * Many finance endpoints block browser CORS. To keep "no backend" requirement,
 * this uses corsproxy.io as an optional relay. If it fails, user can input manually.
 * NOTE: This is intentionally "best-effort": if the proxy is down/blocked, we fall back gracefully.
 */
export async function fetchUSDCNHViaCorsProxy(): Promise<{ ok: true; rate: number } | { ok: false; error: string }> {
  try {
    // Yahoo chart endpoint (often works when proxied)
    const target = "https://query1.finance.yahoo.com/v8/finance/chart/USDCNH=X?range=1d&interval=1m";
    const url = "https://corsproxy.io/?url=" + encodeURIComponent(target);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const j = await r.json();
    const rate = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const n = Number(rate);
    if (!Number.isFinite(n)) return { ok: false, error: "无法解析 USDCNH" };
    return { ok: true, rate: n };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch 失败" };
  }
}

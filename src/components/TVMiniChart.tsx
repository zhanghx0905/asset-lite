import React, { useEffect, useMemo, useRef, useState } from "react";

type TVMiniChartProps = {
  symbol: string; // e.g. "FX:USDCNH", "NASDAQ:QQQ", "BINANCE:BTCUSDT"
  title?: string;
  height?: number;

  /** Widget options */
  dateRange?: "1D" | "5D" | "1M" | "3M" | "6M" | "12M" | "60M" | "ALL";
  locale?: string; // "zh_CN"
  theme?: "dark" | "light";
  transparent?: boolean;
  autosize?: boolean;

  /** UX */
  showHeader?: boolean;
  showSymbol?: boolean;
  clickableHeader?: boolean; // click title to open TradingView
  largeChartUrl?: string; // optional override; if empty, auto-generate
  className?: string;
  style?: React.CSSProperties;

  /** Force re-init externally (e.g., theme switch) */
  refreshKey?: any;
};

function buildTradingViewChartUrl(symbol: string) {
  // TradingView chart url that works well for most symbols
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

// Small helper: create once-per-widget unique container id
function makeSafeId(symbol: string) {
  return `tvmini_${symbol.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export default function TVMiniChart({
  symbol,
  title,
  height = 220,
  dateRange = "6M",
  locale = "zh_CN",
  theme = "dark",
  transparent = true,
  autosize = true,

  showHeader = true,
  showSymbol = true,
  clickableHeader = true,
  largeChartUrl,
  className,
  style,

  refreshKey
}: TVMiniChartProps) {
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const safeId = useMemo(() => makeSafeId(symbol), [symbol]);
  const resolvedTitle = title ?? symbol;
  const resolvedUrl = largeChartUrl && largeChartUrl.trim() ? largeChartUrl : buildTradingViewChartUrl(symbol);

  useEffect(() => {
    const host = widgetHostRef.current;
    if (!host) return;

    setLoadErr(null);

    // StrictMode / rerender safety: clean up previous widget + script
    host.innerHTML = "";
    if (scriptRef.current) {
      scriptRef.current.remove();
      scriptRef.current = null;
    }

    // TradingView requires script tag whose content is JSON config.
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

    // If script fails (adblock, CSP, offline), show fallback
    script.onerror = () => setLoadErr("加载失败（可能被广告拦截 / 网络问题）");

    script.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      height,
      locale,
      dateRange,
      colorTheme: theme,
      isTransparent: transparent,
      autosize,
      largeChartUrl: resolvedUrl || ""
    });

    host.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      if (widgetHostRef.current) widgetHostRef.current.innerHTML = "";
    };
    // refreshKey: allow external force refresh
  }, [symbol, height, locale, dateRange, theme, transparent, autosize, resolvedUrl, refreshKey]);

  return (
    <div className={className} style={style}>
      {showHeader && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            {clickableHeader ? (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontWeight: 900,
                  fontSize: 13,
                  color: "rgba(234,240,255,.86)",
                  textDecoration: "none"
                }}
                title="在 TradingView 打开"
              >
                {resolvedTitle}
              </a>
            ) : (
              <div style={{ fontWeight: 900, fontSize: 13, color: "rgba(234,240,255,.86)" }}>{resolvedTitle}</div>
            )}

            {loadErr && (
              <span className="badge" title={loadErr}>
                ⚠ {loadErr}
              </span>
            )}
          </div>

          {showSymbol && <div style={{ fontSize: 12, color: "rgba(234,240,255,.55)" }}>{symbol}</div>}
        </div>
      )}

      <div className="tradingview-widget-container" style={{ width: "100%" }}>
        {/* TradingView script will fill this container */}
        <div
          id={safeId}
          ref={widgetHostRef}
          className="tradingview-widget-container__widget"
          style={{ width: "100%", height }}
        />

        {/* Fallback UI if script fails */}
        {loadErr && (
          <div className="note" style={{ marginTop: 10 }}>
            你也可以直接打开：
            <a href={resolvedUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>
              {symbol}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

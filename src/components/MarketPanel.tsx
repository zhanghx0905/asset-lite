import { useEffect, useState } from "react";
import TVMiniChart from "./TVMiniChart";

export default function MarketPanel() {
  const [open, setOpen] = useState(() => localStorage.getItem("market-open") !== "false");

  useEffect(() => {
    localStorage.setItem("market-open", String(open));
  }, [open]);

  return (
    <div className="card pad">
      <div className="sectionTitle" onClick={() => setOpen(v => !v)} style={{ cursor: "pointer" }}>
        <div className="h2">实时行情</div>
        <div style={{ transform: open ? "rotate(90deg)" : "none" }}>▶</div>
      </div>

      <div style={{ maxHeight: open ? 500 : 0, overflow: "hidden", transition: "all .25s" }}>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 12 }}>
          <TVMiniChart symbol="NASDAQ:QQQ" title="QQQ" />
          <TVMiniChart symbol="BINANCE:BTCUSDT" title="BTC" />
          <TVMiniChart symbol="FX:USDCNH" title="USDCNH" />
        </div>
      </div>
    </div>
  );
}

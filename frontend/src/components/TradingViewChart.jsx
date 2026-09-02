import { useEffect, useRef } from "react";
import { TV_SYMBOL_MAP } from "../utils/market";

export default function TradingViewChart({ symbol, height = 320, theme = "light" }) {
  const containerRef = useRef(null);
  const tvSymbol = symbol && TV_SYMBOL_MAP[symbol] ? TV_SYMBOL_MAP[symbol] : symbol ? `NSE:${symbol}` : null;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tvSymbol) return;
    container.innerHTML = "";
    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.text = JSON.stringify({ autosize: true, symbol: tvSymbol, interval: "15", timezone: "Asia/Kolkata", theme, style: "1", locale: "en", hide_top_toolbar: false, hide_side_toolbar: false, withdateranges: true, allow_symbol_change: false, support_host: "https://www.tradingview.com" });
    container.appendChild(script);
  }, [tvSymbol, theme]);
  return <div className="tradingview-widget-container" ref={containerRef} style={{ height, width: "100%", borderRadius: 10, overflow: "hidden" }}>{!tvSymbol && <div style={{ padding: 24 }}>Select a valid contract to view its chart.</div>}</div>;
}

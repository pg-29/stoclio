import { useEffect, useRef, useState } from "react";
import { TV_SYMBOL_MAP } from "../utils/market";

export default function TradingViewChart({ symbol, height = 320, theme = "light", fallbackData = [] }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const tvSymbol = symbol && TV_SYMBOL_MAP[symbol] ? TV_SYMBOL_MAP[symbol] : symbol ? `NSE:${symbol}` : null;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tvSymbol) return;
    setFailed(false);
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
    script.onerror = () => setFailed(true);
    script.text = JSON.stringify({ autosize: true, symbol: tvSymbol, interval: "15", timezone: "Asia/Kolkata", theme, style: "1", locale: "en", hide_top_toolbar: false, hide_side_toolbar: false, withdateranges: true, allow_symbol_change: false, support_host: "https://www.tradingview.com" });
    container.appendChild(script);
  }, [tvSymbol, theme]);
  const points = fallbackData.map((row, index) => `${(index / Math.max(fallbackData.length - 1, 1)) * 100},${100 - ((Number(row[4]) - Math.min(...fallbackData.map((item) => Number(item[3])))) / ((Math.max(...fallbackData.map((item) => Number(item[2]))) - Math.min(...fallbackData.map((item) => Number(item[3])))) || 1)) * 100}`).join(" ");
  return <div className="tradingview-widget-container" ref={containerRef} style={{ height, width: "100%", borderRadius: 10, overflow: "hidden" }}>{!tvSymbol && <div style={{ padding: 24 }}>Loading Market Data</div>}{failed && <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", background: "#f7faff" }}><polyline points={points} fill="none" stroke="#2F6FED" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>}</div>;
}

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import InstrumentTable from "../components/InstrumentTable.jsx";
import { marketApi } from "../services/market";
import { COLORS, fontBody, fontDisplay } from "../utils/market";

function normalize(item) {
  return { ...item, symbol: item.tradingsymbol || item.tradingSymbol || item.symbol, price: Number(item.ltp ?? item.last_traded_price), open: Number(item.open ?? item.open_price_day), volume: Number(item.tradeVolume ?? item.trade_volume ?? item.volume), changePercent: Number(item.percentChange ?? item.changePercent) };
}
function Movers({ title, items, color }) {
  return <section style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, fontFamily: fontDisplay, fontWeight: 600, fontSize: 13.5, color: COLORS.ink }}><Flame size={14} color={color} />{title}</div>{items.length ? items.map((item) => <div key={item.symbol} style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, auto)", gap: 12, padding: "9px 0", borderTop: `1px solid ${COLORS.line}`, fontFamily: fontBody, fontSize: 12.5 }}><span>{item.symbol}</span><span>₹{item.price.toLocaleString("en-IN")}</span><span style={{ color }}>{item.changePercent.toFixed(2)}%</span><span>{item.volume.toLocaleString("en-IN")}</span></div>) : <div style={{ color: COLORS.inkMuted, fontFamily: fontBody, fontSize: 13 }}>Live data is unavailable.</div>}</section>;
}
export default function Stocks({ stocks = [] }) {
  const [gainers, setGainers] = useState([]); const [losers, setLosers] = useState([]);
  useEffect(() => { let active = true; Promise.all([marketApi.gainers(), marketApi.losers()]).then(([up, down]) => { if (active) { setGainers((up.data.data || []).map(normalize).slice(0, 5)); setLosers((down.data.data || []).map(normalize).slice(0, 5)); } }).catch(() => { if (active) { setGainers([]); setLosers([]); } }); return () => { active = false; }; }, []);
  return <div style={{ background: COLORS.paper }}><div className="lv-page-wrap"><h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 26, color: COLORS.ink, margin: "0 0 6px" }}>Stocks</h1><p style={{ fontFamily: fontBody, fontSize: 13.5, color: COLORS.inkMuted, margin: "0 0 20px" }}>NSE-listed equities and live Angel One SmartAPI quotes.</p><div className="lv-movers-grid" style={{ marginBottom: 18 }}><Movers title="Top 5 gainers today" items={gainers} color={COLORS.up} /><Movers title="Top 5 losers today" items={losers} color={COLORS.down} /></div><InstrumentTable title="All tracked stocks" subtitle="Live quotes only" items={stocks} onSelect={(symbol) => { window.history.pushState({}, "", `/stocks/${encodeURIComponent(symbol)}`); window.dispatchEvent(new PopStateEvent("popstate")); }} /></div></div>;
}

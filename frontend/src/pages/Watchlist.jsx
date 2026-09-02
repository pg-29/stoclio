import { useState } from "react";
import TradingViewChart from "../components/TradingViewChart.jsx";
import InstrumentTable from "../components/InstrumentTable.jsx";
import { COLORS, fontBody, fontDisplay } from "../utils/market";

export default function Watchlist({ stocks = [], initialSymbol }) {
  const [selected, setSelected] = useState(initialSymbol || stocks[0]?.symbol);
  const chosen = stocks.find((item) => item.symbol === selected) || stocks[0];
  return <div style={{ background: COLORS.paper }}><div className="lv-page-wrap"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}><div><h1 style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 26, color: COLORS.ink, margin: "0 0 6px" }}>Watchlists</h1><p style={{ fontFamily: fontBody, fontSize: 13.5, color: COLORS.inkMuted }}>Your saved instruments and live Angel One quotes.</p></div><button style={{ background: COLORS.accent, color: "#fff", border: 0, borderRadius: 8, padding: "9px 14px" }}>Create watchlist</button></div>{chosen ? <div className="lv-card" style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginTop: 24 }}><TradingViewChart symbol={chosen.symbol} height={300} /></div> : <div className="lv-card" style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 32, marginTop: 24, textAlign: "center" }}><h2 style={{ fontFamily: fontDisplay, color: COLORS.ink }}>Create Your First Watchlist</h2><p style={{ fontFamily: fontBody, color: COLORS.inkMuted }}>Add instruments from search to track live prices here.</p></div>}{stocks.length > 0 && <div style={{ marginTop: 24 }}><InstrumentTable title="Saved instruments" subtitle="Live quotes" items={stocks} onSelect={setSelected} /></div>}</div></div>;
}

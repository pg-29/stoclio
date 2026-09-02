import { useEffect, useState } from "react";
import { marketApi } from "../services/market";
import { COLORS, fontBody, fontDisplay } from "../utils/market";

function CandleChart({ candles }) {
  const rows = (Array.isArray(candles) ? candles : []).map((row) => ({ high: Number(row[2]), low: Number(row[3]), close: Number(row[4]) })).filter((row) => Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close));
  if (!rows.length) return <div style={{ color: COLORS.inkMuted, fontFamily: fontBody, padding: 20 }}>Historical candles are unavailable.</div>;
  const high = Math.max(...rows.map((row) => row.high)); const low = Math.min(...rows.map((row) => row.low)); const range = high - low || 1;
  const points = rows.map((row, index) => `${(index / Math.max(rows.length - 1, 1)) * 100},${100 - ((row.close - low) / range) * 100}`).join(" ");
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 300, display: "block" }} role="img" aria-label="Historical price chart"><polyline points={points} fill="none" stroke={COLORS.accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}
function Depth({ depth }) {
  const bids = depth?.bids || depth?.buy || []; const asks = depth?.asks || depth?.sell || [];
  if (!bids.length && !asks.length) return <div style={{ color: COLORS.inkMuted }}>Market depth is unavailable.</div>;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, fontFamily: fontBody, fontSize: 13 }}><div><strong style={{ color: COLORS.up }}>Bids</strong>{bids.slice(0, 5).map((row, index) => <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${COLORS.line}` }}><span>{row.price}</span><span>{row.quantity ?? row.qty}</span></div>)}</div><div><strong style={{ color: COLORS.down }}>Asks</strong>{asks.slice(0, 5).map((row, index) => <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${COLORS.line}` }}><span>{row.price}</span><span>{row.quantity ?? row.qty}</span></div>)}</div></div>;
}
export default function StockDetails({ symbol }) {
  const [data, setData] = useState(null); const [candles, setCandles] = useState([]); const [error, setError] = useState(false);
  useEffect(() => { let active = true; setData(null); setCandles([]); setError(false); Promise.all([marketApi.stock(symbol), marketApi.candles(symbol)]).then(([quoteResponse, candleResponse]) => { if (!active) return; setData(quoteResponse.data.data); setCandles(candleResponse.data.data?.candles || []); }).catch(() => active && setError(true)); return () => { active = false; }; }, [symbol]);
  if (error) return <div className="lv-page-wrap" style={{ color: COLORS.down, fontFamily: fontBody }}>Live quote or historical data unavailable for {symbol}.</div>;
  if (!data) return <div className="lv-page-wrap" style={{ color: COLORS.inkMuted, fontFamily: fontBody }}>Loading live quote...</div>;
  const fields = [["LTP", data.ltp], ["Open", data.open], ["High", data.high], ["Low", data.low], ["Previous close", data.previousClose], ["Change %", `${Number(data.changePercent).toFixed(2)}%`], ["Volume", Number(data.volume).toLocaleString("en-IN")]];
  return <div style={{ background: COLORS.paper }}><div className="lv-page-wrap"><h1 style={{ fontFamily: fontDisplay, color: COLORS.ink, margin: "0 0 4px" }}>{data.name || data.symbol}</h1><p style={{ fontFamily: fontBody, color: COLORS.inkMuted, marginBottom: 18 }}>{data.symbol} · {data.exchange} · Angel One live data</p><div className="lv-summary-grid" style={{ marginBottom: 18 }}>{fields.map(([label, value]) => <div key={label} style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14 }}><div style={{ fontFamily: fontBody, fontSize: 12, color: COLORS.inkMuted }}>{label}</div><strong style={{ fontFamily: fontBody, color: COLORS.ink }}>{value ?? "-"}</strong></div>)}</div><div style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 14, marginBottom: 18 }}><h2 style={{ fontFamily: fontDisplay, color: COLORS.ink }}>Historical chart</h2><CandleChart candles={candles} /></div><div style={{ background: COLORS.paperCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, fontFamily: fontBody }}><h2 style={{ fontFamily: fontDisplay, color: COLORS.ink }}>Market depth</h2><Depth depth={data.depth} /></div></div></div>;
}

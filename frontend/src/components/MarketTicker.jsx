import { COLORS, fontBody, fontMono, fmt, pctChange } from "../utils/market";
import { ChangeTag } from "./MarketShared.jsx";

export default function MarketTicker({ indices, commodities }) {
  const row = [...indices, ...commodities, ...indices, ...commodities];
  return <div style={{ background: COLORS.navy2, borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", whiteSpace: "nowrap" }}><div style={{ display: "inline-flex", padding: "9px 0", animation: "lv-scroll 26s linear infinite" }}>{row.map((idx, i) => <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 24px", borderRight: "1px solid rgba(255,255,255,0.1)" }}><span style={{ fontFamily: fontBody, fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>{idx.symbol}{idx.unit ? ` ${idx.unit}` : ""}</span><span style={{ fontFamily: fontMono, fontSize: 12.5, color: "#fff" }}>{fmt(idx.price)}</span><ChangeTag change={pctChange(idx.price, idx.open)} size={11.5} /></div>)}</div><style>{`@keyframes lv-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style></div>;
}

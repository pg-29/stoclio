import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useMarketStatus } from "../hooks/marketHooks";
import { COLORS, fontBody, fontMono, fmt } from "../utils/market";

export function MarketStatusBadge({ compact, light }) {
  const { isOpen, nextOpenLabel } = useMarketStatus();
  const closedColor = light ? COLORS.inkMuted : "rgba(255,255,255,0.65)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fontBody, fontSize: compact ? 11 : 12.5, color: isOpen ? COLORS.up : closedColor }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: isOpen ? COLORS.up : COLORS.down, display: "inline-block", flexShrink: 0 }} />
      {isOpen ? "Market open" : `Market closed — opens ${nextOpenLabel}`}
    </div>
  );
}

export function ChangeTag({ change, size = 13 }) {
  const positive = change >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: fontMono, fontSize: size, fontWeight: 500, color: positive ? COLORS.up : COLORS.down, whiteSpace: "nowrap" }}>
      {positive ? <ArrowUpRight size={size} /> : <ArrowDownRight size={size} />}
      {positive ? "+" : ""}
      {fmt(change)}%
    </span>
  );
}

export function Sparkline({ history, width = 72, height = 26 }) {
  if (!history || history.length < 2) return <div style={{ width, height }} />;
  const prices = history.map((item) => item.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const up = prices[prices.length - 1] >= prices[0];
  const points = prices.map((price, index) => {
    const x = (index / (prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <svg width={width} height={height} style={{ display: "block" }}><polyline points={points} fill="none" stroke={up ? COLORS.up : COLORS.down} strokeWidth="1.6" /></svg>;
}

export function LiveStatusDot({ status }) {
  const live = status === "live";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: fontBody, fontSize: 11, color: live ? COLORS.up : "rgba(255,255,255,0.45)" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: live ? COLORS.up : "rgba(255,255,255,0.4)", display: "inline-block" }} />
      {live ? "live feed" : "live feed unavailable"}
    </span>
  );
}

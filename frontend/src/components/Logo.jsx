import { COLORS, fontDisplay } from "../utils/market";

export default function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, cursor: "pointer" }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: fontDisplay, fontWeight: 700, fontSize: 16 }}>S</div>
      <span style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em", color: "#fff" }}>Stocro</span>
    </div>
  );
}

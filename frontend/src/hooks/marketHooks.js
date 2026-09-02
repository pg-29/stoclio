import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import api from "../services/api";
import { INDEX_INSTRUMENTS, COMMODITY_INSTRUMENTS, STOCK_INSTRUMENTS } from "../utils/market";

export function useGlobalStyles(globalCss) {
  useEffect(() => {
    if (!document.getElementById("lv-fonts")) { const link = document.createElement("link"); link.id = "lv-fonts"; link.rel = "stylesheet"; link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"; document.head.appendChild(link); }
    if (!document.getElementById("lv-global-css")) { const style = document.createElement("style"); style.id = "lv-global-css"; style.textContent = globalCss; document.head.appendChild(style); }
  }, [globalCss]);
}
export function useViewport() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const onResize = () => setWidth(window.innerWidth); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, []);
  return { width, mobile: width <= 760, tablet: width > 760 && width <= 1080 };
}
export function useMarketStatus() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay(); const minutes = ist.getHours() * 60 + ist.getMinutes();
  const isOpen = day >= 1 && day <= 5 && minutes >= 555 && minutes < 930;
  let nextOpenLabel = "";
  if (!isOpen) { if (day >= 1 && day <= 5 && minutes < 555) nextOpenLabel = "today at 9:15 AM IST"; else { const next = new Date(ist); next.setDate(next.getDate() + 1); while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1); const label = next.toDateString() === new Date(ist.getTime() + 86400000).toDateString() ? "Tomorrow" : next.toLocaleDateString("en-IN", { weekday: "long" }); nextOpenLabel = `${label} at 9:15 AM IST`; } }
  return { isOpen, nextOpenLabel };
}
export function useMarket(catalog, exchange) {
  const [items, setItems] = useState([]);
  useEffect(() => { let cancelled = false; api.get(`/market/quote?symbols=${catalog.map((item) => encodeURIComponent(item.symbol)).join(",")}`).then(({ data }) => { if (cancelled) return; const quotes = Array.isArray(data.data) ? data.data : data.data?.fetched || []; const bySymbol = Object.fromEntries(quotes.map((quote) => [String(quote.tradingsymbol || quote.symbol || "").replace(/-EQ$/, "").toUpperCase(), quote])); setItems(catalog.flatMap((item) => { const quote = bySymbol[item.symbol]; const price = Number(quote?.ltp ?? quote?.price ?? quote?.last_traded_price); if (!Number.isFinite(price)) return []; const open = Number(quote?.open ?? quote?.open_price_day ?? price); return [{ ...item, exchange, price, open, prev: price, history: [{ t: 0, p: price }] }]; })); }).catch(() => { if (!cancelled) setItems([]); }); return () => { cancelled = true; }; }, [catalog, exchange]);
  return items;
}
export function useLiveFeed(url) {
  const [ticks, setTicks] = useState({}); const [status, setStatus] = useState(url ? "connecting" : "live feed unavailable");
  useEffect(() => { if (!url) return undefined; const socket = io(url, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 10000 }); const heartbeat = setInterval(() => socket.emit("market:heartbeat"), 10000); const symbols = [...INDEX_INSTRUMENTS, ...COMMODITY_INSTRUMENTS, ...STOCK_INSTRUMENTS].map((item) => item.symbol); const handleTick = (tick) => { if (!tick?.symbol || !Number.isFinite(Number(tick.price))) return; setTicks((prev) => ({ ...prev, [tick.symbol]: { price: Number(tick.price), change: Number(tick.change || 0), volume: Number(tick.volume || 0), ts: tick.timestamp || Date.now() } })); }; socket.on("connect", () => { setStatus("live"); socket.emit("subscribe:quotes", symbols); }); socket.on("disconnect", () => setStatus("live feed unavailable")); socket.on("connect_error", () => setStatus("live feed unavailable")); socket.on("market:tick", handleTick); socket.on("market:status", ({ status: streamStatus }) => setStatus(streamStatus === "live" ? "live" : "live feed unavailable")); return () => { clearInterval(heartbeat); socket.off("connect"); socket.off("disconnect"); socket.off("connect_error"); socket.off("market:tick", handleTick); socket.off("market:status"); socket.disconnect(); }; }, [url]);
  return { ticks, status };
}

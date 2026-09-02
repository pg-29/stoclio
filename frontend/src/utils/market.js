export const LIVE_FEED_SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const COLORS = {
  navy: "#081B3A", navy2: "#0F2A54", paper: "#EEF3FB", paperCard: "#FFFFFF",
  accent: "#2F6FED", accentSoft: "#BBD3FA", ink: "#0E1E38", inkMuted: "#516179",
  line: "#D9E4F5", up: "#1B8354", upSoft: "#E4F3EC", down: "#C23B32", downSoft: "#FBEAE8",
};
export const fontDisplay = "'Sora', system-ui, sans-serif";
export const fontBody = "'IBM Plex Sans', system-ui, sans-serif";
export const fontMono = "'IBM Plex Mono', ui-monospace, monospace";
export const GLASS = { background: "rgba(255,255,255,0.82)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "0 10px 34px rgba(8,27,58,0.28), inset 0 1px 0 rgba(255,255,255,0.5)" };
export const TV_SYMBOL_MAP = {
  RELIANCE: "NSE:RELIANCE", TCS: "NSE:TCS", HDFCBANK: "NSE:HDFCBANK", INFY: "NSE:INFY", ICICIBANK: "NSE:ICICIBANK", SBIN: "NSE:SBIN", ITC: "NSE:ITC", LT: "NSE:LT", BHARTIARTL: "NSE:BHARTIARTL", KOTAKBANK: "NSE:KOTAKBANK",
  "NIFTY 50": "NSE:NIFTY", SENSEX: "BSE:SENSEX", "BANK NIFTY": "NSE:BANKNIFTY", "FIN NIFTY": "NSE:CNXFINANCE", "MIDCAP NIFTY": "NSE:NIFTYMIDCAP100",
  GOLD: "MCX:GOLD1!", SILVER: "MCX:SILVER1!", "CRUDE OIL": "MCX:CRUDEOIL1!", "NATURAL GAS": "MCX:NATURALGAS1!",
};
export const STOCK_INSTRUMENTS = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy" }, { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT" }, { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking" }, { symbol: "INFY", name: "Infosys", sector: "IT" }, { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking" }, { symbol: "SBIN", name: "State Bank of India", sector: "Banking" }, { symbol: "ITC", name: "ITC Limited", sector: "FMCG" }, { symbol: "LT", name: "Larsen & Toubro", sector: "Infra" }, { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" }, { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking" },
];
export const INDEX_INSTRUMENTS = [{ symbol: "NIFTY 50" }, { symbol: "SENSEX" }, { symbol: "BANK NIFTY" }, { symbol: "FIN NIFTY" }, { symbol: "MIDCAP NIFTY" }];
export const COMMODITY_INSTRUMENTS = [{ symbol: "GOLD", unit: "/10g" }, { symbol: "SILVER", unit: "/kg" }, { symbol: "CRUDE OIL", unit: "/bbl" }, { symbol: "NATURAL GAS", unit: "/mmBtu" }];
export const SECTORS = ["IT", "Banking", "Energy", "FMCG", "Infra", "Telecom", "Pharma", "Auto", "Metals", "Realty", "Media", "PSU"];
export const fmt = (n, d = 2) => Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) : "Market Closed";
export const inr = (n) => "₹" + fmt(n);
export const pctChange = (price, open) => ((price - open) / open) * 100;
export const mergeLive = (items, liveTicks) => items.map((it) => { const live = liveTicks[it.symbol]; if (!live) return it; return { ...it, prev: it.price, price: live.price, history: [...it.history, { t: it.history.length, p: live.price }].slice(-40) }; });

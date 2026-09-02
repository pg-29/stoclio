const axios = require('axios');

const fallback = [
  { symbol: 'NIFTY 50', exchange: 'NSE', price: 22450.35, change: 148.2, changePercent: 0.66, spark: [40, 43, 42, 46, 44, 48, 52, 51, 55, 58, 57, 62] },
  { symbol: 'SENSEX', exchange: 'BSE', price: 73872.1, change: -82.4, changePercent: -0.11, spark: [61, 58, 60, 56, 59, 54, 55, 52, 53, 50, 49, 47] },
  { symbol: 'RELIANCE', exchange: 'NSE', price: 2934.6, change: 32.15, changePercent: 1.11, spark: [33, 35, 34, 39, 38, 43, 42, 47, 46, 51, 53, 56] },
  { symbol: 'TCS', exchange: 'NSE', price: 3918.25, change: 26.85, changePercent: 0.69, spark: [42, 45, 43, 46, 45, 49, 51, 50, 54, 57, 56, 60] },
  { symbol: 'HDFCBANK', exchange: 'NSE', price: 1682.4, change: -14.3, changePercent: -0.84, spark: [58, 56, 57, 53, 54, 51, 49, 50, 47, 48, 45, 43] },
];

async function getQuotes(symbols = fallback.map((quote) => quote.symbol)) {
  // SmartAPI is enabled only when its credentials are configured on the server.
  if (!process.env.ANGEL_API_KEY) return fallback.filter((quote) => symbols.includes(quote.symbol));
  // Keep the provider behind one boundary so user-facing routes never expose broker APIs.
  const response = await axios.get(process.env.MARKET_DATA_PROXY_URL, { params: { symbols: symbols.join(',') } });
  return response.data.data;
}

module.exports = { getQuotes, fallback };

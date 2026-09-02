import api from "./api";

export const marketApi = {
  quotes: (symbols) => api.get(`/market/quote?symbols=${symbols.map(encodeURIComponent).join(",")}`),
  search: (query, config) => api.get(`/market/search?q=${encodeURIComponent(query)}`, config),
  depth: (symbol) => api.get(`/market/depth/${encodeURIComponent(symbol)}`),
  gainers: () => api.get("/market/gainers"),
  losers: () => api.get("/market/losers"),
  stock: (symbol) => api.get(`/market/stock/${encodeURIComponent(symbol)}`),
  fnoOverview: () => api.get("/market/fno/overview"),
  fnoSearch: (query, config) => api.get(`/market/fno/search?q=${encodeURIComponent(query)}`, config),
  fno: (symbol) => api.get(`/market/fno/${encodeURIComponent(symbol)}`),
  candles: (symbol, params = {}) => api.get(`/market/candles/${encodeURIComponent(symbol)}`, { params }),
  fnoGreeks: (name, expirydate) => api.get(`/market/fno/greeks?name=${encodeURIComponent(name)}&expirydate=${encodeURIComponent(expirydate)}`),
  fnoSearchDedicated: (query, config) => api.get(`/fno/search?q=${encodeURIComponent(query)}`, config),
  fnoFutures: (query) => api.get(`/fno/futures?q=${encodeURIComponent(query)}`),
  fnoDetails: (symbol) => api.get(`/fno/${encodeURIComponent(symbol)}`),
  fnoDepth: (symbol) => api.get(`/fno/depth/${encodeURIComponent(symbol)}`),
  fnoHistory: (symbol, params = {}) => api.get(`/fno/history/${encodeURIComponent(symbol)}`, { params }),
  fnoExpiries: (query) => api.get(`/fno/expiries?q=${encodeURIComponent(query)}`),
};

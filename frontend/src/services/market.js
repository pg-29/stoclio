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
};

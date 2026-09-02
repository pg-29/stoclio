import api from "./api";

export const marketApi = {
  quotes: (symbols) => api.get(`/market/quote?symbols=${symbols.map(encodeURIComponent).join(",")}`),
  search: (query, config) => api.get(`/market/search?q=${encodeURIComponent(query)}`, config),
  depth: (symbol) => api.get(`/market/depth/${encodeURIComponent(symbol)}`),
};

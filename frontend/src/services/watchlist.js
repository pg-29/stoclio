import api from "./api";

export const watchlistApi = {
  list: () => api.get("/watchlist"),
  create: (payload) => api.post("/watchlist", payload),
  remove: (id) => api.delete(`/watchlist/${id}`),
  addSymbol: (id, symbol) => api.post(`/watchlist/${id}/symbols`, { symbol }),
  removeSymbol: (id, symbol) => api.delete(`/watchlist/${id}/symbols/${encodeURIComponent(symbol)}`),
};

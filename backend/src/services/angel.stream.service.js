const { WebSocketV2: AngelWebSocket } = require('smartapi-javascript');
const { ACTION, MODE, EXCHANGES } = require('smartapi-javascript/config/constant');
const { angel } = require('../config/env');
const angelService = require('./angel.service');

const RECONNECT_DELAY_MS = 4000;

function parseStreamTokens(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new Error('ANGEL_STREAM_TOKENS must be valid JSON');
  }
}

class AngelStreamService {
  constructor() {
    this.clients = new Set();
    this.subscribedSymbols = new Set();
    this.depthSymbols = new Set();
    this.socket = null;
    this.reconnectTimer = null;
    this.stopped = false;
    this.tokens = parseStreamTokens(angel.streamTokens);
    this.symbolByToken = Object.fromEntries(Object.entries(this.tokens).map(([symbol, item]) => [String(item.token), symbol]));
  }

  addClient(socket) {
    this.clients.add(socket);
    socket.on('disconnect', () => this.clients.delete(socket));
  }

  broadcast(tick) {
    for (const socket of this.clients) socket.emit('market:tick', tick);
  }

  normalizeTick(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const token = String(raw.token || '').replace(/^"|"$/g, '');
    const symbol = String(raw.symbol || raw.tradingsymbol || this.symbolByToken[token] || token).trim();
    const rawPrice = Number(raw.last_traded_price ?? raw.lastTradedPrice ?? raw.price);
    if (!symbol || !Number.isFinite(rawPrice)) return null;
    const price = raw.last_traded_price || raw.lastTradedPrice ? rawPrice / 100 : rawPrice;
    const open = Number(raw.open_price_day ?? raw.openPrice ?? 0) / (raw.open_price_day ? 100 : 1);
    const change = Number.isFinite(open) && open > 0 ? price - open : 0;
    const rawTimestamp = Number(raw.exchange_timestamp || Date.now());
    const timestamp = rawTimestamp < 100000000000 ? rawTimestamp * 1000 : rawTimestamp;
    return {
      symbol,
      price,
      change,
      volume: Number(raw.vol_traded ?? raw.volume ?? 0),
      timestamp: new Date(timestamp).toISOString(),
    };
  }

  normalizeDepth(raw) {
    if (!raw || !Array.isArray(raw.depth_twenty_buy_data) || !Array.isArray(raw.depth_twenty_sell_data)) return null;
    const token = String(raw.token || '').replace(/^"|"$/g, '');
    const symbol = this.symbolByToken[token] || String(raw.symbol || token).trim();
    const normalizeRow = (row) => ({ price: Number(row.price) / 100, quantity: Number(row.quantity), orders: Number(row.no_of_orders || 0) });
    return {
      symbol,
      bids: raw.depth_twenty_buy_data.map(normalizeRow),
      asks: raw.depth_twenty_sell_data.map(normalizeRow),
      timestamp: new Date(Date.now()).toISOString(),
    };
  }

  async connect() {
    if (this.socket || this.stopped || !angel.apiKey || !Object.keys(this.tokens).length) return;
    try {
      const session = await angelService.ensureSession();
      const socket = new AngelWebSocket({ clientcode: angel.clientCode, jwttoken: session.accessToken, apikey: angel.apiKey, feedtype: session.feedToken });
      this.socket = socket;
      socket.on('tick', (raw) => {
        const depth = this.normalizeDepth(raw);
        if (depth) {
          this.broadcastDepth(depth);
          return;
        }
        const tick = this.normalizeTick(raw);
        if (tick) this.broadcast(tick);
      });
      await socket.connect();
      socket.reconnection('exponential', RECONNECT_DELAY_MS, 2);
      this.subscribe([...this.subscribedSymbols]);
    } catch (error) {
      this.socket = null;
      this.scheduleReconnect();
      console.error('Angel One stream connection failed:', error.message);
    }
  }

  subscribe(symbols = []) {
    symbols.filter((symbol) => this.tokens[symbol]).forEach((symbol) => this.subscribedSymbols.add(symbol));
    if (!this.socket || !this.subscribedSymbols.size) return;
    const grouped = [...this.subscribedSymbols].reduce((result, symbol) => {
      const item = this.tokens[symbol];
      const exchangeType = EXCHANGES[item.exchange] || Number(item.exchangeType);
      if (!Number.isInteger(exchangeType)) return result;
      result[exchangeType] = [...(result[exchangeType] || []), String(item.token)];
      return result;
    }, {});
    Object.entries(grouped).forEach(([exchangeType, tokens]) => this.socket.fetchData({
      correlationID: 'stoclio-market',
      action: ACTION.Subscribe,
      mode: MODE.LTP,
      exchangeType: Number(exchangeType),
      tokens,
    }));
    this.subscribeDepth([...this.depthSymbols]);
  }

  broadcastDepth(depth) {
    for (const socket of this.clients) socket.emit('market:depth', depth);
  }

  subscribeDepth(symbols = []) {
    symbols.filter((symbol) => this.tokens[symbol]).forEach((symbol) => this.depthSymbols.add(symbol));
    if (!this.socket || !this.depthSymbols.size) return;
    const grouped = [...this.depthSymbols].reduce((result, symbol) => {
      const item = this.tokens[symbol];
      const exchangeType = EXCHANGES[item.exchange] || Number(item.exchangeType);
      if (!Number.isInteger(exchangeType)) return result;
      result[exchangeType] = [...(result[exchangeType] || []), String(item.token)];
      return result;
    }, {});
    Object.entries(grouped).forEach(([exchangeType, tokens]) => this.socket.fetchData({
      correlationID: 'stoclio-depth',
      action: ACTION.Subscribe,
      mode: MODE.Depth,
      exchangeType: Number(exchangeType),
      tokens,
    }));
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => console.error('Angel stream reconnect failed:', error.message));
    }, RECONNECT_DELAY_MS);
  }

  async subscribeClient(socket, symbols) {
    this.addClient(socket);
    this.subscribe(Array.isArray(symbols) ? symbols : Object.keys(this.tokens));
    await this.connect();
    socket.emit('market:status', { status: this.socket ? 'live' : 'unavailable' });
  }

  async subscribeDepthClient(socket, symbol) {
    this.addClient(socket);
    this.subscribeDepth([String(symbol || '').trim().toUpperCase()]);
    await this.connect();
    this.subscribeDepth([String(symbol || '').trim().toUpperCase()]);
    socket.emit('market:status', { status: this.socket ? 'live' : 'unavailable' });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.socket) this.socket.close();
    this.socket = null;
  }
}

module.exports = new AngelStreamService();
module.exports.AngelStreamService = AngelStreamService;

const angelService = require('../services/angel.service');
const cache = require('../services/cache.service');
const { angel } = require('../config/env');

const TTL = {
  search: 5 * 60 * 1000,
  quote: 5 * 1000,
  candles: 60 * 1000,
  movers: 30 * 1000,
  depth: 5 * 1000,
};

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function exchangeTokensFromQuery(query) {
  if (query.exchangeTokens) {
    try {
      const parsed = JSON.parse(query.exchangeTokens);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      throw badRequest('exchangeTokens must be valid JSON, for example {"NSE":["3045"]}');
    }
  }

  if (query.symbols) {
    let configured;
    try { configured = JSON.parse(angel.streamTokens || '{}'); } catch { throw new Error('ANGEL_STREAM_TOKENS must be valid JSON'); }
    const symbols = query.symbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    if (!symbols.length || symbols.length > 100) throw badRequest('symbols must contain between 1 and 100 symbols');
    const missing = symbols.filter((symbol) => !configured[symbol]);
    if (missing.length) {
      const error = new Error(`No Angel One token mapping configured for: ${missing.join(', ')}`);
      error.statusCode = 503;
      throw error;
    }
    return symbols.reduce((result, symbol) => {
      const item = configured[symbol];
      const exchange = String(item.exchange || '').toUpperCase().replace('_CM', '').replace('_FO', '');
      result[exchange] = [...(result[exchange] || []), String(item.token)];
      return result;
    }, {});
  }

  if (!query.exchange || !query.symboltoken) throw badRequest('exchange and symboltoken are required');
  const tokens = query.symboltoken.split(',').map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) throw badRequest('symboltoken must contain at least one token');
  return { [query.exchange.trim().toUpperCase()]: tokens };
}

function exchangeTokensForSymbol(symbol) {
  let configured;
  try { configured = JSON.parse(angel.streamTokens || '{}'); } catch { throw new Error('ANGEL_STREAM_TOKENS must be valid JSON'); }
  const normalized = String(symbol || '').trim().toUpperCase();
  const item = configured[normalized];
  if (!item) {
    const error = new Error(`No Angel One token mapping configured for: ${normalized}`);
    error.statusCode = 503;
    throw error;
  }
  const exchange = String(item.exchange || '').toUpperCase().replace('_CM', '').replace('_FO', '');
  return { [exchange]: [String(item.token)] };
}

async function cachedResponse(res, key, ttl, loader) {
  const result = await cache.getOrSet(key, ttl, loader);
  res.set('X-Cache', result.cached ? 'HIT' : 'MISS');
  return res.json({ data: result.value });
}

async function search(req, res, next) {
  try {
    const query = String(req.query.q || req.query.query || req.query.searchscrip || '').trim();
    if (!query) throw badRequest('q is required');
    if (query.length < 2 || query.length > 50) throw badRequest('query must be between 2 and 50 characters');
    const requestedExchange = String(req.query.exchange || '').trim().toUpperCase();
    const exchanges = requestedExchange ? [requestedExchange] : ['NSE', 'BSE', 'NFO', 'MCX'];
    const key = `market:search:${exchanges.join(',')}:${query.toUpperCase()}`;
    await cachedResponse(res, key, TTL.search, async () => {
      const responses = await Promise.all(exchanges.map((exchange) => angelService.searchInstruments(exchange, query)));
      return responses.flat().map((item) => {
        const exchange = String(item.exchange || requestedExchange).toUpperCase();
        return {
          symbol: item.tradingsymbol || item.symbol || '',
          name: item.name || item.tradingsymbol || '',
          exchange,
          symboltoken: item.symboltoken,
          kind: ['NFO', 'BFO'].includes(exchange) ? 'index' : ['MCX', 'NCDEX'].includes(exchange) ? 'commodity' : 'stock',
        };
      }).filter((item) => item.symbol).slice(0, 40);
    });
  } catch (error) { next(error); }
}

async function quote(req, res, next) {
  try {
    let exchangeTokens;
    if (req.query.symbols && !req.query.exchangeTokens && !req.query.symboltoken) {
      const symbols = String(req.query.symbols).split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
      if (!symbols.length || symbols.length > 100) throw badRequest('symbols must contain between 1 and 100 symbols');
      const instruments = await Promise.all(symbols.map((symbol) => findInstrument(symbol, [String(req.query.exchange || 'NSE').toUpperCase()])));
      exchangeTokens = instruments.reduce((result, instrument) => {
        const token = instrument.symboltoken || instrument.symbolToken;
        if (!token) return result;
        const exchange = String(instrument.exchange || req.query.exchange || 'NSE').toUpperCase();
        result[exchange] = [...(result[exchange] || []), String(token)];
        return result;
      }, {});
    } else {
      exchangeTokens = exchangeTokensFromQuery(req.query);
    }
    const mode = String(req.query.mode || 'FULL').toUpperCase();
    if (!['LTP', 'QUOTE', 'FULL'].includes(mode)) throw badRequest('mode must be LTP, QUOTE, or FULL');
    const key = `market:quote:${mode}:${JSON.stringify(exchangeTokens)}`;
    await cachedResponse(res, key, TTL.quote, () => angelService.getQuotes({ mode, exchangeTokens }));
  } catch (error) { next(error); }
}

async function candles(req, res, next) {
  try {
    const params = {
      exchange: String(req.query.exchange || '').trim().toUpperCase(),
      symboltoken: String(req.query.symboltoken || '').trim(),
      interval: String(req.query.interval || '').trim().toUpperCase(),
      fromdate: String(req.query.fromdate || '').trim(),
      todate: String(req.query.todate || '').trim(),
    };
    if (Object.values(params).some((value) => !value)) throw badRequest('exchange, symboltoken, interval, fromdate, and todate are required');
    const key = `market:candles:${JSON.stringify(params)}`;
    await cachedResponse(res, key, TTL.candles, () => angelService.getHistoricalCandles(params));
  } catch (error) { next(error); }
}

async function candlesBySymbol(req, res, next) {
  try {
    const instrument = await findInstrument(req.params.symbol, ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']);
    const token = instrument.symboltoken || instrument.symbolToken;
    const todate = new Date();
    const fromdate = new Date(todate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const params = {
      exchange: instrument.exchange,
      symboltoken: String(token),
      interval: String(req.query.interval || 'ONE_DAY').toUpperCase(),
      fromdate: String(req.query.fromdate || fromdate.toISOString().slice(0, 10) + ' 09:15'),
      todate: String(req.query.todate || todate.toISOString().slice(0, 10) + ' 15:30'),
    };
    const result = await cache.getOrSet(`market:candles:symbol:${instrument.exchange}:${token}:${params.interval}:${params.fromdate}:${params.todate}`, TTL.candles, () => angelService.getHistoricalCandles(params));
    res.json({ data: { instrument, candles: result.value } });
  } catch (error) { next(error); }
}

async function movers(type, req, res, next) {
  try {
    const params = {
      expirytype: String(req.query.expirytype || 'NEAR').toUpperCase(),
      datatype: type === 'gainers' ? 'PercPriceGainer' : 'PercPriceLoser',
    };
    if (req.query.expirydate) params.expirydate = String(req.query.expirydate);
    if (req.query.period) params.period = String(req.query.period).toUpperCase();
    const key = `market:${type}:${JSON.stringify(params)}`;
    await cachedResponse(res, key, TTL.movers, () => angelService.getGainersLosers(params));
  } catch (error) { next(error); }
}

async function gainers(req, res, next) { return movers('gainers', req, res, next); }
async function losers(req, res, next) { return movers('losers', req, res, next); }

async function depth(req, res, next) {
  try {
    const exchangeTokens = exchangeTokensFromQuery(req.query);
    const key = `market:depth:${JSON.stringify(exchangeTokens)}`;
    await cachedResponse(res, key, TTL.depth, () => angelService.getMarketDepth(exchangeTokens));
  } catch (error) { next(error); }
}

async function depthBySymbol(req, res, next) {
  try {
    const symbol = String(req.params.symbol || '').trim().toUpperCase();
    if (!symbol || symbol.length > 40) throw badRequest('A valid symbol is required');
    const exchangeTokens = exchangeTokensForSymbol(symbol);
    const key = `market:depth:${symbol}`;
    await cachedResponse(res, key, TTL.depth, () => angelService.getMarketDepth(exchangeTokens));
  } catch (error) { next(error); }
}

function firstQuote(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data?.fetched)) return data.fetched[0] || {};
  return data?.fetched || data || {};
}

function normalizeQuote(item, instrument = {}) {
  const quote = firstQuote(item);
  const ltp = Number(quote.ltp ?? quote.last_traded_price ?? quote.price);
  const previousClose = Number(quote.close ?? quote.prev_close ?? quote.previous_close);
  const changePercent = Number(quote.percentChange ?? quote.changePercent ?? (previousClose ? ((ltp - previousClose) / previousClose) * 100 : 0));
  return {
    name: instrument.name || instrument.tradingsymbol || quote.tradingsymbol || quote.tradingSymbol || '',
    symbol: instrument.tradingsymbol || instrument.symbol || quote.tradingsymbol || quote.tradingSymbol || '',
    exchange: instrument.exchange || instrument.exch_seg || quote.exchange || '',
    symboltoken: instrument.symboltoken || instrument.symbolToken || instrument.token || quote.symboltoken || quote.symbolToken || '',
    ltp,
    open: Number(quote.open ?? quote.open_price_day),
    high: Number(quote.high ?? quote.high_price_day),
    low: Number(quote.low ?? quote.low_price_day),
    previousClose,
    changePercent,
    volume: Number(quote.tradeVolume ?? quote.tradedVolume ?? quote.volume ?? quote.trade_volume),
    depth: quote.depth || quote.marketDepth || { buy: quote.buy, sell: quote.sell },
  };
}

async function findInstrument(symbol, exchanges = ['NSE', 'BSE', 'NFO', 'BFO']) {
  const normalized = String(symbol || '').trim().toUpperCase();
  if (!normalized || normalized.length > 50) throw badRequest('A valid symbol is required');
  const results = (await Promise.all(exchanges.map((exchange) => angelService.searchInstruments(exchange, normalized)))).flat();
  const instrument = results.find((item) => String(item.tradingsymbol || item.symbol || '').toUpperCase() === normalized)
    || results.find((item) => String(item.tradingsymbol || item.symbol || '').toUpperCase() === `${normalized}-EQ`)
    || results[0];
  if (!instrument) { const error = new Error(`Instrument not found: ${normalized}`); error.statusCode = 404; throw error; }
  const rawExchange = instrument.exchange || instrument.exch_seg || '';
  const exchange = String(rawExchange).toUpperCase().replace('_CM', '').replace('_FO', '');
  return { ...instrument, exchange, symboltoken: instrument.symboltoken || instrument.symbolToken || instrument.token };
}

async function stock(req, res, next) {
  try {
    const instrument = await findInstrument(req.params.symbol, ['NSE', 'BSE']);
    const exchange = instrument.exchange;
    const token = instrument.symboltoken || instrument.symbolToken;
    if (!token) throw new Error('Instrument token was not returned by Angel One');
    const data = await cache.getOrSet(`market:stock:${exchange}:${token}`, TTL.quote, () => angelService.getQuotes({ mode: 'FULL', exchangeTokens: { [exchange]: [String(token)] } }));
    res.json({ data: normalizeQuote(data.value, instrument) });
  } catch (error) { next(error); }
}

async function fnoOverview(req, res, next) {
  try {
    await cachedResponse(res, 'market:fno:overview', TTL.movers, () => angelService.getGainersLosers({ expirytype: 'NEAR', datatype: 'PercPriceGainer' }));
  } catch (error) { next(error); }
}

async function fnoSearch(req, res, next) {
  return search({ ...req, query: { ...req.query, exchange: 'NFO' } }, res, next);
}

async function fno(req, res, next) {
  try {
    const instrument = await findInstrument(req.params.symbol, ['NFO', 'BFO']);
    const token = instrument.symboltoken || instrument.symbolToken;
    const data = await cache.getOrSet(`market:fno:${instrument.exchange}:${token}`, TTL.quote, () => angelService.getQuotes({ mode: 'FULL', exchangeTokens: { [instrument.exchange]: [String(token)] } }));
    res.json({ data: { instrument, quote: normalizeQuote(data.value, instrument), expiry: instrument.expiry || instrument.expirydate, strike: instrument.strikeprice || instrument.strike, openInterest: firstQuote(data.value).opentInterest ?? firstQuote(data.value).openInterest, volume: firstQuote(data.value).tradeVolume ?? firstQuote(data.value).volume } });
  } catch (error) { next(error); }
}

async function fnoGreeks(req, res, next) {
  try {
    const name = String(req.query.name || '').trim().toUpperCase();
    const expirydate = String(req.query.expirydate || '').trim().toUpperCase();
    if (!name || !expirydate) throw badRequest('name and expirydate are required');
    await cachedResponse(res, `market:fno:greeks:${name}:${expirydate}`, TTL.quote, () => angelService.getOptionGreek({ name, expirydate }));
  } catch (error) { next(error); }
}

module.exports = { search, quote, candles, candlesBySymbol, gainers, losers, depth, depthBySymbol, stock, fnoOverview, fnoSearch, fno, fnoGreeks };

const angelService = require('../services/angel.service');
const cache = require('../services/cache.service');
const { angel } = require('../config/env');

function logMarket(event, details = {}) {
  console.info(JSON.stringify({ scope: 'market', event, ...details }));
}

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

function arrayData(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.fetched)) return value.fetched;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function configuredTokenGroups(exchangeFilter) {
  let configured = {};
  try { configured = JSON.parse(angel.streamTokens || '{}'); } catch (error) { logMarket('token-config-invalid', { message: error.message }); return {}; }
  return Object.entries(configured).reduce((groups, [symbol, item]) => {
    const exchange = String(item.exchange || '').toUpperCase().replace('_CM', '').replace('_FO', '');
    if (exchangeFilter && exchange !== exchangeFilter) return groups;
    if (!item.token || !exchange) return groups;
    groups[exchange] = [...(groups[exchange] || []), { symbol, token: String(item.token) }];
    return groups;
  }, {});
}

function normalizeMover(item, tracked = {}) {
  const symbol = item.tradingSymbol || item.tradingsymbol || item.symbol || tracked.symbol || '';
  const ltp = Number(item.ltp ?? item.last_traded_price ?? item.price);
  const previousClose = Number(item.close ?? item.prev_close ?? item.previous_close);
  const changePercent = Number(item.percentChange ?? item.changePercent ?? (previousClose ? ((ltp - previousClose) / previousClose) * 100 : NaN));
  return { symbol, exchange: item.exchange || tracked.exchange || '', ltp, changePercent, volume: Number(item.tradeVolume ?? item.tradedVolume ?? item.volume ?? 0) };
}

function expiryFromSymbol(symbol) {
  const match = String(symbol || '').match(/(\d{2}[A-Z]{3}\d{2})/i);
  return match ? match[1].toUpperCase() : undefined;
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
      const responses = await Promise.allSettled(exchanges.map((exchange) => angelService.searchInstruments(exchange, query)));
      const rejected = responses.filter((response) => response.status === 'rejected');
      if (rejected.length) logMarket('search-provider-errors', { query, exchanges, count: rejected.length, messages: rejected.map((response) => response.reason?.message).filter(Boolean) });
      return responses.flatMap((response) => response.status === 'fulfilled' ? arrayData(response.value) : []).map((item) => {
        const exchange = String(item.exchange || item.exch_seg || requestedExchange).toUpperCase().replace('_CM', '').replace('_FO', '');
        return {
          symbol: item.tradingsymbol || item.tradingSymbol || item.symbol || '',
          name: item.name || item.companyname || item.tradingsymbol || item.tradingSymbol || '',
          exchange,
          symboltoken: item.symboltoken || item.symbolToken || item.token,
          kind: ['NFO', 'BFO'].includes(exchange) ? 'index' : ['MCX', 'NCDEX'].includes(exchange) ? 'commodity' : 'stock',
        };
      }).filter((item) => item.symbol).slice(0, 40);
    });
  } catch (error) { logMarket('search-error', { query: req.query.q || req.query.query, message: error.message }); res.json({ data: [] }); }
}

async function status(req, res, next) {
  res.json(await angelService.getConnectionStatus());
}

async function quote(req, res, next) {
  try {
    let exchangeTokens;
    if (req.query.symbols && !req.query.exchangeTokens && !req.query.symboltoken) {
      const symbols = String(req.query.symbols).split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
      if (!symbols.length || symbols.length > 100) throw badRequest('symbols must contain between 1 and 100 symbols');
      const instruments = (await Promise.allSettled(symbols.map((symbol) => findInstrument(symbol, [String(req.query.exchange || 'NSE').toUpperCase()])))).flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      exchangeTokens = instruments.reduce((result, instrument) => {
        const token = instrument.symboltoken || instrument.symbolToken;
        if (!token) return result;
        const exchange = String(instrument.exchange || req.query.exchange || 'NSE').toUpperCase();
        result[exchange] = [...(result[exchange] || []), String(token)];
        return result;
      }, {});
      if (!Object.keys(exchangeTokens).length) {
        logMarket('quote-no-instruments', { symbols });
        return res.json({ data: [] });
      }
    } else {
      exchangeTokens = exchangeTokensFromQuery(req.query);
    }
    const mode = String(req.query.mode || 'FULL').toUpperCase();
    if (!['LTP', 'QUOTE', 'FULL'].includes(mode)) throw badRequest('mode must be LTP, QUOTE, or FULL');
    const key = `market:quote:${mode}:${JSON.stringify(exchangeTokens)}`;
        const result = await cache.getOrSet(key, TTL.quote, async () => {
          try {
            const response = await angelService.getQuotes({ mode, exchangeTokens });
            return arrayData(response);
          } catch (error) {
            logMarket('quote-provider-error', { mode, exchanges: Object.keys(exchangeTokens), message: error.message });
            return [];
          }
        });
        res.set('X-Cache', result.cached ? 'HIT' : 'MISS');
          logMarket('quote-success', { mode, exchanges: Object.keys(exchangeTokens), returned: Array.isArray(result.value) ? result.value.length : 0 });
          res.json({ data: Array.isArray(result.value) ? result.value : [] });
        } catch (error) { logMarket('quote-error', { mode: req.query.mode, message: error.message }); res.json({ data: [] }); }
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
  } catch (error) { logMarket('candles-symbol-error', { symbol: req.params.symbol, message: error.message }); res.json({ data: { instrument: null, candles: [] } }); }
}

async function movers(type, req, res, next) {
  try {
    const groups = configuredTokenGroups('NSE');
    const tracked = groups.NSE || [];
    const exchangeTokens = { NSE: tracked.map((item) => item.token) };
    const key = `market:${type}:quotes:${JSON.stringify(exchangeTokens)}`;
    await cachedResponse(res, key, TTL.movers, async () => {
      try {
        const response = await angelService.getQuotes({ mode: 'FULL', exchangeTokens });
        const quotes = arrayData(response).map((item) => normalizeMover(item, tracked.find((candidate) => candidate.token === String(item.symbolToken || item.symboltoken))));
        const valid = quotes.filter((item) => item.symbol && Number.isFinite(item.changePercent));
        valid.sort((left, right) => type === 'gainers' ? right.changePercent - left.changePercent : left.changePercent - right.changePercent);
        logMarket('movers-success', { type, tracked: tracked.length, returned: Math.min(valid.length, 5) });
        return valid.slice(0, 5);
      } catch (error) {
        logMarket('movers-provider-error', { type, tracked: tracked.length, message: error.message });
        return [];
      }
    });
  } catch (error) { logMarket('movers-error', { type, message: error.message }); res.json({ data: [] }); }
}

async function gainers(req, res, next) { return movers('gainers', req, res, next); }
async function losers(req, res, next) { return movers('losers', req, res, next); }

async function commodities(req, res, next) {
  try {
    const groups = configuredTokenGroups('MCX');
    const tracked = groups.MCX || [];
    if (!tracked.length) return res.json({ data: [] });
    const response = await angelService.getQuotes({ mode: 'FULL', exchangeTokens: { MCX: tracked.map((item) => item.token) } });
    res.json({ data: arrayData(response) });
  } catch (error) { logMarket('commodities-error', { message: error.message }); res.json({ data: [] }); }
}

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
  const responses = await Promise.allSettled(exchanges.map((exchange) => angelService.searchInstruments(exchange, normalized)));
  const results = responses.flatMap((response) => response.status === 'fulfilled' ? arrayData(response.value) : []);
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
  } catch (error) { logMarket('stock-error', { symbol: req.params.symbol, message: error.message }); res.json({ data: null }); }
}

async function fnoOverview(req, res, next) {
  try {
    const groups = configuredTokenGroups('NFO');
    const tracked = groups.NFO || [];
    if (!tracked.length) return res.json({ data: [] });
    const result = await cache.getOrSet('market:fno:overview', TTL.movers, async () => {
      try {
        const response = await angelService.getQuotes({ mode: 'FULL', exchangeTokens: { NFO: tracked.map((item) => item.token) } });
        return arrayData(response).map((item) => normalizeMover(item, tracked.find((candidate) => candidate.token === String(item.symbolToken || item.symboltoken)))).filter((item) => item.symbol);
      } catch (error) {
        logMarket('fno-overview-provider-error', { tracked: tracked.length, message: error.message });
        return [];
      }
    });
    res.set('X-Cache', result.cached ? 'HIT' : 'MISS');
    logMarket('fno-overview-success', { tracked: tracked.length, returned: result.value.length });
    res.json({ data: Array.isArray(result.value) ? result.value : [] });
  } catch (error) { logMarket('fno-overview-error', { message: error.message }); res.json({ data: [] }); }
}

async function fnoSearch(req, res, next) {
  return search({ ...req, query: { ...req.query, exchange: 'NFO' } }, res, next);
}

async function fnoFutures(req, res, next) {
  try {
    const query = String(req.query.q || req.query.query || 'NIFTY').trim();
    const responses = await Promise.allSettled(['NFO'].map((exchange) => angelService.searchInstruments(exchange, query)));
    const instruments = responses.flatMap((response) => response.status === 'fulfilled' ? arrayData(response.value) : [])
      .filter((item) => /FUT$/i.test(item.tradingsymbol || item.tradingSymbol || item.symbol || ''))
      .map((item) => { const symbol = item.tradingsymbol || item.tradingSymbol || item.symbol || ''; return { symbol, exchange: 'NFO', symboltoken: item.symboltoken || item.symbolToken || item.token, expiry: item.expiry || item.expirydate || expiryFromSymbol(symbol), lotsize: item.lotsize || item.lotSize, ticksize: item.ticksize || item.tickSize, instrumenttype: item.instrumenttype || item.instrumentType || 'FUTIDX' }; });
    let quotes = [];
    try {
      const quoteResponse = instruments.length ? await angelService.getQuotes({ mode: 'FULL', exchangeTokens: { NFO: instruments.map((item) => String(item.symboltoken)) } }) : [];
      quotes = arrayData(quoteResponse);
    } catch (error) { logMarket('fno-futures-quote-error', { query, message: error.message }); }
    const results = instruments.map((instrument) => ({ ...instrument, quote: normalizeMover(quotes.find((quote) => String(quote.symbolToken || quote.symboltoken) === String(instrument.symboltoken)) || {}, instrument) }));
    logMarket('fno-futures-success', { query, returned: results.length });
    res.json({ data: results });
  } catch (error) { logMarket('fno-futures-error', { message: error.message }); res.json({ data: [] }); }
}

async function fnoDashboard(req, res, next) {
  try {
    const underlyings = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
    const contracts = [];
    for (const query of underlyings) {
      const items = await new Promise((resolve) => fnoFutures({ query: { q: query } }, { json: (body) => resolve(body.data || []) }).catch(() => resolve([])));
      if (items[0]) contracts.push(items[0]);
    }
    logMarket('fno-dashboard-success', { returned: contracts.length });
    res.json({ data: contracts });
  } catch (error) { logMarket('fno-dashboard-error', { message: error.message }); res.json({ data: [] }); }
}

async function fnoContracts(req, res, next) { return fnoFutures(req, res, next); }

async function fnoContract(req, res, next) { return fno(req, res, next); }

async function fnoDepth(req, res, next) {
  try {
    const instrument = await findInstrument(req.params.symbol, ['NFO']);
    const response = await angelService.getMarketDepth({ NFO: [String(instrument.symboltoken)] });
    res.json({ data: { instrument, depth: firstQuote(response).depth || firstQuote(response) } });
  } catch (error) { logMarket('fno-depth-error', { symbol: req.params.symbol, message: error.message }); res.json({ data: { instrument: null, depth: {} } }); }
}

async function fnoHistory(req, res, next) {
  return candlesBySymbol(req, res, next);
}

async function fnoExpiries(req, res, next) {
  try {
    const query = String(req.query.q || 'NIFTY').trim();
    const responses = await Promise.allSettled([angelService.searchInstruments('NFO', query)]);
    const contracts = responses.flatMap((response) => response.status === 'fulfilled' ? arrayData(response.value) : []).map((item) => { const symbol = item.tradingsymbol || item.tradingSymbol || item.symbol || ''; return { symbol, expiry: item.expiry || item.expirydate || expiryFromSymbol(symbol), token: item.symboltoken || item.symbolToken || item.token }; }).filter((item) => item.symbol && item.expiry);
    const grouped = contracts.reduce((result, contract) => { const key = String(contract.expiry); (result[key] ||= []).push(contract); return result; }, {});
    res.json({ data: Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right)).map(([expiry, items]) => ({ expiry, contracts: items })) });
  } catch (error) { logMarket('fno-expiries-error', { message: error.message }); res.json({ data: [] }); }
}

async function fno(req, res, next) {
  try {
    const instrument = await findInstrument(req.params.symbol, ['NFO', 'BFO']);
    const token = instrument.symboltoken || instrument.symbolToken;
    const data = await cache.getOrSet(`market:fno:${instrument.exchange}:${token}`, TTL.quote, () => angelService.getQuotes({ mode: 'FULL', exchangeTokens: { [instrument.exchange]: [String(token)] } }));
    res.json({ data: { instrument: { ...instrument, expiry: instrument.expiry || instrument.expirydate || expiryFromSymbol(instrument.tradingsymbol || instrument.tradingSymbol || instrument.symbol) }, quote: normalizeQuote(data.value, instrument), expiry: instrument.expiry || instrument.expirydate || expiryFromSymbol(instrument.tradingsymbol || instrument.tradingSymbol || instrument.symbol), strike: instrument.strikeprice || instrument.strike, lotSize: instrument.lotsize || instrument.lotSize, tickSize: instrument.ticksize || instrument.tickSize, segment: instrument.exch_seg || instrument.exchange || 'NFO', instrumentType: instrument.instrumenttype || instrument.instrumentType || 'FUT', openInterest: firstQuote(data.value).opentInterest ?? firstQuote(data.value).openInterest ?? firstQuote(data.value).opnInterest, volume: firstQuote(data.value).tradeVolume ?? firstQuote(data.value).volume } });
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

module.exports = { search, status, quote, candles, candlesBySymbol, gainers, losers, commodities, depth, depthBySymbol, stock, fnoOverview, fnoSearch, fnoFutures, fnoDashboard, fnoContracts, fnoContract, fnoDepth, fnoHistory, fnoExpiries, fno, fnoGreeks };

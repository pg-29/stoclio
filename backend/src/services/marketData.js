const axios = require('axios');

async function getQuotes(symbols = []) {
  if (!process.env.ANGEL_API_KEY) throw new Error('Angel One credentials are not configured');
  const response = await axios.get(process.env.MARKET_DATA_PROXY_URL, { params: { symbols: symbols.join(',') } });
  return response.data.data;
}

module.exports = { getQuotes };

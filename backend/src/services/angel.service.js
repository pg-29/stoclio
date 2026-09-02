const { SmartAPI } = require('smartapi-javascript');
const { generateSync } = require('otplib');
const { angel } = require('../config/env');

class AngelServiceError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AngelServiceError';
    this.cause = cause;
  }
}

class AngelOneService {
  constructor() {
    this.client = null;
    this.session = null;
  }

  getClient() {
    if (!angel.apiKey) throw new AngelServiceError('Angel One credentials are not configured');
    if (!this.client) this.client = new SmartAPI({ api_key: angel.apiKey });
    return this.client;
  }

  assertResponse(response, operation) {
    if (!response || response.status !== true) {
      const detail = response?.message || response?.errorcode || 'Unknown provider error';
      throw new AngelServiceError(`Angel One ${operation} failed: ${detail}`);
    }
    return response;
  }

  async generateSession(totp) {
    if (!angel.clientCode || !angel.pin || !angel.totpSecret) {
      throw new AngelServiceError('ANGEL_CLIENT_CODE, ANGEL_PIN, and ANGEL_TOTP_SECRET are required');
    }
    const generatedTotp = totp || generateSync({ secret: angel.totpSecret });
    try {
      const response = await this.getClient().generateSession(angel.clientCode, angel.pin, generatedTotp);
      this.assertResponse(response, 'session generation');
      const data = response.data || {};
      this.session = {
        accessToken: data.jwtToken,
        refreshToken: data.refreshToken,
        feedToken: data.feedToken || data.feedtoken,
        createdAt: new Date(),
      };
      return { ...this.session };
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One session generation failed', error);
    }
  }

  async generateFeedToken() {
    if (!this.session?.feedToken) await this.generateSession();
    return this.session.feedToken;
  }

  async refreshSession(refreshToken = this.session?.refreshToken) {
    if (!refreshToken) throw new AngelServiceError('A refresh token is required');
    try {
      const response = await this.getClient().generateToken(refreshToken);
      this.assertResponse(response, 'session refresh');
      const data = response.data || {};
      this.session = {
        ...(this.session || {}),
        accessToken: data.jwtToken,
        refreshToken: data.refreshToken || refreshToken,
        refreshedAt: new Date(),
      };
      return { ...this.session };
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One session refresh failed', error);
    }
  }

  async ensureSession() {
    if (!this.session?.accessToken) await this.generateSession();
    return this.session;
  }

  async getQuotes({ mode = 'FULL', exchangeTokens } = {}) {
    if (!exchangeTokens || typeof exchangeTokens !== 'object') throw new AngelServiceError('exchangeTokens are required to fetch quotes');
    await this.ensureSession();
    try {
      const response = await this.getClient().marketData({ mode, exchangeTokens });
      return this.assertResponse(response, 'quote fetch').data;
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One quote fetch failed', error);
    }
  }

  async getMarketDepth(exchangeTokens) {
    return this.getQuotes({ mode: 'FULL', exchangeTokens });
  }

  async getHistoricalCandles(params) {
    const required = ['exchange', 'symboltoken', 'interval', 'fromdate', 'todate'];
    const missing = required.filter((field) => !params?.[field]);
    if (missing.length) throw new AngelServiceError(`Historical candle parameters missing: ${missing.join(', ')}`);
    await this.ensureSession();
    try {
      const response = await this.getClient().getCandleData(params);
      return this.assertResponse(response, 'historical candle fetch').data;
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One historical candle fetch failed', error);
    }
  }

  async getOptionGreek(params) {
    if (!params?.name || !params?.expirydate) throw new AngelServiceError('Option Greek name and expirydate are required');
    await this.ensureSession();
    try {
      const response = await this.getClient().optionGreek(params);
      return this.assertResponse(response, 'option Greek fetch').data;
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One option Greek fetch failed', error);
    }
  }

  async searchInstruments(exchange, query) {
    if (!exchange || !query) throw new AngelServiceError('Exchange and search query are required');
    await this.ensureSession();
    try {
      const response = await this.getClient().searchScrip({ exchange, searchscrip: query });
      return Array.isArray(response) ? response : this.assertResponse(response, 'instrument search').data;
    } catch (error) {
      if (error instanceof AngelServiceError) throw error;
      throw new AngelServiceError('Angel One instrument search failed', error);
    }
  }
}

module.exports = new AngelOneService();
module.exports.AngelOneService = AngelOneService;
module.exports.AngelServiceError = AngelServiceError;

class TtlCache {
  constructor() {
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async getOrSet(key, ttlMs, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return { value: cached, cached: true };
    const value = await loader();
    this.set(key, value, ttlMs);
    return { value, cached: false };
  }
}

module.exports = new TtlCache();

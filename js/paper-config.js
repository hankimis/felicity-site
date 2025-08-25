// Paper Trading shared CONFIG (global)
window.PT_CONFIG = window.PT_CONFIG || {
  binanceWsBase: 'wss://fstream.binance.com/ws',
  binanceApiBase: 'https://fapi.binance.com',
  orderbookDepthStream: (sym) => `${window.PT_CONFIG.binanceWsBase}/${sym}@depth20`,
  bookTickerStream: (sym) => `${window.PT_CONFIG.binanceWsBase}/${sym}@bookTicker`,
  depthRest: (sym, limit=25) => `${window.PT_CONFIG.binanceApiBase}/fapi/v1/depth?symbol=${sym}&limit=${limit}`,
  tickerRest: (sym) => `${window.PT_CONFIG.binanceApiBase}/fapi/v1/ticker/bookTicker?symbol=${sym}`,
  leverageBracketRest: (sym) => `${window.PT_CONFIG.binanceApiBase}/fapi/v1/leverageBracket?symbol=${sym}`,
  ui: { minOrderbookRows: 9, rowHeight: 24, ladderTick: 0.1 },
  fees: { taker: 0.0006, maker: 0.0002 },
  fundingIntervalMs: 60*60*1000,
  ticks: { price: 0.1, amount: 0.0001 },
  cache: { formatLruSize: 64, mmrTtlMs: 10*60*1000 },
  debug: false,
};



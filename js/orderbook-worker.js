// Orderbook Worker: compute sizes per fixed ladder and totals
self.onmessage = (e) => {
  try {
    const { asksPrices, bidsPrices, askBuckets, bidBuckets } = e.data || {};
    const askMap = new Map(askBuckets || []);
    const bidMap = new Map(bidBuckets || []);
    const askSizes = (asksPrices || []).map(p => {
      const v = Number(askMap.get(p.toFixed(1)) || 0);
      return (isFinite(v) && v > 0) ? Number(v.toFixed(4)) : 0;
    });
    const bidSizes = (bidsPrices || []).map(p => {
      const v = Number(bidMap.get(p.toFixed(1)) || 0);
      return (isFinite(v) && v > 0) ? Number(v.toFixed(4)) : 0;
    });
    const askCumMax = Math.max(1, askSizes.reduce((a,b)=>a+b,0));
    const bidCumMax = Math.max(1, bidSizes.reduce((a,b)=>a+b,0));
    self.postMessage({ askSizes, bidSizes, askCumMax, bidCumMax });
  } catch (err) {
    // fail silent
  }
};

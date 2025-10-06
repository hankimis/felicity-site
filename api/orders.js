export default async function handler(req, res) {
  try {
    // 기본 보안/호환 헤더
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // CORS 프리플라이트 허용 (동일 오리진이면 무해)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).end();
    }

    if (req.method === 'POST') {
      const { userId = 'guest', symbol, side, type, price = null, amount, fee = 0, pnl = null, meta = {} } = req.body || {};
      if (!symbol || !side || !type || !Number.isFinite(Number(amount))) {
        return res.status(400).json({ success: false, error: 'invalid params' });
      }
      const now = new Date().toISOString();
      const order = {
        orderId: `ord_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        userId,
        ts: now,
        symbol,
        side,
        type,
        price: price == null ? null : Number(price),
        amount: Number(amount),
        fee: Number(fee) || 0,
        pnl: pnl == null ? null : Number(pnl),
        meta
      };
      // 주: 서버리스 런타임 특성상 영속 저장을 하지 않습니다.
      return res.status(200).json({ success: true, order });
    }

    if (req.method === 'GET') {
      // 간단한 헬스/호환 응답 (영속 저장 없음)
      return res.status(200).json({ success: true, orders: [] });
    }

    return res.status(405).json({ success: false, error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}



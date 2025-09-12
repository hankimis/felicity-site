export default async function handler(req, res) {
  try {
    const { url } = req;
    const path = url.replace(/^\/api\/coingecko\/?/, '');
    const target = `https://api.coingecko.com/api/v3/${path}`;
    const r = await fetch(target, { headers: { 'x-cg-demo-api-key': 'CG-mimMBvFoj6H2ZWgrWMdbNDdB' } });
    const buf = await r.arrayBuffer();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(r.status).send(Buffer.from(buf));
  } catch (e) {
    res.status(500).json({ error: 'proxy_failed' });
  }
}



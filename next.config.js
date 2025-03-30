/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' blob: data: https://*.googleapis.com https://*.gstatic.com;
              font-src 'self';
              connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com;
              frame-src 'self' https://*.firebaseapp.com;
              object-src 'none';
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig; 
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ Vercel에서 ESLint 에러 무시
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              img-src 'self' blob: data: https://*.google.com https://*.googleapis.com https://*.gstatic.com;
              font-src 'self' https://fonts.gstatic.com;
              connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseio.com https://*.cloudfunctions.net;
              frame-src 'self' https://*.google.com;
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ];
  }
};

export default nextConfig;

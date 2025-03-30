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
              script-src 'self' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:;
              style-src 'self' 'unsafe-inline' https:;
              img-src 'self' blob: data: https:;
              font-src 'self' data: https:;
              connect-src 'self' https:;
              frame-src 'self' https:;
              worker-src 'self' blob:;
              media-src 'self' https:;
              manifest-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              upgrade-insecure-requests;
            `.replace(/\s+/g, ' ').trim()
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization'
          }
        ]
      }
    ];
  }
};

export default nextConfig;

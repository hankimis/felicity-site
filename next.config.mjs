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
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.firebaseio.com https://*.firebase.com;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              img-src 'self' blob: data: https://*.googleapis.com https://*.gstatic.com https://*.google.com;
              font-src 'self' https://fonts.gstatic.com;
              connect-src 'self' 
                https://*.firebaseio.com 
                https://*.googleapis.com 
                https://*.google.com 
                https://*.gstatic.com 
                https://*.cloudfunctions.net
                https://*.firebase.com
                https://*.firebase.database.app
                wss://*.firebaseio.com
                wss://*.firebase.database.app;
              frame-src 'self' https://*.firebaseapp.com https://*.google.com;
              worker-src 'self' 'blob:';
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

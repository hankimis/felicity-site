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
              default-src 'self' vercel.app vercel.com *.vercel.app *.vercel.com;
              script-src 'self' 'unsafe-eval' 'unsafe-inline' 
                https://*.googleapis.com 
                https://*.gstatic.com 
                https://*.google.com 
                https://*.firebaseio.com 
                https://*.firebase.com
                https://*.vercel.app
                https://*.vercel.com;
              style-src 'self' 'unsafe-inline' 
                https://fonts.googleapis.com 
                https://*.vercel.app
                https://*.vercel.com;
              img-src 'self' blob: data: 
                https://*.googleapis.com 
                https://*.gstatic.com 
                https://*.google.com
                https://*.vercel.app
                https://*.vercel.com;
              font-src 'self' data: 
                https://fonts.gstatic.com
                https://*.vercel.app
                https://*.vercel.com;
              connect-src 'self' 
                https://*.firebaseio.com 
                https://*.googleapis.com 
                https://*.google.com 
                https://*.gstatic.com 
                https://*.cloudfunctions.net
                https://*.firebase.com
                https://*.firebaseapp.com
                https://*.firebase.database.app
                wss://*.firebaseio.com
                wss://*.firebase.database.app
                https://*.vercel.app
                https://*.vercel.com
                wss://*.vercel.app
                wss://*.vercel.com;
              frame-src 'self' 
                https://*.firebaseapp.com 
                https://*.google.com
                https://*.vercel.app
                https://*.vercel.com;
              worker-src 'self' blob:;
              media-src 'self' 
                https://*.vercel.app
                https://*.vercel.com;
              manifest-src 'self';
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

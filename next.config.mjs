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
              default-src 'self' *.vercel.app *.vercel.com;
              script-src 'self' 'unsafe-eval' 'unsafe-inline' 
                *.googleapis.com 
                *.gstatic.com 
                *.google.com
                *.google-analytics.com
                *.googletagmanager.com
                *.firebaseio.com 
                *.firebase.com
                *.vercel.app
                *.vercel.com;
              style-src 'self' 'unsafe-inline' 
                *.googleapis.com
                *.vercel.app
                *.vercel.com;
              img-src 'self' blob: data: 
                *.googleapis.com 
                *.gstatic.com 
                *.google.com
                *.google-analytics.com
                *.vercel.app
                *.vercel.com;
              font-src 'self' data: 
                *.gstatic.com
                *.vercel.app
                *.vercel.com;
              connect-src 'self' 
                *.firebaseio.com 
                *.googleapis.com 
                *.google.com 
                *.google-analytics.com
                *.analytics.google.com
                *.gstatic.com 
                *.cloudfunctions.net
                *.firebase.com
                *.firebaseapp.com
                *.firebase.database.app
                *.vercel.app
                *.vercel.com
                wss://*.firebaseio.com
                wss://*.firestore.googleapis.com;
              frame-src 'self' 
                *.firebaseapp.com 
                *.google.com
                *.vercel.app
                *.vercel.com;
              worker-src 'self' blob:;
              media-src 'self' 
                *.vercel.app
                *.vercel.com;
              manifest-src 'self';
              object-src 'none';
              base-uri 'self';
              form-action 'self';
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

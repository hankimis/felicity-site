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
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googletagmanager.com https://*.google-analytics.com https://*.firebaseio.com https://*.firebase.com;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              img-src 'self' blob: data: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://www.google.com;
              font-src 'self' data: https://fonts.gstatic.com;
              connect-src 'self' 
                https://*.firebaseio.com 
                https://*.googleapis.com 
                https://firebase.googleapis.com
                https://firebaseinstallations.googleapis.com
                https://firestore.googleapis.com
                https://*.google.com 
                https://*.google-analytics.com
                https://*.analytics.google.com
                https://*.gstatic.com 
                https://*.cloudfunctions.net
                https://*.firebase.com
                https://*.firebaseapp.com
                wss://*.firebaseio.com
                wss://*.firestore.googleapis.com;
              frame-src 'self' https://*.firebaseapp.com https://*.google.com;
              worker-src 'self' blob:;
              media-src 'self';
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
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          }
        ]
      }
    ];
  }
};

export default nextConfig;

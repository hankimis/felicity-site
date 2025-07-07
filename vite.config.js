import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV === 'development',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        // 추가 페이지들 - 나중에 이동 후 활성화
        // analysis: resolve(__dirname, 'src/pages/analysis/dashboard.html'),
        // community: resolve(__dirname, 'src/pages/community/board.html'),
        // admin: resolve(__dirname, 'src/pages/admin/dashboard.html')
      },
      output: {
        manualChunks: {
          // 벤더 라이브러리들
          'vendor-firebase': ['firebase'],
          'vendor-chart': ['tradingview'],
          
          // 기능별 청크
          'core': ['./src/scripts/core/'],
          'analysis': ['./src/features/analysis/'],
          'community': ['./src/features/community/'],
          'shared': ['./src/shared/']
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    host: '0.0.0.0'
  },
  css: {
    postcss: {
      plugins: [
        require('autoprefixer'),
        require('cssnano')({
          preset: 'default'
        })
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/scripts/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@components': resolve(__dirname, 'src/shared/components'),
      '@services': resolve(__dirname, 'src/shared/services'),
      '@utils': resolve(__dirname, 'src/shared/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@pages': resolve(__dirname, 'src/pages')
    }
  },
  optimizeDeps: {
    include: ['firebase', 'firebase/auth', 'firebase/firestore'],
    exclude: ['tradingview']
  },
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production'
  }
}); 
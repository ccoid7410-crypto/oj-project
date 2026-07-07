import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 프로덕션(nginx)과 동일하게 /api, /socket.io를 같은 origin의 상대 경로로 쓰도록,
    // 개발 서버(vite dev)에서도 백엔드로 프록시한다. VITE_API_URL 없이도 로컬 개발이 된다.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * 构建成单个 index.html：样式、脚本、数据全部内联。
 * 这是 GitHub Pages 的入口，也是「下载下来双击就能看」的离线版本。
 *
 * 源入口故意叫 app.html 而不是 index.html —— 根目录的 index.html 是构建产物，
 * 两者同名会分不清哪个能改、哪个别碰。
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    chunkSizeWarningLimit: 10000,
    reportCompressedSize: false,
    rollupOptions: { input: 'app.html' },
  },
})

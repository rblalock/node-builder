/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base =
  process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 5181,
    strictPort: true,
    host: '127.0.0.1',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
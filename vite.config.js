import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { publicReleaseFiles, writeGeneratedManifest } from './scripts/release-policy.mjs';
export default defineConfig({
  base: '/LTIP_LIBYA/',
  build: { copyPublicDir: false },
  plugins: [react(), {
    name: 'ltip-reviewed-public-files',
    generateBundle() {
      for (const { path, bytes } of publicReleaseFiles()) {
        this.emitFile({ type: 'asset', fileName: path.slice('public/'.length), source: bytes });
      }
    },
    writeBundle(options,bundle) { writeGeneratedManifest(options.dir || 'dist',bundle); }
  }]
});


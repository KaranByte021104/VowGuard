import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import webExtension, { readJsonFile } from 'vite-plugin-web-extension';
import { resolve } from 'path';

function generateManifest() {
  const manifest = readJsonFile('manifest.json');
  const pkg = readJsonFile('package.json');
  return {
    name: "SecureVault",
    description: "The SecureVault companion browser extension",
    version: pkg.version,
    ...manifest,
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    webExtension({
      readManifest: generateManifest
    }) as any,
  ],
  build: {
    target: 'esnext'
  },
  resolve: {
    alias: {
      '@app/shared': resolve(__dirname, '../shared')
    }
  }
});

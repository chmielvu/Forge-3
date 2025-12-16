import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [
      react(),
      nodePolyfills({
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
        // Set the globals to true to inject Buffer and process into global scope
        globals: {
          Buffer: true, 
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['buffer', 'long'],
      exclude: ['@xenova/transformers'] // Often better to exclude wasm-heavy libs from optimization
    },
    define: {
      // Explicitly define global.process for browser compatibility
      // This ensures 'process' exists as an object before other definitions.
      'global.process': {
        env: {
          // Define NODE_ENV first, as many libraries check this.
          NODE_ENV: JSON.stringify(mode),
          // Expose API_KEY specifically to process.env.API_KEY
          API_KEY: JSON.stringify(env.API_KEY || process.env.API_KEY),
        }
      }
    }
  };
});
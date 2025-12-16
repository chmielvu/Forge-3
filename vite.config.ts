import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['buffer', 'long']
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
      },
      // Removed the generic 'process.env': {} as it can be too aggressive
      // and prevent other env vars from being correctly exposed or accessed.
    }
  };
});
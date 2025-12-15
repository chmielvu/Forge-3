
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Removed explicit '@' alias to prevent module resolution conflicts with workers.
        // If other aliases are needed, they should be added carefully or configured in tsconfig.json.
      },
    },
    optimizeDeps: {
      include: ['buffer', 'long']
    },
    define: {
      // Expose API_KEY specifically to process.env.API_KEY to satisfy usage requirements
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
      // Polyfill process.env to prevent "process is not defined" errors in browser
      'process.env': {}
    }
  };
});
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';
import { Buffer as BufferPolyfill } from 'buffer'; // Changed to named import

// Polyfill Buffer globally for dependencies like protobufjs/@google/genai
if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || BufferPolyfill; // Use named import
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // Fallback for body mount if root div missing
  const rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
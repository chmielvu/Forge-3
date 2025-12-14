
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';
import { Buffer } from 'buffer';

// Polyfill Buffer globally for dependencies like protobufjs/@google/genai
globalThis.Buffer = Buffer;

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
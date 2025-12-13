
import React from 'react';
import { createRoot } from 'react-dom/client';
import Page from './src/app/page';
import './src/app/globals.css';

// Fallback entry point for environments that rely on index.html/index.tsx
// instead of Next.js App Router.

const rootElement = document.getElementById('root') || document.body;

// Ensure we have a container
if (rootElement === document.body) {
  const container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);

export default function AppEntry() {
  return <Page />;
}

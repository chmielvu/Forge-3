
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import './src/index.css';
import { ErrorBoundary } from './src/components/ErrorBoundary'; // Import ErrorBoundary


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary> {/* Wrap App with ErrorBoundary */}
        <App />
      </ErrorBoundary>
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
      <ErrorBoundary> {/* Wrap App with ErrorBoundary */}
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
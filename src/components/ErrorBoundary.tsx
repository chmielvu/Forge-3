
'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical Application Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8 font-serif">
          <div className="max-w-md text-center border border-[#881337] p-8 bg-black/90 shadow-2xl">
            <h1 className="font-display text-4xl text-[#facc15] mb-4 tracking-widest border-b border-[#881337] pb-4">
              THE LOOM HAS SHATTERED
            </h1>
            <p className="text-[#78716c] mb-8 text-lg italic">
              "The narrative thread has snapped. Reality can no longer be sustained."
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#881337] text-white font-mono uppercase tracking-widest hover:bg-[#9f1239] transition-colors"
            >
              Restart Simulation
            </button>
            {this.state.error && (
              <details className="mt-8 text-left text-xs text-[#78716c] font-mono border-t border-[#1c1917] pt-4">
                <summary className="cursor-pointer hover:text-[#facc15]">Technical Diagnostics</summary>
                <pre className="mt-2 p-4 bg-[#1c1917] overflow-auto rounded text-red-400">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

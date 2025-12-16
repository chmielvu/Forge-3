// Fix: Refactor to use direct imports from React to ensure proper type inference for class components.
import { Component, ErrorInfo, ReactNode } from 'react'; // Removed 'React' from direct import

interface Props {
  children: ReactNode; // Use ReactNode directly
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> { // Use Component directly
  // FIX: Added explicit constructor to ensure `this.props` is correctly initialized and state is set
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined }; // Initialize state here
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { // Use ErrorInfo directly
    // You can also log the error to an error reporting service
    console.error("Critical Application Error Caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    // Access children directly from this.props which is correctly typed now.
    const { children } = this.props;

    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-[#0c0a09] flex items-center justify-center p-8 font-serif" role="alert">{/* Deeper black background */}
          <div className="max-w-md text-center border border-[#7f1d1d] p-8 bg-black/90 shadow-2xl">{/* Burgundy border */}
            <h1 className="font-display text-4xl text-[#fecaca] mb-4 tracking-widest border-b border-[#991b1b] pb-4">{/* Light red text, burgundy border */}
              THE LOOM HAS SHATTERED
            </h1>
            <p className="text-[#a8a29e] mb-8 text-lg italic">{/* Muted gold/gray text */}
              "The narrative thread has snapped. Reality can no longer be sustained."
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#7f1d1d] text-white font-mono uppercase tracking-widest hover:bg-[#991b1b] transition-colors"
              aria-label="Restart Simulation"
            >{/* Burgundy button */}
              Restart Simulation
            </button>
            {this.state.error && (
              <details className="mt-8 text-left text-xs text-[#a8a29e] font-mono border-t border-[#1c1917] pt-4">{/* Muted gold/gray text, dark charcoal border */}
                <summary className="cursor-pointer hover:text-[#fecaca]" aria-expanded="false" aria-controls="error-details">Technical Diagnostics</summary>{/* Light red hover */}
                <pre id="error-details" className="mt-2 p-4 bg-[#1c1917] overflow-auto rounded text-[#fca5a5]">{/* Dark charcoal background, light red error text */}
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // Access children directly from the destructured props.
    return children;
  }
}
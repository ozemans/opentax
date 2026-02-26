import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console only — never send error data over the network (privacy)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center"
          role="alert"
        >
          <div className="rounded-2xl bg-white p-8 shadow-card max-w-md">
            <svg
              className="mx-auto h-12 w-12 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 className="mt-4 text-xl font-display font-semibold text-slate-dark">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm font-body text-slate">
              An unexpected error occurred. Your data is safe on your device.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-6 rounded-xl bg-primary px-6 py-3 text-sm font-display
                         font-medium text-white hover:bg-primary-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

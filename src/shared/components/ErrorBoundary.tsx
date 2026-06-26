import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label: string; api?: (path: string, opts?: RequestInit) => Promise<Response> },
  { error: Error | null; retryCount: number }
> {
  state: { error: Error | null; retryCount: number } = { error: null, retryCount: 0 };

  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }

  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, e, info);
    this.props.api?.("/api/v1/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: e.message,
        stack: e.stack,
        component: info.componentStack,
        label: this.props.label,
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-icon" aria-hidden="true">!</div>
          <div className="error-boundary-copy">
            <h3>{this.props.label} n'a pas pu se charger.</h3>
            <p>{this.state.error.message || "Une erreur d'affichage a interrompu cette vue."}</p>
          </div>
          <div className="error-boundary-actions">
            <button className="btn btn-primary" onClick={() => this.setState(prev => ({ error: null, retryCount: prev.retryCount + 1 }))}>
              Réessayer
            </button>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              Recharger l'app
            </button>
          </div>
        </div>
      );
    }
    return <React.Fragment key={this.state.retryCount}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;

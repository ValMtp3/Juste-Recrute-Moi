import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label: string; api?: (path: string, opts?: RequestInit) => Promise<Response> },
  { error: Error | null; retryCount: number; showDetails: boolean; reportError: string | null }
> {
  state: { error: Error | null; retryCount: number; showDetails: boolean; reportError: string | null } = { error: null, retryCount: 0, showDetails: false, reportError: null };

  static getDerivedStateFromError(e: Error) {
    return { error: e, showDetails: false, reportError: null };
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
    }).catch((error: unknown) => {
      console.warn(`[ErrorBoundary:${this.props.label}] Rapport d'erreur non envoyé`, error);
      this.setState({ reportError: "Le rapport d'erreur n'a pas pu être envoyé au backend local. Le détail reste disponible ici." });
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-icon" aria-hidden="true">!</div>
          <div className="error-boundary-copy">
            <h3>{this.props.label} n'a pas pu se charger.</h3>
            <p>Une erreur d'affichage a interrompu cette vue. Vous pouvez réessayer sans fermer l'application.</p>
            {this.state.showDetails && (
              <pre className="error-boundary-detail">{this.state.error.message || "Erreur d'affichage inconnue."}</pre>
            )}
            {this.state.reportError && (
              <p className="error-boundary-report">{this.state.reportError}</p>
            )}
          </div>
          <div className="error-boundary-actions">
            <button className="btn btn-primary" onClick={() => this.setState(prev => ({ error: null, retryCount: prev.retryCount + 1, showDetails: false, reportError: null }))}>
              Réessayer
            </button>
            <button className="btn btn-ghost" onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}>
              {this.state.showDetails ? "Masquer le détail" : "Voir le détail"}
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

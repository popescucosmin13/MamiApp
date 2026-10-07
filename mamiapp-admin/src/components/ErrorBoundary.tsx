// src/components/ErrorBoundary.tsx — isolates a crashing route from the rest of the console
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Change this (e.g. route path) to auto-reset the boundary on navigation. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Route error boundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(239,68,68,.14)', color: 'var(--danger)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>⚠️</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Ceva n-a mers pe această pagină</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, maxWidth: 440 }}>
              A apărut o eroare la randare. Restul consolei funcționează — poți reîncărca pagina sau naviga în altă parte.
            </p>
          </div>
          <pre style={{
            fontSize: 11, color: 'var(--text3)', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
            maxWidth: 520, overflow: 'auto', textAlign: 'left',
          }}>{this.state.error.message}</pre>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => this.setState({ error: null })}>Încearcă din nou</button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reîncarcă</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

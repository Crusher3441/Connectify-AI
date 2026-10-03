import { Component } from 'react';

// 7D — the root crash boundary.
//
// ⚠️ CLASS BY NECESSITY, NOT STYLE: React provides no hook equivalent of
// componentDidCatch / getDerivedStateFromError. A function component cannot
// catch a render error in its own subtree, so this is the one place in the
// project where a class component is an API requirement rather than a choice.
//
// It wraps <Routes>, so ANY unhandled render error anywhere in the app lands
// here instead of producing a white screen (audit fix #12).
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // The original error still reaches the console automatically — this line is
    // for provenance, not for the stack.
    console.error('[boundary] UI crash:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            background: 'var(--color-bg)', color: 'var(--color-text)',
            fontFamily: 'var(--font-family)', textAlign: 'center', padding: 24,
          }}
        >
          <h1 style={{ margin: 0 }}>Something went wrong</h1>
          {/* Honest copy: in this architecture everything durable (roster,
              attendance, transcripts) is server-side, so a client crash is
              recoverable by definition. */}
          <p style={{ color: 'var(--color-text-muted)' }}>
            The interface hit an unexpected error. Your meeting data is safe on the server.
          </p>
          <button
            onClick={() => {
              // A hard reload, not a state reset: the crashed tree may hold
              // half-initialised WebRTC/socket state that a state flip would
              // re-render straight back into the same crash.
              window.location.href = '/home';
            }}
            style={{
              background: 'var(--color-primary)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '12px 22px', cursor: 'pointer',
            }}
          >
            Back to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL REACT ERROR:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#b91c1c', background: '#fef2f2', minHeight: '100vh', zIndex: 999999, position: 'relative' }}>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>Application Render Error</h1>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ background: '#fff', padding: 16, border: '1px solid #fecaca', borderRadius: 8, overflowX: 'auto', fontSize: 13, color: '#333' }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <pre style={{ background: '#fff', padding: 16, border: '1px solid #fecaca', borderRadius: 8, overflowX: 'auto', marginTop: 16, fontSize: 13, color: '#666' }}>
            {this.state.error && this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);


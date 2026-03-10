import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", padding: 40, gap: 16,
        }}>
          <span style={{ fontSize: "2.5rem" }}>⚠️</span>
          <h2 style={{ color: "#ef4444", margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#888", fontSize: "0.85rem", margin: 0, maxWidth: 360, textAlign: "center" }}>
            {this.state.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              padding: "9px 20px", borderRadius: 10, background: "#5090e0",
              color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

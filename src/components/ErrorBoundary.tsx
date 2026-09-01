import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-3xl tracking-wide text-red">Vcell</p>
        <p className="mt-3 text-sm text-mute">O app travou ao abrir. Seus dados continuam neste celular.</p>
        <p className="mt-2 max-w-xs text-xs text-mute">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 flex h-12 w-full max-w-xs items-center justify-center rounded-2xl bg-red font-semibold text-white"
        >
          Abrir de novo
        </button>
      </div>
    )
  }
}

import { Component, Fragment } from 'react'

/** 看板或子组件异常时自动静默重挂载恢复，不中断画布正常展示。 */
export class ErrorBoundary extends Component {
  state = { error: null, retryKey: 0, retried: false }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch() {
    if (!this.state.retried) {
      this.setState(s => ({ error: null, retryKey: s.retryKey + 1, retried: true }))
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null, retried: false })
    }
  }

  render() {
    if (!this.state.error) {
      return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>
    }
    return this.props.fallback ?? null
  }
}

import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
})

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; email: string }
  | { kind: 'already' }
  | { kind: 'invalid' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [state, setState] = React.useState<State>({ kind: 'loading' })

  React.useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' })
      return
    }
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
        const json = (await res.json().catch(() => ({}))) as {
          email?: string
          used?: boolean
          error?: string
        }
        if (!alive) return
        if (json.used) return setState({ kind: 'already' })
        if (!res.ok || !json.email) return setState({ kind: 'invalid' })
        setState({ kind: 'ready', email: json.email })
      } catch (e) {
        if (alive) setState({ kind: 'error', message: (e as Error).message })
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  async function confirm() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        return setState({ kind: 'error', message: j.error ?? 'Falha ao cancelar' })
      }
      setState({ kind: 'success' })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-md w-full border border-neutral-200 rounded-lg p-8 text-center">
        <h1 className="text-2xl font-black tracking-tight text-black mb-4">
          GF Tattoo Academy
        </h1>
        {state.kind === 'loading' && (
          <p className="text-sm text-neutral-500">Verificando…</p>
        )}
        {state.kind === 'invalid' && (
          <p className="text-sm text-neutral-600">
            Link inválido ou expirado.
          </p>
        )}
        {state.kind === 'already' && (
          <p className="text-sm text-neutral-600">
            Este endereço já foi descadastrado.
          </p>
        )}
        {state.kind === 'ready' && (
          <>
            <p className="text-sm text-neutral-700 mb-6">
              Deseja parar de receber e-mails em{' '}
              <strong className="text-black">{state.email}</strong>?
            </p>
            <button
              onClick={confirm}
              className="bg-black text-white text-sm rounded-lg px-6 py-3 font-medium hover:bg-neutral-800 transition"
            >
              Confirmar cancelamento
            </button>
          </>
        )}
        {state.kind === 'success' && (
          <p className="text-sm text-neutral-700">
            Pronto. Você não receberá mais e-mails.
          </p>
        )}
        {state.kind === 'error' && (
          <p className="text-sm text-red-600">Erro: {state.message}</p>
        )}
      </div>
    </div>
  )
}
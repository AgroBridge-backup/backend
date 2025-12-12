// components/AgroGPTPanel.tsx
'use client'

import { useState } from 'react'
import { apiMutate } from '@/hooks/useApiMutate'

export default function AgroGPTPanel({ token }: { token: string }) {
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAsk = async () => {
    setLoading(true)
    setError(null)
    setResponse('')
    try {
      const data = await apiMutate('/agrogpt', 'POST', { question: input }, token)
      setResponse(data.answer)
    } catch (err: any) {
      setError(err.message || 'Error al consultar la IA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="my-8 p-6 bg-aguacate-light/10 rounded-lg shadow-soft border border-aguacate-light/20">
      <h3 className="text-2xl font-display font-bold text-aguacate-dark mb-4">AgroGPT.ai – Research Pro</h3>
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pregúntale algo a la IA agrícola…"
          className="flex-grow p-2 border border-aguacate-light/30 rounded-md focus:ring-aguacate focus:border-aguacate"
          disabled={loading}
        />
        <button
          onClick={handleAsk}
          className="bg-aguacate text-white px-4 py-2 rounded-md hover:bg-aguacate-dark transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Consultando...' : 'Consultar IA'}
        </button>
      </div>
      {error && <p className="text-fresa mt-4">{error}</p>}
      {response && <div className="mt-4 p-4 bg-aguacate-light/20 rounded-md text-tierra-light">{response}</div>}
    </section>
  )
}
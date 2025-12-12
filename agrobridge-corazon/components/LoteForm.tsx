// components/LoteForm.tsx
'use client'

import { useState } from 'react'
import { apiMutate } from '@/hooks/useApiMutate'

export default function LoteForm({ token }: { token?: string }) {
  const [producto, setProducto] = useState('')
  const [fecha, setFecha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await apiMutate('/lotes', 'POST', { producto, fecha }, token)
      setSuccess(true)
      setProducto('')
      setFecha('')
    } catch (err: any) {
      setError(err.message || 'Error al crear lote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="my-8 p-6 bg-white rounded-lg shadow-soft border border-aguacate-light/20">
      <h3 className="text-2xl font-display font-bold text-tierra mb-4">Crear Nuevo Lote</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="producto" className="block text-tierra-light text-sm font-medium mb-1">Producto</label>
          <input
            type="text"
            id="producto"
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            className="w-full p-2 border border-aguacate-light/30 rounded-md focus:ring-aguacate focus:border-aguacate"
            required
          />
        </div>
        <div>
          <label htmlFor="fecha" className="block text-tierra-light text-sm font-medium mb-1">Fecha de Cosecha</label>
          <input
            type="date"
            id="fecha"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full p-2 border border-aguacate-light/30 rounded-md focus:ring-aguacate focus:border-aguacate"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-aguacate text-white px-4 py-2 rounded-md hover:bg-aguacate-dark transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Creando...' : 'Crear Lote'}
        </button>
      </form>
      {error && <p className="text-fresa mt-4">{error}</p>}
      {success && <p className="text-aguacate mt-4">Lote creado exitosamente!</p>}
    </section>
  )
}
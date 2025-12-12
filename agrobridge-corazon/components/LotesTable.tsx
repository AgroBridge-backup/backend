// components/LotesTable.tsx
import { useApi } from '@/hooks/useApi'
export default function LotesTable({ token }: { token?: string }) {
const { data, error, isLoading } = useApi('/lotes', token)
if (isLoading) return <p>Cargando…</p>
if (error) return <p>Error cargando lotes</p>
if (!data?.length) return <p>No hay lotes registrados.</p>
return (
<table>
<thead>
<tr>
<th>ID</th><th>Producto</th><th>Fecha</th>
</tr>
</thead>
<tbody>
{data.map((lote: any) => (
<tr key={lote.id}>
<td>{lote.id}</td>
<td>{lote.producto}</td>
<td>{lote.fecha}</td>
</tr>
))}
</tbody>
</table>
)
}
// components/DashboardMain.tsx
import { useApi } from '@/hooks/useApi'
export default function DashboardMain({ token }: { token?: string }) {
const { data, error, isLoading } = useApi('/dashboard', token)
if (isLoading) return <p>Cargando datos…</p>
if (error) return <p>Error cargando dashboard</p>
return (
<section>
<h2>KPI de tu operación agrícola</h2>
<ul>
<li>Exportaciones este mes: {data.exportaciones}</li>
<li>Cajas certificadas: {data.cajasCertificadas}</li>
<li>Alertas IA AgroGPT: {data.alertasIA?.join(', ')}</li>
</ul>
{/* Agrega gráficos con Recharts o ApexCharts */}
</section>
)
}
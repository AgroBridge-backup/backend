'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DashboardLayout from '../../../components/dashboard/DashboardLayout'
import {
  liquidityPoolService,
  advanceService,
  LiquidityPool,
  PoolMetrics,
  Advance,
  AdvanceStatus,
} from '../../../services/cashFlowBridge'
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  PieChart,
  Activity,
} from 'lucide-react'
import { motion } from 'framer-motion'

// ════════════════════════════════════════════════════════════════════════════════
// STATUS BADGE COMPONENT
// ════════════════════════════════════════════════════════════════════════════════

const StatusBadge = ({ status }: { status: AdvanceStatus }) => {
  const statusConfig: Record<AdvanceStatus, { color: string; bg: string; label: string }> = {
    PENDING_APPROVAL: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Pendiente' },
    UNDER_REVIEW: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'En Revisión' },
    APPROVED: { color: 'text-green-700', bg: 'bg-green-100', label: 'Aprobado' },
    REJECTED: { color: 'text-red-700', bg: 'bg-red-100', label: 'Rechazado' },
    DISBURSED: { color: 'text-purple-700', bg: 'bg-purple-100', label: 'Desembolsado' },
    ACTIVE: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Activo' },
    DELIVERY_IN_PROGRESS: { color: 'text-cyan-700', bg: 'bg-cyan-100', label: 'En Tránsito' },
    DELIVERY_CONFIRMED: { color: 'text-teal-700', bg: 'bg-teal-100', label: 'Entregado' },
    PARTIALLY_REPAID: { color: 'text-indigo-700', bg: 'bg-indigo-100', label: 'Pago Parcial' },
    COMPLETED: { color: 'text-green-700', bg: 'bg-green-100', label: 'Completado' },
    OVERDUE: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'Vencido' },
    DEFAULT_WARNING: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'Alerta' },
    DEFAULTED: { color: 'text-red-700', bg: 'bg-red-100', label: 'En Default' },
    IN_COLLECTIONS: { color: 'text-red-700', bg: 'bg-red-100', label: 'Cobranza' },
    CANCELLED: { color: 'text-gray-700', bg: 'bg-gray-100', label: 'Cancelado' },
  }

  const config = statusConfig[status] || { color: 'text-gray-700', bg: 'bg-gray-100', label: status }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// RISK TIER BADGE
// ════════════════════════════════════════════════════════════════════════════════

const RiskTierBadge = ({ tier }: { tier: 'A' | 'B' | 'C' }) => {
  const config = {
    A: { color: 'text-green-700', bg: 'bg-green-100', label: 'Tier A' },
    B: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'Tier B' },
    C: { color: 'text-red-700', bg: 'bg-red-100', label: 'Tier C' },
  }

  const { color, bg, label } = config[tier]

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${color}`}>
      {label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// METRIC CARD COMPONENT
// ════════════════════════════════════════════════════════════════════════════════

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: { value: number; label: string }
  color: 'green' | 'blue' | 'purple' | 'orange' | 'red'
}

const MetricCard = ({ title, value, subtitle, icon, trend, color }: MetricCardProps) => {
  const colorClasses = {
    green: 'from-green-500 to-emerald-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
    orange: 'from-orange-500 to-amber-600',
    red: 'from-red-500 to-rose-600',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} text-white`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// ADVANCE ROW COMPONENT
// ════════════════════════════════════════════════════════════════════════════════

interface AdvanceRowProps {
  advance: Advance
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onDisburse: (id: string) => void
}

const AdvanceRow = ({ advance, onApprove, onReject, onDisburse }: AdvanceRowProps) => {
  const isPending = advance.status === 'PENDING_APPROVAL'
  const isApproved = advance.status === 'APPROVED'

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <td className="py-4 px-4">
        <div className="font-medium text-gray-900">{advance.contractNumber}</div>
        <div className="text-sm text-gray-500">{advance.farmerName || 'Productor'}</div>
      </td>
      <td className="py-4 px-4">
        <div className="font-semibold text-gray-900">
          ${advance.advanceAmount.toLocaleString('es-MX')}
        </div>
        <div className="text-sm text-gray-500">
          de ${advance.orderAmount.toLocaleString('es-MX')} ({advance.advancePercentage}%)
        </div>
      </td>
      <td className="py-4 px-4">
        <StatusBadge status={advance.status} />
      </td>
      <td className="py-4 px-4">
        <RiskTierBadge tier={advance.riskTier} />
        <div className="text-sm text-gray-500 mt-1">Score: {advance.creditScoreValue}</div>
      </td>
      <td className="py-4 px-4 text-sm text-gray-500">
        {new Date(advance.dueDate).toLocaleDateString('es-MX')}
      </td>
      <td className="py-4 px-4">
        <div className="flex gap-2">
          {isPending && (
            <>
              <button
                onClick={() => onApprove(advance.id)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Aprobar"
              >
                <CheckCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => onReject(advance.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Rechazar"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </>
          )}
          {isApproved && (
            <button
              onClick={() => onDisburse(advance.id)}
              className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Desembolsar
            </button>
          )}
          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </td>
    </motion.tr>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD PAGE
// ════════════════════════════════════════════════════════════════════════════════

export default function CashFlowBridgeDashboard() {
  const [selectedPool, setSelectedPool] = useState<string>('pilot-pool-001')
  const [isClient, setIsClient] = useState(false)

  // Fetch pool data
  const { data: pool, error: poolError, isLoading: poolLoading } = useSWR<LiquidityPool>(
    selectedPool ? `/pool/${selectedPool}` : null,
    () => liquidityPoolService.getPool(selectedPool)
  )

  // Fetch pool metrics
  const { data: metrics, isLoading: metricsLoading } = useSWR<PoolMetrics>(
    selectedPool ? `/pool/${selectedPool}/metrics` : null,
    () => liquidityPoolService.getPoolMetrics(selectedPool)
  )

  // Fetch advances
  const { data: advancesData, mutate: mutateAdvances, isLoading: advancesLoading } = useSWR(
    '/advances',
    () => advanceService.getAdvances({ poolId: selectedPool })
  )

  const advances = advancesData?.data || []

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Action handlers
  const handleApprove = async (advanceId: string) => {
    try {
      await advanceService.approveAdvance(advanceId, 'Aprobado desde dashboard admin')
      mutateAdvances()
    } catch (error) {
      console.error('Error approving advance:', error)
      alert('Error al aprobar el anticipo')
    }
  }

  const handleReject = async (advanceId: string) => {
    const reason = prompt('Motivo del rechazo:')
    if (!reason) return

    try {
      await advanceService.rejectAdvance(advanceId, reason)
      mutateAdvances()
    } catch (error) {
      console.error('Error rejecting advance:', error)
      alert('Error al rechazar el anticipo')
    }
  }

  const handleDisburse = async (advanceId: string) => {
    const reference = `SPEI-${Date.now()}`
    try {
      await advanceService.disburseAdvance(advanceId, reference)
      mutateAdvances()
    } catch (error) {
      console.error('Error disbursing advance:', error)
      alert('Error al desembolsar el anticipo')
    }
  }

  if (!isClient) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    )
  }

  const isLoading = poolLoading || metricsLoading || advancesLoading

  // Calculate summary stats
  const pendingCount = advances.filter(a => a.status === 'PENDING_APPROVAL').length
  const activeCount = advances.filter(a => ['ACTIVE', 'DISBURSED', 'DELIVERY_IN_PROGRESS'].includes(a.status)).length
  const overdueCount = advances.filter(a => ['OVERDUE', 'DEFAULT_WARNING', 'DEFAULTED'].includes(a.status)).length

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Cash Flow Bridge
            </h1>
            <p className="text-gray-500 mt-1">
              Panel de administración de anticipos y liquidez
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => mutateAdvances()}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-medium text-gray-700 shadow-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </motion.button>
        </div>

        {/* Pool Info Banner */}
        {pool && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{pool.name}</h2>
                <p className="text-green-100 text-sm mt-1">{pool.description}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    ${(pool.availableCapital / 1000).toFixed(0)}K
                  </div>
                  <div className="text-green-100 text-sm">Disponible</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{pool.utilizationRate}%</div>
                  <div className="text-green-100 text-sm">Utilización</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{pool.actualReturnRate}%</div>
                  <div className="text-green-100 text-sm">ROI Actual</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Capital Total"
            value={`$${((metrics?.totalCapital || 0) / 1000).toFixed(0)}K`}
            subtitle="Pool principal"
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
          <MetricCard
            title="Anticipos Activos"
            value={activeCount}
            subtitle={`${pendingCount} pendientes de aprobación`}
            icon={<Activity className="w-6 h-6" />}
            color="blue"
          />
          <MetricCard
            title="Total Desembolsado"
            value={`$${((metrics?.totalDisbursed || 0) / 1000).toFixed(0)}K`}
            subtitle="Histórico"
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
          />
          <MetricCard
            title="Tasa de Default"
            value={`${metrics?.defaultRate || 0}%`}
            subtitle={`${overdueCount} en riesgo`}
            icon={<AlertTriangle className="w-6 h-6" />}
            color={overdueCount > 0 ? 'red' : 'green'}
          />
        </div>

        {/* Advances Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Solicitudes de Anticipo</h3>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                {pendingCount} Pendientes
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {activeCount} Activos
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : advances.length === 0 ? (
            <div className="p-12 text-center">
              <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-600">Sin anticipos</h4>
              <p className="text-gray-400 mt-1">No hay solicitudes de anticipo en este momento</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contrato</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Monto</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Riesgo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vencimiento</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((advance) => (
                  <AdvanceRow
                    key={advance.id}
                    advance={advance}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onDisburse={handleDisburse}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

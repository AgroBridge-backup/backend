'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { batchService, Batch } from '../../services/api'
import DashboardLayout from '../../components/dashboard/DashboardLayout'
import LoteCard from '../../components/dashboard/LoteCard'
import { Plus, Loader2, AlertCircle, Package } from 'lucide-react'
import { motion } from 'framer-motion'

// Skeleton Loader Component
const BatchSkeleton = () => (
    <div className="bg-white/40 border border-white/50 rounded-2xl p-4 h-[380px] animate-pulse flex flex-col gap-4">
        <div className="h-40 bg-gray-200/50 rounded-xl w-full"></div>
        <div className="h-6 bg-gray-200/50 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200/50 rounded w-1/2"></div>
        <div className="flex-1 space-y-3 mt-4">
            <div className="h-10 bg-gray-200/50 rounded-lg"></div>
            <div className="h-10 bg-gray-200/50 rounded-lg"></div>
        </div>
    </div>
)

export default function DashboardPage() {
    const router = useRouter()
    // Fetching de datos real con SWR
    // La clave es la URL o identificador, el fetcher es nuestra función del servicio
    const { data: batches, error, isLoading } = useSWR<Batch[]>('/batches', batchService.getBatches)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        // Simulamos un token JWT. En una app real, esto vendría de un proceso de login.
        const token = localStorage.getItem('token') // Usar 'token' como en services/api.ts
        if (!token) {
            // Para la demo, creamos un token falso si no existe.
            // ¡NO HACER ESTO EN PRODUCCIÓN!
            console.warn("DEMO: No se encontró token, generando uno falso para la sesión.");
            localStorage.setItem('token', 'fake-jwt-for-demo-purposes');
            // router.replace('/login'); // Descomentar para redirigir a login si no hay token
        }
    }, [router])

    if (!isClient) {
        return (
            <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
                <div className="animate-pulse text-2xl font-bold text-gray-400">Cargando Dashboard...</div>
            </div>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                {/* Header de Sección */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Mis Lotes</h2>
                        <p className="text-gray-500 mt-1">Gestiona y monitorea tus envíos en tiempo real.</p>
                    </div>
                    
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 flex items-center gap-2 hover:shadow-xl transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Registrar Nuevo Lote
                    </motion.button>
                </div>

                {/* Estado de Carga */}
                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => <BatchSkeleton key={i} />)}
                    </div>
                )}

                {/* Estado de Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-2xl mx-auto">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-red-800 mb-2">Error al cargar los datos</h3>
                        <p className="text-red-600 mb-6">No pudimos conectar con el servidor. Por favor verifica tu conexión.</p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Estado Vacío (Empty State) */}
                {!isLoading && !error && batches && batches.length === 0 && (
                    <div className="text-center py-20 bg-white/40 backdrop-blur-md border border-white/50 rounded-3xl border-dashed border-gray-300">
                         <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Package className="w-10 h-10 text-green-600/50" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Tu almacén está vacío</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-8">
                            Aún no has registrado ningún lote. Comienza ahora para asegurar tu primera exportación con tecnología Blockchain.
                        </p>
                         <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold shadow-lg hover:bg-green-700 transition-all"
                        >
                            Crear Primer Lote
                        </motion.button>
                    </div>
                )}

                {/* Grid de Lotes (Data Real) */}
                {!isLoading && !error && batches && batches.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {batches.map((batch) => (
                            <LoteCard key={batch.id} batch={batch} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
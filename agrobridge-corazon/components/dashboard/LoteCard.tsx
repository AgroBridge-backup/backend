'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ShieldCheck, Clock, MapPin, ArrowRight, X, Award } from 'lucide-react'
import { Batch } from '../../services/api' // Ruta relativa corregida
import Image from 'next/image'
import { clsx } from 'clsx'

// Imágenes placeholder (en prod usaríamos las reales del lote o un CDN)
const IMAGES = {
    'HASS': 'https://placehold.co/400x200/22c55e/ffffff/HASS', // Aguacate
    'BERRIES': 'https://placehold.co/400x200/ef4444/ffffff/BERRIES', // Fresa
    'Default': 'https://placehold.co/400x200/6b7280/ffffff/FRUIT' // Generic Fruit
}

export default function LoteCard({ batch }: { batch: Batch }) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const status = batch.blockchainHash ? 'EN_BLOCKCHAIN' : 'PENDIENTE'
    const imageUrl = IMAGES[batch.variety as keyof typeof IMAGES] || IMAGES['Default'];
    const isVerified = !!batch.blockchainHash;

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="group relative bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-lg hover:shadow-2xl overflow-hidden flex flex-col h-full"
            >
                {/* Imagen de Cabecera */}
                <div className="h-40 w-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                    <Image 
                        src={imageUrl} 
                        alt={batch.variety} 
                        layout="fill" 
                        objectFit="cover" 
                        className="transition-transform duration-700 group-hover:scale-110" 
                    />
                    
                    {/* Badge de Estado */}
                    <div className="absolute top-3 right-3 z-20">
                        <div className={clsx(
                            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-sm border border-white/20",
                            status === 'EN_BLOCKCHAIN' 
                                ? "bg-green-500/80 text-white" 
                                : "bg-amber-500/80 text-white"
                        )}>
                            {status === 'EN_BLOCKCHAIN' ? (
                                <>
                                    <motion.div className="w-2 h-2 bg-white rounded-full" 
                                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                    <span>Blockchain Verified</span>
                                </>
                            ) : (
                                <>
                                    <Clock className="w-3 h-3" />
                                    <span>Pendiente</span>
                                </>
                            )}
                        </div>
                    </div>

                     {/* Título sobre imagen */}
                     <div className="absolute bottom-3 left-4 z-20 text-white">
                        <h3 className="text-lg font-bold leading-tight">{batch.variety}</h3>
                        <p className="text-xs opacity-90 font-medium">ID: {batch.id.slice(0, 8)}...</p>
                     </div>
                </div>

                {/* Cuerpo de la Tarjeta */}
                <div className="p-5 flex-1 flex flex-col">
                    <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-50 rounded-lg text-green-700 mt-0.5">
                                <Package className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Peso Total</p>
                                <p className="text-gray-900 font-semibold">{batch.weightKg.toLocaleString()} kg</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                             <div className="p-2 bg-blue-50 rounded-lg text-blue-700 mt-0.5">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Origen</p>
                                <p className="text-gray-900 font-semibold text-sm line-clamp-1">{batch.origin}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Acción */}
                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">
                            {new Date(batch.harvestDate).toLocaleDateString()}
                        </span>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="text-sm font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 transition-colors"
                        >
                            Ver Detalles <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Hash Decorativo (Solo visible si verificado) */}
                {isVerified && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-teal-500" />
                )}
            </motion.div>

            {/* Modal Simulado */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10">
                                <X className="w-6 h-6" />
                            </button>
                            <div className="text-center">
                                <Award className="w-16 h-16 mx-auto text-yellow-500" />
                                <h2 className="text-2xl font-bold mt-4">Certificado de Trazabilidad</h2>
                                <p className="text-sm text-gray-500 mt-1">Lote #{batch.id.substring(0, 12)}</p>
                                <div className="mt-6 text-left bg-gray-100/50 p-4 rounded-lg text-xs space-y-2 font-mono">
                                    <p><span className="font-bold">Blockchain Hash:</span></p>
                                    <p className="break-all">{batch.blockchainHash || 'Aún no generado'}</p>
                                    <p className="mt-4"><span className="font-bold">Estado:</span> {status.replace('_', ' ')}</p>
                                </div>
                                <p className="text-xs text-gray-400 mt-6">Este es un certificado simulado. En producción, aquí se mostraría un QR y detalles validados por la blockchain.</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
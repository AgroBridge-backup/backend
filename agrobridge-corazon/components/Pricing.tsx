'use client'

import { Check, Zap, Brain } from 'lucide-react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Definición de Tipos para mayor seguridad
interface Feature {
  icon: React.ElementType;
  text: string;
}

interface PricingTier {
  name: string;
  priceMXN: number;
  priceUSD: number;
  hectares: string;
  hook: string;
  features: Feature[];
  isFeatured: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Semilla',
    priceMXN: 980,
    priceUSD: 60,
    hectares: '1-4 Ha',
    hook: 'Para empezar a exportar sin riesgo.',
    features: [
      { icon: Zap, text: '3 Exportaciones' },
      { icon: Brain, text: 'Modelos Lightning 1.0' },
      { icon: Check, text: 'AgroGPT 1.1 Plus' },
    ],
    isFeatured: false,
  },
  {
    name: 'Cosecha',
    priceMXN: 2550,
    priceUSD: 138,
    hectares: '5-30 Ha',
    hook: 'La herramienta definitiva para el productor serio.',
    features: [
      { icon: Zap, text: '10 Exportaciones' },
      { icon: Brain, text: 'Modelos Lightning 1.1' },
      { icon: Check, text: 'AgroGPT 1.2 Pro (Doble Contexto)' },
      { icon: Check, text: 'Informes Mensuales "IntenseThinking"' },
    ],
    isFeatured: true,
  },
  {
    name: 'Agro-Industrial',
    priceMXN: 10700,
    priceUSD: 583,
    hectares: '>30 Ha',
    hook: 'Potencia ilimitada para líderes de mercado.',
    features: [
      { icon: Zap, text: '25+ Exportaciones' },
      { icon: Brain, text: 'Modelos Nuevos (Beta)' },
      { icon: Check, text: 'Sin límites' },
      { icon: Check, text: 'AgroGPT MAX (Tokens ilimitados)' },
    ],
    isFeatured: false,
  },
]

const PricingCard = ({ tier }: { tier: PricingTier }) => {
  return (
    <motion.div
      className={twMerge(
        clsx(
          'relative p-8 rounded-2xl border transition-all duration-300 ease-in-out',
          'bg-white/40 backdrop-blur-lg shadow-lg',
          tier.isFeatured
            ? 'border-green-500/50 ring-2 ring-green-500/80 scale-105 shadow-2xl'
            : 'border-white/20 hover:shadow-xl hover:border-white/50'
        )
      )}
      whileHover={{ y: -10 }}
    >
      {tier.isFeatured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-bold shadow-md">
          MÁS RENTABLE
        </div>
      )}

      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
        <p className="text-sm text-gray-600 mt-1">{tier.hectares}</p>
        <div className="mt-6">
          <span className="text-5xl font-extrabold text-gray-900">${tier.priceMXN.toLocaleString('es-MX')}</span>
          <span className="text-lg font-medium text-gray-500"> MXN</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">/ ${tier.priceUSD} USD</p>
      </div>

      <ul className="mt-8 space-y-4">
        {tier.features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <feature.icon className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-gray-700">{feature.text}</span>
          </li>
        ))}
      </ul>

      <motion.button
        className={twMerge(
          clsx(
            'w-full mt-10 px-6 py-3 text-lg font-semibold rounded-lg transition-all duration-300',
            tier.isFeatured
              ? 'text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg'
              : 'text-green-700 bg-white/60 hover:bg-white'
          )
        )}
        whileTap={{ scale: 0.95 }}
      >
        Comenzar Ahora
      </motion.button>
      <p className="text-center text-xs text-gray-500 mt-4">{tier.hook}</p>
    </motion.div>
  )
}

export default function Pricing() {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Una Inversión, no un Gasto.
          </h2>
          <p className="text-lg text-gray-600">
            Planes diseñados para crecer contigo. Elige la potencia que necesitas para llevar tu producto al siguiente nivel.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <PricingCard key={index} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  )
}
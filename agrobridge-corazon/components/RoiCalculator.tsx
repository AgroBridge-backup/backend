
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, Calculator, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export default function RoiCalculator() {
  const [annualTons, setAnnualTons] = useState(100)
  const [avgValuePerKg, setAvgValuePerKg] = useState(20) // MXN

  // Precios de AgroBridge (aproximados, basados en los tiers definidos)
  const AGROBRIDGE_COST_PER_TON_TIER1 = 600; // 980 MXN / 1.63 Ton (3 exports * 1000kg / 1.8 ton/export)
  const AGROBRIDGE_COST_PER_TON_TIER2 = 255; // 2550 MXN / 10 Ton
  const AGROBRIDGE_COST_PER_TON_TIER3 = 200; // 10700 MXN / 50 Ton (asumiendo 50 ton para 25+ exports)

  // Simulación de merma sin AgroBridge (ej. 5% del valor total por falta de trazabilidad, rechazos, etc.)
  const MERMA_PERCENTAGE = 0.05; 

  const calculateCosts = useMemo(() => {
    const totalAnnualValue = annualTons * 1000 * avgValuePerKg; // Convertir toneladas a kg
    const potentialLossWithoutAgroBridge = totalAnnualValue * MERMA_PERCENTAGE;

    let agrobridgeCost = 0;
    if (annualTons <= 4) { // Plan Semilla (asumiendo 1-4 Ha ~ 1.6-6.4 Ton)
        agrobridgeCost = AGROBRIDGE_COST_PER_TON_TIER1 * annualTons;
    } else if (annualTons <= 30) { // Plan Cosecha
        agrobridgeCost = AGROBRIDGE_COST_PER_TON_TIER2 * annualTons;
    } else { // Plan Agro-Industrial
        agrobridgeCost = AGROBRIDGE_COST_PER_TON_TIER3 * annualTons;
    }

    const netBenefit = potentialLossWithoutAgroBridge - agrobridgeCost;
    const roiMessage = netBenefit > 0 
        ? `¡Recuperas tu inversión en el primer envío y generas ganancias!`
        : `AgroBridge es una inversión clave para tu futuro.`;

    return {
      potentialLossWithoutAgroBridge,
      agrobridgeCost,
      netBenefit,
      roiMessage,
    };
  }, [annualTons, avgValuePerKg]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  };

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Calcula tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Retorno de Inversión</span>
          </h2>
          <p className="text-lg text-gray-600">
            Descubre cuánto puedes ahorrar y ganar al asegurar tus envíos con AgroBridge.
          </p>
        </div>

        <div className="max-w-4xl mx-auto bg-white/50 backdrop-blur-xl border border-white/70 rounded-3xl shadow-2xl p-8 lg:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* Input Toneladas Anuales */}
            <div>
              <label htmlFor="annualTons" className="block text-lg font-semibold text-gray-700 mb-3">
                Toneladas Anuales Producidas
              </label>
              <input
                type="range"
                id="annualTons"
                min="1"
                max="100"
                step="1"
                value={annualTons}
                onChange={(e) => setAnnualTons(Number(e.target.value))}
                className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <p className="text-center text-gray-600 mt-2">{annualTons} Toneladas</p>
            </div>

            {/* Input Valor por Kilo */}
            <div>
              <label htmlFor="avgValuePerKg" className="block text-lg font-semibold text-gray-700 mb-3">
                Valor Promedio por Kilo (MXN)
              </label>
              <input
                type="range"
                id="avgValuePerKg"
                min="5"
                max="50"
                step="1"
                value={avgValuePerKg}
                onChange={(e) => setAvgValuePerKg(Number(e.target.value))}
                className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <p className="text-center text-gray-600 mt-2">{formatCurrency(avgValuePerKg)} / kg</p>
            </div>
          </div>

          {/* Resultados */}
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <span className="text-gray-700 font-medium">Riesgo de Merma sin AgroBridge:</span>
              </div>
              <span className="text-red-600 font-bold text-xl">{formatCurrency(calculateCosts.potentialLossWithoutAgroBridge)}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-3">
                <Calculator className="w-6 h-6 text-green-600" />
                <span className="text-gray-700 font-medium">Costo Anual de AgroBridge:</span>
              </div>
              <span className="text-green-600 font-bold text-xl">{formatCurrency(calculateCosts.agrobridgeCost)}</span>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={twMerge(
                clsx(
                  "p-6 rounded-2xl text-center shadow-lg",
                  calculateCosts.netBenefit > 0 ? "bg-blue-100/70 border border-blue-200" : "bg-gray-100/70 border border-gray-200"
                )
              )}
            >
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {calculateCosts.roiMessage}
              </h3>
              {calculateCosts.netBenefit > 0 && (
                <p className="text-blue-700 font-bold text-2xl">
                  Beneficio Neto: {formatCurrency(calculateCosts.netBenefit)}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

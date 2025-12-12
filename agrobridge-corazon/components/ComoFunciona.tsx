'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Smartphone, QrCode, Globe, Shield } from 'lucide-react'

export default function ComoFunciona() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const pasos = [
    {
      numero: '1',
      emoji: '📱',
      icon: Smartphone,
      titulo: 'Tú cosechas',
      descripcion: 'Cuando empaques tus aguacates o fresas, tomas una foto con tu celular. Así de fácil.',
      color: 'from-aguacate-light to-aguacate',
    },
    {
      numero: '2',
      emoji: '🏷️',
      icon: QrCode,
      titulo: 'Nosotros creamos el QR',
      descripcion: 'Automáticamente generamos un código QR único. Lo imprimes y lo pegas en la caja. Ya está.',
      color: 'from-tech-blue to-tech-green',
    },
    {
      numero: '3',
      emoji: '✈️',
      icon: Globe,
      titulo: 'Tu fruta viaja',
      descripcion: 'Mientras va en camino, tu cliente puede escanear el QR y ver toda la información: de dónde viene, cuándo se cosechó, certificados.',
      color: 'from-cielo to-cielo-dark',
    },
    {
      numero: '4',
      emoji: '✅',
      icon: Shield,
      titulo: 'Confianza garantizada',
      descripcion: 'La información está protegida con blockchain (como Bitcoin, pero para aguacates). Nadie puede cambiarla ni falsificarla.',
      color: 'from-fresa to-fresa-dark',
    },
  ]

  return (
    <section id="como-funciona" ref={ref} className="py-24 bg-gradient-to-b from-white to-aguacate-light/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-tierra mb-4">
            ¿Cómo funciona esto del blockchain?
          </h2>
          <p className="text-xl text-tierra-light/70 max-w-3xl mx-auto">
            Te lo explicamos como si estuviéramos platicando en el cafetal. <span className="text-aguacate font-semibold">Sin palabras raras.</span>
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pasos.map((paso, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + idx * 0.1 }}
              className="relative"
            >
              {idx < pasos.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-aguacate-light/50 to-transparent -translate-x-4" />
              )}

              <div className="relative bg-white rounded-3xl p-8 shadow-soft hover:shadow-warm transition-all duration-300 border border-aguacate-light/20 hover:border-aguacate-light hover:scale-105">
                <div className={`absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br ${paso.color} rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                  {paso.numero}
                </div>

                <div className="text-6xl mb-4 text-center">{paso.emoji}</div>

                <h3 className="text-xl font-display font-bold text-tierra mb-3 text-center">
                  {paso.titulo}
                </h3>

                <p className="text-tierra-light/70 text-center leading-relaxed">
                  {paso.descripcion}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-aguacate-light/10 px-6 py-4 rounded-2xl border border-aguacate-light/30">
            <span className="text-3xl">☕</span>
            <p className="text-tierra-light/80">
              <span className="font-semibold text-aguacate">No necesitas ser ingeniero.</span> Si sabes usar WhatsApp, ya sabes usar esto.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

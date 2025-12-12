'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { TrendingUp, Shield, Clock, Award, Heart, Zap } from 'lucide-react'

export default function Beneficios() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const beneficios = [
    {
      icon: TrendingUp,
      titulo: 'Vende más caro',
      descripcion: 'Tus clientes pagan hasta 30% más por productos con trazabilidad verificada',
      color: 'text-aguacate',
      bg: 'bg-aguacate-light/10',
    },
    {
      icon: Shield,
      titulo: 'Protege tu reputación',
      descripcion: 'Demuestra que tu producto es genuino. Ningún intermediario puede falsificar tu historia',
      color: 'text-tech-blue',
      bg: 'bg-tech-blue/10',
    },
    {
      icon: Clock,
      titulo: 'Ahorra tiempo en aduana',
      descripcion: 'Toda tu documentación certificada lista al instante. Menos rechazos, menos demoras',
      color: 'text-fresa',
      bg: 'bg-fresa-light/10',
    },
    {
      icon: Award,
      titulo: 'Cumple regulaciones',
      descripcion: 'FDA, USDA, Europa - todas las certificaciones organizadas y verificables',
      color: 'text-tierra',
      bg: 'bg-tierra-light/10',
    },
    {
      icon: Heart,
      titulo: 'Clientes felices',
      descripcion: 'Tus compradores pueden ver el rostro del agricultor que cosechó su fruta. Eso genera lealtad',
      color: 'text-fresa',
      bg: 'bg-fresa-light/10',
    },
    {
      icon: Zap,
      titulo: 'Tecnología simple',
      descripcion: 'Todo desde tu celular. No necesitas computadora, ni instalar nada complicado',
      color: 'text-tech-green',
      bg: 'bg-tech-green/10',
    },
  ]

  return (
    <section id="beneficios" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-tierra mb-4">
            ¿Qué gano yo con esto?
          </h2>
          <p className="text-xl text-tierra-light/70 max-w-3xl mx-auto">
            No es solo tecnología bonita. Son <span className="text-aguacate font-semibold">beneficios reales</span> para tu negocio.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {beneficios.map((beneficio, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + idx * 0.1 }}
              className="relative group"
            >
              <div className="bg-white rounded-2xl p-8 shadow-soft hover:shadow-warm transition-all duration-300 border border-aguacate-light/20 hover:border-aguacate-light h-full">
                <div className={`${beneficio.bg} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <beneficio.icon className={`w-8 h-8 ${beneficio.color}`} />
                </div>

                <h3 className="text-2xl font-display font-bold text-tierra mb-3">
                  {beneficio.titulo}
                </h3>

                <p className="text-tierra-light/70 leading-relaxed">
                  {beneficio.descripcion}
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
          <div className="bg-gradient-to-r from-aguacate-light/20 to-fresa-light/20 rounded-3xl p-8 border border-aguacate-light/30">
            <p className="text-2xl font-display font-bold text-tierra mb-4">
              Inversión que se paga sola
            </p>
            <p className="text-lg text-tierra-light/80 max-w-2xl mx-auto">
              En promedio, nuestros productores recuperan la inversión en <span className="text-aguacate font-semibold">2-3 embarques</span> gracias a mejores precios y menos rechazos.
            </p>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

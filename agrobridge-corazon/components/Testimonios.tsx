'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Star } from 'lucide-react'

export default function Testimonios() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  const testimonios = [
    {
      nombre: 'Don Roberto Sánchez',
      rol: 'Productor de aguacate, Uruapan',
      foto: '👨‍🌾',
      testimonio: 'Antes perdía embarques por falta de documentación. Ahora todo está en el QR. Mis clientes en Estados Unidos están felices porque saben exactamente de dónde viene el aguacate.',
      rating: 5,
    },
    {
      nombre: 'María Fernández',
      rol: 'Exportadora de fresas, Zamora',
      foto: '👩‍🌾',
      testimonio: 'Al principio pensé que iba a ser complicado. Pero es más fácil que WhatsApp. Y ahora vendo 25% más caro porque mis clientes confían en la trazabilidad.',
      rating: 5,
    },
    {
      nombre: 'Ing. Carlos Vega',
      rol: 'Cooperativa de 15 productores',
      foto: '👨‍💼',
      testimonio: 'Lo mejor es que ya no batallamos con los certificados en aduana. Todo está digitalizado y verificado. El inspector escanea el QR y listo.',
      rating: 5,
    },
  ]

  return (
    <section id="historias" ref={ref} className="py-24 bg-gradient-to-b from-aguacate-light/5 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-tierra mb-4">
            Lo que dicen nuestros compadres
          </h2>
          <p className="text-xl text-tierra-light/70 max-w-3xl mx-auto">
            Productores michoacanos que ya están usando AgroBridge todos los días
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonios.map((testimonio, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + idx * 0.1 }}
            >
              <div className="bg-white rounded-3xl p-8 shadow-soft hover:shadow-warm transition-all duration-300 border border-aguacate-light/20 h-full flex flex-col">
                
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonio.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-aguacate text-aguacate" />
                  ))}
                </div>

                <p className="text-tierra-light/80 leading-relaxed mb-6 flex-grow">
                  &quot;{testimonio.testimonio}&quot;
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-aguacate-light/20">
                  <div className="text-4xl">{testimonio.foto}</div>
                  <div>
                    <p className="font-display font-bold text-tierra">{testimonio.nombre}</p>
                    <p className="text-sm text-tierra-light/60">{testimonio.rol}</p>
                  </div>
                </div>
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
          <p className="text-lg text-tierra-light/70">
            <span className="text-aguacate font-semibold text-2xl">50+</span> productores ya confían en AgroBridge
          </p>
        </motion.div>

      </div>
    </section>
  )
}

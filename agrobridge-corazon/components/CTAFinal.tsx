'use client'

import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Phone, MessageCircle } from 'lucide-react'

export default function CTAFinal() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section id="contacto" ref={ref} className="py-24 bg-gradient-to-br from-aguacate via-aguacate-dark to-tierra relative overflow-hidden">   
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl">🥑</div>
        <div className="absolute bottom-10 right-10 text-8xl">🍓</div>
        <div className="absolute top-1/2 left-1/4 text-6xl">🌾</div>
        <div className="absolute top-1/4 right-1/4 text-6xl">✨</div>
      </div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
            ¿Listo para darle valor a tu cosecha?
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed">
            Platiquemos cómo AgroBridge puede ayudarte a vender mejor, más caro y con menos problemas.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.a
              href="https://wa.me/5214431234567"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group bg-white text-aguacate px-8 py-4 rounded-full text-lg font-semibold shadow-2xl hover:shadow-xl transition-all duration-200 flex items-center gap-3"
            >
              <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Platiquemos por WhatsApp
            </motion.a>
            <motion.a
              href="tel:+5214431234567"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/10 backdrop-blur-md text-white px-8 py-4 rounded-full text-lg font-semibold border-2 border-white/30 hover:bg-white/20 transition-all duration-200 flex items-center gap-3"
            >
              <Phone className="w-6 h-6" />
              O llámanos directo
            </motion.a>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20"
          >
            <span className="text-3xl">☕</span>
            <p className="text-white/90">
              Primera asesoría <span className="font-semibold">100% gratis</span>. Sin compromiso.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

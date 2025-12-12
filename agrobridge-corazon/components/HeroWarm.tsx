'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

interface FruitIcon {
  id: number;
  initialX: number;
  duration: number;
  delay: number;
  emoji: string;
}

export default function HeroWarm() {
  const [fruitIcons, setFruitIcons] = useState<FruitIcon[]>([]);

  useEffect(() => {
    // Esta lógica ahora solo se ejecuta en el cliente, después del primer render.
    setFruitIcons([...Array(12)].map((_, i) => ({
      id: i,
      initialX: Math.random() * 100, // Usar % para un mejor responsive
      duration: 15 + Math.random() * 10,
      delay: Math.random() * 5,
      emoji: i % 2 === 0 ? '🥑' : '🍓'
    })));
  }, []); // El array vacío asegura que el efecto se ejecute solo una vez.

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-cielo-light/30 via-white to-aguacate-light/10">
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {fruitIcons.map((fruit) => (
          <motion.div
            key={fruit.id}
            className="absolute text-4xl opacity-10"
            style={{ left: `${fruit.initialX}%` }}
            initial={{ y: -50 }}
            animate={{ 
              y: '100vh',
              rotate: 360,
            }}
            transition={{
              duration: fruit.duration,
              repeat: Infinity,
              delay: fruit.delay,
              ease: 'linear'
            }}
          >
            {fruit.emoji}
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 bg-aguacate-light/20 px-4 py-2 rounded-full mb-6 border border-aguacate-light/30"
            >
              <Sparkles className="w-4 h-4 text-aguacate" />
              <span className="text-sm font-medium text-aguacate-dark">
                Tecnología blockchain, pero fácil
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-tierra leading-tight mb-6"
            >
              Tu Aguacate
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-aguacate to-aguacate-dark">
                Cuenta su Historia
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-xl md:text-2xl text-tierra-light/80 mb-8 leading-relaxed"
            >
              Desde tu parcela en Michoacán hasta las mesas del mundo. 
              <span className="font-semibold text-aguacate"> Con un simple QR, </span>
              tus clientes sabrán exactamente de dónde viene cada fruto.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <motion.a
                href="#demo"
                whileHover={{ scale: 1.05, boxShadow: '0 20px 40px -10px rgba(86, 130, 3, 0.3)' }}
                whileTap={{ scale: 0.95 }}
                className="group bg-gradient-to-r from-aguacate to-aguacate-dark text-white px-8 py-4 rounded-full text-lg font-semibold shadow-warm hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                Ver cómo funciona
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>

              <motion.a
                href="#historias"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-aguacate px-8 py-4 rounded-full text-lg font-semibold border-2 border-aguacate-light hover:bg-aguacate-light/10 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Historias de productores
              </motion.a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-12 flex items-center gap-6 text-sm text-tierra-light/60"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-aguacate-light to-aguacate border-2 border-white" />
                ))}
              </div>
              <p>
                <span className="font-semibold text-aguacate">50+ productores</span> ya confían en nosotros
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-aguacate-light/20 to-fresa-light/20 rounded-full blur-3xl animate-pulse" />
              
              <div className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 border border-aguacate-light/30">
                <div className="text-center space-y-6">
                  <div className="text-8xl">🥑</div>
                  <div className="space-y-2">
                    <p className="text-sm text-tierra-light/60 font-medium">Lote #MX-AGC-2025</p>
                    <div className="h-2 bg-aguacate-light/20 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-aguacate to-aguacate-dark rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '75%' }}
                        transition={{ duration: 2, delay: 1 }}
                      />
                    </div>
                    <p className="text-xs text-aguacate font-semibold">En ruta a California ✈️</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

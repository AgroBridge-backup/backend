'use client'

import { useState } from 'react'
import { Menu, X, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-lg z-50 border-b border-aguacate-light/20 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          <motion.div 
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-aguacate to-aguacate-dark rounded-2xl flex items-center justify-center shadow-warm">
              <span className="text-2xl">🥑</span>
            </div>
            <div>
              <span className="text-2xl font-display font-bold text-tierra">AgroBridge</span>
              <p className="text-xs text-aguacate font-medium">Del campo al mundo</p>
            </div>
          </motion.div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#como-funciona" className="text-tierra-light hover:text-aguacate transition-colors duration-200 font-medium">
              ¿Cómo funciona?
            </a>
            <a href="#beneficios" className="text-tierra-light hover:text-aguacate transition-colors duration-200 font-medium">
              Beneficios
            </a>
            <a href="#historias" className="text-tierra-light hover:text-aguacate transition-colors duration-200 font-medium">
              Historias de Éxito
            </a>
            <motion.a 
              href="#contacto"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-aguacate to-aguacate-dark text-white px-6 py-3 rounded-full font-semibold shadow-warm hover:shadow-xl transition-all duration-200 flex items-center gap-2"
            >
              Platiquemos
              <Heart className="w-4 h-4" />
            </motion.a>
          </div>

          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-tierra p-2 rounded-xl hover:bg-aguacate-light/10 transition-colors"
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden bg-white border-t border-aguacate-light/20 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              <a href="#como-funciona" className="block py-3 px-4 text-tierra-light hover:bg-aguacate-light/10 rounded-xl transition">
                ¿Cómo funciona?
              </a>
              <a href="#beneficios" className="block py-3 px-4 text-tierra-light hover:bg-aguacate-light/10 rounded-xl transition">
                Beneficios
              </a>
              <a href="#historias" className="block py-3 px-4 text-tierra-light hover:bg-aguacate-light/10 rounded-xl transition">
                Historias de Éxito
              </a>
              <a href="#contacto" className="block py-3 px-4 bg-gradient-to-r from-aguacate to-aguacate-dark text-white text-center rounded-xl font-semibold">
                Platiquemos ☕
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

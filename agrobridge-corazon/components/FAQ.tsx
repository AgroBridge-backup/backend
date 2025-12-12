'use client'

import { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { ShieldCheck, Wallet, Sprout, ChevronDown, FileText, Smartphone } from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const faqItems = [
  {
    icon: ShieldCheck,
    question: '¿Cómo garantiza el Blockchain mi pago?',
    answer:
      'Utilizamos contratos inteligentes en la blockchain que actúan como un depósito de garantía digital. Los fondos se liberan automáticamente al productor una vez que el comprador confirma la recepción y calidad de la fruta, eliminando la necesidad de intermediarios y garantizando una transacción transparente y segura.',
  },
  {
    icon: Wallet,
    question: '¿Qué pasa si el comprador rechaza la fruta?',
    answer:
      'Nuestro protocolo incluye un sistema de disputas descentralizado. Inspectores certificados e independientes pueden verificar la calidad del producto. Si se determina que la fruta no cumple con los estándares acordados, el contrato inteligente puede ejecutar una devolución parcial o total al comprador, todo registrado de forma inmutable.',
  },
  {
    icon: Sprout,
    question: '¿Stripe retiene comisiones ocultas?',
    answer:
      'No. La transparencia es nuestro pilar. Stripe cobra una comisión estándar por procesamiento de tarjeta, la cual se te muestra de forma explícita antes de confirmar cualquier transacción. AgroBridge no añade cargos adicionales ocultos. Lo que ves, es lo que pagas.',
  },
  {
      icon: Smartphone,
      question: '¿Necesito equipo especial?',
      answer: 'No. AgroBridge está diseñado para funcionar en tu smartphone actual. No necesitas computadoras costosas ni sensores complejos para empezar. La seguridad del blockchain opera en la nube, tú solo necesitas conexión a internet.'
  },
  {
      icon: FileText,
      question: '¿Mis certificados SENASICA sirven aquí?',
      answer: 'Absolutamente. De hecho, AgroBridge digitaliza y valida tus certificados SENASICA y GlobalGAP, convirtiéndolos en un "Pasaporte Digital" para tu fruta que los compradores internacionales valoran y confían.'
  }
]

const AccordionItem = ({ item, isOpen, onClick }: { item: any, isOpen: boolean, onClick: () => void }) => {
  return (
    <motion.div
      layout
      initial={{ borderRadius: 12 }}
      className={twMerge(
        clsx(
          'p-6 transition-all duration-300 ease-in-out overflow-hidden',
          'bg-white/40 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-xl',
          isOpen ? 'bg-white/60 border-green-200/50' : ''
        )
      )}
    >
      <motion.header
        layout
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          <div className={clsx("p-2 rounded-full transition-colors duration-300", isOpen ? "bg-green-100 text-green-700" : "bg-white/50 text-gray-600")}>
            <item.icon className="w-6 h-6" />
          </div>
          <h3 className={clsx("text-lg font-semibold transition-colors duration-300", isOpen ? "text-green-900" : "text-gray-800")}>
            {item.question}
          </h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <ChevronDown className={clsx("w-6 h-6 transition-colors", isOpen ? "text-green-600" : "text-gray-400")} />
        </motion.div>
      </motion.header>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
          >
            <p className="text-gray-700 leading-relaxed pl-[3.5rem] pr-4 border-l-2 border-green-500/30">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-24 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-300/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-300/10 rounded-full blur-3xl -z-10"></div>

      <div className="container mx-auto px-4">
        <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-800 mb-4 tracking-tight">
            Respuestas Claras, <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600">Confianza Total</span>
            </h2>
            <p className="text-lg text-gray-600">
                Entendemos que la tecnología puede generar dudas. Aquí explicamos cómo AgroBridge protege tu trabajo y tu dinero.
            </p>
        </div>
        
        <LayoutGroup>
          <motion.div layout className="flex flex-col gap-4 max-w-3xl mx-auto">
            {faqItems.map((item, index) => (
              <AccordionItem
                key={index}
                item={item}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  )
}
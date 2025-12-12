'use client'

import Navbar from '../components/Navbar'
import HeroWarm from '../components/HeroWarm'
import TrustBar from '../components/TrustBar' // Nuevo
import Beneficios from '../components/Beneficios' // Reintroducido
import ComoFunciona from '../components/ComoFunciona' // Reintroducido
import PaymentVault from '../components/stripe/PaymentVault'
import Testimonios from '../components/Testimonios'
import RoiCalculator from '../components/RoiCalculator' // Nuevo
import Pricing from '../components/Pricing'
import FAQ from '../components/FAQ'
import CTAFinal from '../components/CTAFinal'
import Footer from '../components/Footer'
import { ShieldCheck, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="relative overflow-hidden min-h-screen bg-white font-sans text-gray-900">
      {/* Aurora Boreal Background (Global) */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vh] bg-green-200/30 rounded-full blur-[120px] opacity-60 mix-blend-multiply animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vh] bg-teal-200/30 rounded-full blur-[120px] opacity-60 mix-blend-multiply animate-pulse-slow delay-1000"></div>
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vh] bg-red-100/40 rounded-full blur-[100px] opacity-40 mix-blend-multiply animate-pulse-slow delay-2000"></div>
      </div>

      <Navbar />

      <main className="relative z-10">
        
        <HeroWarm />
        
        <TrustBar /> {/* Colocado justo debajo del Hero */}

        <Beneficios /> {/* Reintroducido */}
        
        <ComoFunciona /> {/* Reintroducido */}

        {/* Sección de Demostración de Pago (Secure Pay Showcase) */}
        <section className="py-32 relative">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
                    {/* Texto de Venta */}
                    <div className="flex-1 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-semibold mb-6">
                            <ShieldCheck className="w-4 h-4" />
                            Tecnología Zero-Trust
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Tu Dinero, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600">Blindado por Código.</span>
                        </h2>
                        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                            Olvídate de la incertidumbre de las transferencias internacionales. 
                            Nuestra bóveda de pagos utiliza encriptación bancaria y contratos inteligentes 
                            para asegurar que cada peso llegue a su destino sin intermediarios ocultos.
                        </p>
                        <ul className="space-y-4 text-left max-w-md mx-auto lg:mx-0">
                            <li className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <Zap className="w-4 h-4 text-green-600" />
                                </div>
                                <span className="text-gray-700">Procesamiento instantáneo con Stripe</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                    <ShieldCheck className="w-4 h-4 text-green-600" />
                                </div>
                                <span className="text-gray-700">Garantía anti-fraude por Blockchain</span>
                            </li>
                        </ul>
                    </div>

                    {/* Componente Interactivo */}
                    <div className="flex-1 w-full max-w-md relative">
                        {/* Decorative elements behind card */}
                        <div className="absolute -top-12 -right-12 w-24 h-24 bg-yellow-200 rounded-full blur-xl opacity-60 animate-bounce-slow"></div>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-green-200 rounded-full blur-xl opacity-60 animate-bounce-slow delay-700"></div>
                        
                        <PaymentVault />
                    </div>
                </div>
            </div>
        </section>

        <Testimonios />
        
        <RoiCalculator /> {/* Colocado antes de Pricing */}

        <Pricing />
        
        <FAQ />
        
        <CTAFinal />

      </main>
      
      <Footer />
    </div>
  )
}
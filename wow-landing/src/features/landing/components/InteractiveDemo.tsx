import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, QrCode, Shield, Link, CheckCircle } from 'lucide-react';
import { GlowButton } from '@shared/components/ui/GlowButton';

const steps = [
  { id: 1, icon: QrCode, label: 'Escanear QR', description: 'Escanea el código del producto' },
  { id: 2, icon: Shield, label: 'Verificar', description: 'Verificación en tiempo real' },
  { id: 3, icon: Link, label: 'Blockchain', description: 'Consulta en blockchain' },
  { id: 4, icon: CheckCircle, label: 'Confirmado', description: 'Producto autenticado' },
];

export function InteractiveDemo() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          setIsActive(false);
          return 0;
        }
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  const handleStart = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  return (
    <section className="py-24 bg-gradient-to-b from-surface-elevated to-surface-base relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(5,150,105,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(5,150,105,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Prueba la <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">Verificación</span> en Vivo
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Simula cómo funciona la verificación instantánea de productos con blockchain
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Phone Mockup */}
          <div className="relative flex justify-center">
            <div className="relative w-72 h-[600px]">
              {/* Phone frame */}
              <div className="absolute inset-0 bg-gradient-to-br from-surface-elevated to-surface-overlay rounded-[3rem] border-8 border-surface-border shadow-2xl">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-surface-base rounded-b-2xl" />

                {/* Screen */}
                <div className="absolute inset-4 bg-surface-base rounded-[2.2rem] overflow-hidden">
                  <AnimatePresence mode="wait">
                    {isActive ? (
                      <motion.div
                        key="scanning"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full flex flex-col items-center justify-center p-6"
                      >
                        {/* Scanner animation */}
                        <div className="relative w-48 h-48 mb-6">
                          <div className="absolute inset-0 border-4 border-primary-500/30 rounded-2xl" />
                          <motion.div
                            className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent"
                            animate={{ y: [0, 192, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          />
                          <QrCode className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 text-white/20" />
                        </div>
                        <p className="text-white text-lg font-semibold">{steps[currentStep].label}</p>
                        <p className="text-gray-400 text-sm">{steps[currentStep].description}</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full flex flex-col items-center justify-center p-6"
                      >
                        <Smartphone className="w-24 h-24 text-primary-500 mb-4" />
                        <p className="text-white text-lg font-semibold mb-2">Escáner QR</p>
                        <p className="text-gray-400 text-sm text-center">Toca "Iniciar Demo" para comenzar</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = isActive && index < currentStep;
              const isCurrent = isActive && index === currentStep;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    isCurrent
                      ? 'bg-primary-500/10 border-primary-500/50 shadow-glow-sm'
                      : isCompleted
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-surface-elevated border-surface-border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isCurrent ? 'bg-primary-600 animate-pulse' : isCompleted ? 'bg-green-600' : 'bg-surface-overlay'
                    }`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold">{step.label}</h3>
                      <p className="text-gray-400 text-sm">{step.description}</p>
                    </div>
                    {isCompleted && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                  </div>
                </motion.div>
              );
            })}

            <div className="pt-4">
              <GlowButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleStart}
                disabled={isActive}
              >
                {isActive ? 'Verificando...' : 'Iniciar Demo'}
              </GlowButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

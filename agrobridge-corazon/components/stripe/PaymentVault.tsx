'use client'

import { useState } from 'react'
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { motion } from 'framer-motion'
import { Lock, Loader } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

// Asegúrate de cargar tu clave pública de Stripe de forma segura
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: 'Inter, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
  classes: {
    base: 'p-4 border rounded-lg',
    focus: 'ring-2 ring-green-500',
    invalid: 'border-red-500',
  }
}

const PaymentForm = () => {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    const cardElement = elements.getElement(CardElement)

    if (cardElement == null) {
      return;
    }

    // Aquí es donde llamarías a tu backend para crear un PaymentIntent
    // y obtener el clientSecret. Por ahora, simularemos el proceso.
    // const { clientSecret } = await fetch('/api/create-payment-intent', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
        // body: JSON.stringify({ amount: 1000 }), // Monto en centavos
    // }).then(r => r.json())

    // const { error, paymentIntent } = await stripe.confirmCardPayment(
    //   clientSecret,
    //   {
    //     payment_method: { card: cardElement },
    //   }
    // )
    
    // Simulación de la llamada a la API
    const error = null; // Simula una respuesta exitosa

    setIsLoading(false)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setIsSuccess(true)
      // Lógica post-pago exitoso (ej. mostrar confirmación)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-6 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl">
        <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-2">
          Detalles de la Tarjeta de Crédito
        </label>
        <CardElement id="card-element" options={CARD_ELEMENT_OPTIONS} />
      </div>

      <motion.button
        type="submit"
        disabled={!stripe || isLoading || isSuccess}
        className={twMerge(clsx(
          'w-full flex items-center justify-center gap-2 px-6 py-4 text-lg font-bold text-white rounded-xl transition-all duration-300',
          'focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-700',
          {
            'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 shadow-lg': !isLoading && !isSuccess,
            'bg-gray-400 cursor-not-allowed': isLoading || isSuccess,
          }
        ))}
        whileHover={{ scale: !isLoading && !isSuccess ? 1.03 : 1 }}
        whileTap={{ scale: !isLoading && !isSuccess ? 0.98 : 1 }}
      >
        {isLoading ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader className="w-6 h-6" />
          </motion.div>
        ) : isSuccess ? (
          'Transacción Blindada'
        ) : (
          <>
            <Lock className="w-5 h-5" />
            Blindar Transacción
          </>
        )}
      </motion.button>

      {errorMessage && <div className="text-red-500 text-sm text-center">{errorMessage}</div>}
      {isSuccess && <div className="text-green-500 text-sm text-center">¡Pago completado con éxito!</div>}

      <div className="flex items-center justify-center gap-6 pt-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <img src="https://js.stripe.com/v3/fingerprinted/img/stripe-logo-blurple.4662f915a36811636e3515338353bT3c.svg" alt="Stripe" className="h-4" />
          <span>Encrypted by Stripe</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Lock className="w-3 h-3" />
          <span>256-bit SSL</span>
        </div>
      </div>
    </form>
  )
}

export default function PaymentVault() {
  return (
    <div className="max-w-md mx-auto">
      <Elements stripe={stripePromise}>
        <PaymentForm />
      </Elements>
    </div>
  )
}
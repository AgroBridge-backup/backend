import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
})

const poppins = Poppins({ 
  weight: ['600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'AgroBridge | Tu Aguacate Cuenta su Historia',
  description: 'Cada fruta tiene una historia. Nosotros te ayudamos a contarla con tecnología blockchain sencilla y confiable.',
  keywords: ['aguacate', 'fresa', 'blockchain fácil', 'exportación', 'Michoacán', 'trazabilidad simple'],
  openGraph: {
    title: 'AgroBridge - Del Campo al Mundo con Confianza',
    description: 'Tecnología blockchain tan fácil como escanear un QR',
    images: ['/og-image.jpg'],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${poppins.variable}`}>
      <body className={`${inter.className} antialiased bg-gradient-to-b from-cielo-light/20 to-white`}>
        {children}
      </body>
    </html>
  )
}
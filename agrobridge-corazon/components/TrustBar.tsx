
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Image from 'next/image'

interface Logo {
  name: string;
  src: string;
  alt: string;
}

const logos: Logo[] = [
  { name: 'SENASICA', src: 'https://placehold.co/100x40/ffffff/000000?text=SENASICA', alt: 'Logo SENASICA' },
  { name: 'GlobalGAP', src: 'https://placehold.co/100x40/ffffff/000000?text=GlobalGAP', alt: 'Logo GlobalGAP' },
  { name: 'USDA Organic', src: 'https://placehold.co/100x40/ffffff/000000?text=USDA+Organic', alt: 'Logo USDA Organic' },
  { name: 'FDA', src: 'https://placehold.co/100x40/ffffff/000000?text=FDA', alt: 'Logo FDA' },
  { name: 'Rainforest Alliance', src: 'https://placehold.co/100x40/ffffff/000000?text=Rainforest+Alliance', alt: 'Logo Rainforest Alliance' },
]

const MarqueeItem = ({ logo }: { logo: Logo }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="flex-shrink-0 mx-8"
    >
      <Image 
        src={logo.src} 
        alt={logo.alt} 
        width={100} 
        height={40} 
        className={clsx(
          "h-10 object-contain transition-all duration-300",
          isHovered ? "grayscale-0 opacity-100" : "grayscale opacity-70"
        )} 
      />
    </motion.div>
  )
}

export default function TrustBar() {
  return (
    <section className="py-8 bg-white/60 backdrop-blur-lg border-t border-b border-white/80 shadow-inner relative overflow-hidden">
      <div className="container mx-auto px-4 text-center mb-6">
        <p className="text-lg font-semibold text-gray-700">
          Plataforma compatible con estándares globales
        </p>
      </div>
      <div className="relative flex overflow-hidden h-16">
        <motion.div
          className="flex"
          animate={{ x: ['0%', '-100%'] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 20,
              ease: 'linear',
            },
          }}
        >
          {[...logos, ...logos].map((logo, index) => ( // Duplicate logos for seamless loop
            <MarqueeItem key={index} logo={logo} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

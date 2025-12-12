
'use client'

import { motion } from 'framer-motion'

export default function LoteCardSkeleton() {
  return (
    <div className="relative p-6 rounded-2xl border border-white/20 bg-white/40 backdrop-blur-lg shadow-lg overflow-hidden">
      <div className="animate-pulse">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 w-3/5 bg-gray-300/50 rounded"></div>
          <div className="h-5 w-1/4 bg-gray-300/50 rounded-full"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-4/5 bg-gray-300/50 rounded"></div>
          <div className="h-4 w-3/5 bg-gray-300/50 rounded"></div>
          <div className="h-4 w-1/2 bg-gray-300/50 rounded"></div>
        </div>
        <div className="mt-6 pt-4 border-t border-white/30">
          <div className="h-3 w-full bg-gray-300/50 rounded"></div>
        </div>
      </div>
      {/* Shimmer Effect */}
      <div className="absolute top-0 left-0 w-full h-full">
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
      </div>
    </div>
  )
}

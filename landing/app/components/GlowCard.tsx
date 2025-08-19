'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface GlowCardProps {
  children: ReactNode
  className?: string
  delay?: number
  gradient?: string
}

export function GlowCard({ children, className, delay = 0, gradient = "from-primary via-secondary to-accent-green" }: GlowCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn("relative group", className)}
    >
      {/* Animated gradient border */}
      <div className="absolute -inset-0.5 bg-gradient-to-r opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-glow rounded-xl blur-sm"
        style={{
          background: `linear-gradient(135deg, #00D9FF, #7C3AED, #10B981, #00D9FF)`,
          backgroundSize: '400% 400%',
          animation: 'gradient-shift 3s ease infinite'
        }}
      />
      
      {/* Glass card content */}
      <div className="relative glass-dark rounded-xl p-6 h-full hover-card">
        {children}
      </div>
    </motion.div>
  )
}
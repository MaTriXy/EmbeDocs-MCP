'use client'

import { motion } from 'framer-motion'
import { TypeAnimation } from 'react-type-animation'
import { useState } from 'react'
import React from 'react'

interface TerminalProps {
  title?: string
  commands: Array<{
    input: string
    output: string | React.ReactNode
    delay?: number
  }>
  className?: string
}

export function Terminal({ title = "Terminal", commands, className }: TerminalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  return (
    <div className={`terminal ${className}`}>
      <div className="terminal-header flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="terminal-dot red" />
          <span className="terminal-dot yellow" />
          <span className="terminal-dot green" />
        </div>
        <span className="text-gray-400 text-sm font-mono">{title}</span>
        <div className="w-16" />
      </div>
      
      <div className="p-4 font-mono text-sm space-y-3">
        {commands.slice(0, currentIndex + 1).map((cmd, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.5 }}
          >
            <div className="flex items-start space-x-2">
              <span className="text-accent-green">$</span>
              <div className="flex-1">
                {idx === currentIndex ? (
                  <TypeAnimation
                    sequence={[
                      cmd.input,
                      1000,
                      () => {
                        if (idx < commands.length - 1) {
                          setCurrentIndex(idx + 1)
                        }
                      }
                    ]}
                    wrapper="span"
                    speed={50}
                    className="text-white"
                    cursor={true}
                  />
                ) : (
                  <span className="text-white">{cmd.input}</span>
                )}
              </div>
            </div>
            
            {idx < currentIndex && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-2 ml-4 text-gray-400"
              >
                {cmd.output}
              </motion.div>
            )}
          </motion.div>
        ))}
        
        {currentIndex >= commands.length - 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-2 ml-4"
          >
            {commands[commands.length - 1].output}
          </motion.div>
        )}
        
        <span className="inline-block w-2 h-4 bg-primary animate-terminal-cursor" />
      </div>
    </div>
  )
}
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import React from 'react'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'Embedocs - AI That Actually Knows Your Docs',
  description: 'Upgrade from keyword search to semantic understanding. Give your AI documentation search that understands meaning, not just matching words.',
  keywords: ['AI', 'documentation', 'semantic search', 'MCP', 'MongoDB', 'vector search', 'embeddings', 'developer tools'],
  authors: [{ name: 'Rom Iluz' }],
  metadataBase: new URL('https://embedocs.ai'),
  openGraph: {
    title: 'Embedocs - AI That Actually Knows Your Docs',
    description: 'Transform any GitHub repository into searchable vector embeddings. Give your AI current, accurate documentation knowledge in minutes.',
    type: 'website',
    locale: 'en_US',
    url: 'https://embedocs.ai',
    siteName: 'Embedocs',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Embedocs - AI powered documentation search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Embedocs - AI That Actually Knows Your Docs',
    description: 'Stop fighting outdated AI knowledge. Index the latest docs and give your AI current information.',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-dark text-white`}>
        <div className="animated-gradient-bg min-h-screen">
          <div className="grid-pattern fixed inset-0 opacity-20" />
          {children}
        </div>
      </body>
    </html>
  )
}
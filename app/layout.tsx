import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AppProvider } from './providers'
import Topbar from './components/Topbar'
import ContextBar from './components/ContextBar'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'SMT Developer — Plataforma de Análisis Inmobiliario',
  description: 'Prospección, análisis y propuesta de proyectos inmobiliarios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <AppProvider>
          <Topbar />
          <ContextBar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </AppProvider>
      </body>
    </html>
  )
}

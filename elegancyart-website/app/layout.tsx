// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ElegancyArt - AI-Powered Dropshipping',
  description: 'Luxury art and home decor curated by AI, powered by Supabase and BossMind',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-lg font-semibold mb-2">ElegancyArt</p>
            <p className="text-gray-400 mb-4">AI-Powered Luxury Dropshipping Platform</p>
            <div className="flex justify-center space-x-6 text-sm text-gray-400">
              <div>
                <p className="font-medium">Powered By</p>
                <p>Supabase • Next.js • BossMind</p>
              </div>
              <div>
                <p className="font-medium">Database</p>
                <p>Live Products: 3 • Categories: 5</p>
              </div>
              <div>
                <p className="font-medium">Status</p>
                <p className="text-green-400">● Connected</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
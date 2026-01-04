// app/page.tsx
import ProductGrid from '@/components/ProductGrid'
import Hero from '@/components/Hero'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Hero />
      <ProductGrid />
    </main>
  )
}
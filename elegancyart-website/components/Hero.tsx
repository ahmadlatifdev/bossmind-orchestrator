// components/Hero.tsx
export default function Hero() {
  return (
    <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16 px-4">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-5xl font-bold mb-4">
          ElegancyArt
        </h1>
        <p className="text-xl mb-8 opacity-90">
          AI-Powered Luxury Dropshipping Platform
        </p>
        <p className="text-lg max-w-2xl mx-auto mb-10 opacity-80">
          Discover unique art pieces and home decor curated by AI. 
          Each product dropshipped with premium quality and fast delivery.
        </p>
        <div className="flex justify-center gap-4">
          <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
            Shop Collection
          </button>
          <button className="border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition">
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}
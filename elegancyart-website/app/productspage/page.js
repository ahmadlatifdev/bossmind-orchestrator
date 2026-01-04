// app/products/page.js - SERVER COMPONENT
export const dynamic = 'force-dynamic';

const SUPABASE_URL = 'https://thyfcodrqqwjvqdrhnex.supabase.co';
const ANON_KEY = 'sb_publishable_Rgpt00AV1Nl-tFBMNwTi6A_gBJJpCtU';

async function getProducts() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Import CLIENT components
import ProductCard from './ProductCard';
import CartDisplay from './CartDisplay';
import { CartProvider } from './CartContext';
import FilterBar from './FilterBar';

export default async function ProductsPage() {
  const products = await getProducts();
  
  // Extract unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <CartProvider>
      <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', position: 'relative' }}>
        {/* Cart Display (floating) */}
        <CartDisplay />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Elegant Art Collection</h1>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              {products.length} premium art pieces • Free shipping over $100
            </p>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0070f3' }}>
            ${products.reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} total value
          </div>
        </div>
        
        {/* Filter Bar */}
        <FilterBar categories={categories} totalProducts={products.length} />
        
        {/* Products Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        
        {/* Connection Status */}
        <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '12px', border: '1px solid #dee2e6' }}>
          <h4 style={{ marginTop: 0, color: '#28a745' }}>✅ Live Connection Status</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Supabase URL</div>
              <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{SUPABASE_URL}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Products Synced</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#0070f3' }}>{products.length} items</div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </CartProvider>
  );
}
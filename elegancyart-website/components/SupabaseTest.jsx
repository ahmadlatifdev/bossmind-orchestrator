// components/SupabaseTest.jsx
'use client';

import { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://thyfcodngwjvqdrhnex.supabase.co';
const ANON_KEY = 'sb_publishable_leM9GvJh8FUqN6Ory9NkTw_RVMy6Y75';

export default function SupabaseTest() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading products...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <h3>Products from Supabase ({products.length})</h3>
      <button onClick={fetchProducts} style={{ marginBottom: '1rem' }}>
        Refresh Products
      </button>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <strong>{product.name}</strong>
            {product.price && ` - $${product.price}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
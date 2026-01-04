// app/productspage/ProductCard.jsx - CLIENT COMPONENT
'use client';

import { useCart } from './CartContext';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(product);
    alert(`Added to cart: ${product.name}\nPrice: $${product.price}`);
  };

  return (
    <div 
      style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '1rem',
        backgroundColor: '#f9f9f9'
      }}
    >
      <h3 style={{ marginTop: 0 }}>{product.name}</h3>
      {product.description && <p>{product.description}</p>}
      {product.price && <p style={{ fontWeight: 'bold', color: '#0070f3' }}>${product.price}</p>}
      {product.category && (
        <span style={{ 
          display: 'inline-block', 
          backgroundColor: '#e0e0e0', 
          padding: '0.2rem 0.5rem', 
          borderRadius: '4px',
          fontSize: '0.8rem',
          marginBottom: '0.5rem'
        }}>
          {product.category}
        </span>
      )}
      
      <button 
        style={{
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          padding: '0.5rem 1rem',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '0.5rem',
          width: '100%',
          fontSize: '0.9rem'
        }}
        onClick={handleAddToCart}
      >
        🛒 Add to Cart
      </button>
    </div>
  );
}
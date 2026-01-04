// app/productspage/CartDisplay.jsx
'use client';

import { useCart } from './CartContext';
import { useRouter } from 'next/navigation';

export default function CartDisplay() {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, cartCount } = useCart();
  const router = useRouter();

  const handleCheckout = () => {
    if (cartCount === 0) {
      alert('Your cart is empty! Add some products first.');
      return;
    }
    router.push('/checkout');
  };

  if (cartCount === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        minWidth: '320px',
        zIndex: 1000,
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>🛒</div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Shopping Cart (0)</h3>
        </div>
        <p style={{ color: '#666', textAlign: 'center', padding: '1rem 0' }}>Your cart is empty</p>
        <p style={{ fontSize: '0.9rem', color: '#888', textAlign: 'center' }}>
          Add items from the collection below
        </p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      minWidth: '320px',
      maxHeight: '500px',
      overflowY: 'auto',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '1.5rem' }}>🛒</div>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Shopping Cart ({cartCount})</h3>
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        {cartItems.map(item => (
          <div key={item.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 0',
            borderBottom: '1px solid #eee'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                ${item.price.toFixed(2)} × {item.quantity} = ${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                style={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  minWidth: '28px'
                }}
                title="Decrease quantity"
              >
                −
              </button>
              
              <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
              
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                style={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  minWidth: '28px'
                }}
                title="Increase quantity"
              >
                +
              </button>
              
              <button
                onClick={() => removeFromCart(item.id)}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  marginLeft: '0.5rem',
                  minWidth: '28px'
                }}
                title="Remove item"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '2px solid #0070f3',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '1.1rem'
      }}>
        <span>Total:</span>
        <span>${getCartTotal().toFixed(2)}</span>
      </div>
      
      <button
        style={{
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer',
          marginTop: '1.5rem',
          width: '100%',
          fontSize: '1rem',
          fontWeight: 'bold',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
        onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
        onClick={handleCheckout}
      >
        🛍️ Proceed to Checkout
      </button>
      
      <div style={{
        marginTop: '1rem',
        fontSize: '0.8rem',
        color: '#888',
        textAlign: 'center'
      }}>
        Free shipping on orders over $100
      </div>
    </div>
  );
}
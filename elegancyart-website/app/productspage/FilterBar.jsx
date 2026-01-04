// app/productspage/FilterBar.jsx
'use client';

import { useState } from 'react';

export default function FilterBar({ categories, totalProducts }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [priceRange, setPriceRange] = useState([0, 500]);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    // In a real app, this would filter the products
    alert(`Filtering by: ${category === 'all' ? 'All Categories' : category}\n\nThis would filter ${totalProducts} products`);
  };

  const handleSortChange = (sortType) => {
    setSortBy(sortType);
    alert(`Sorting by: ${
      sortType === 'price-low' ? 'Price: Low to High' :
      sortType === 'price-high' ? 'Price: High to Low' :
      sortType === 'name' ? 'Name: A to Z' :
      'Default'
    }`);
  };

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #dee2e6',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Filter & Sort</h3>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Showing <strong>{totalProducts}</strong> products
        </div>
      </div>

      {/* Category Filters */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Categories
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => handleCategoryChange('all')}
            style={{
              backgroundColor: selectedCategory === 'all' ? '#0070f3' : '#f8f9fa',
              color: selectedCategory === 'all' ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '20px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (selectedCategory !== 'all') e.target.style.backgroundColor = '#e9ecef';
            }}
            onMouseOut={(e) => {
              if (selectedCategory !== 'all') e.target.style.backgroundColor = '#f8f9fa';
            }}
          >
            All ({totalProducts})
          </button>
          
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              style={{
                backgroundColor: selectedCategory === category ? '#0070f3' : '#f8f9fa',
                color: selectedCategory === category ? 'white' : '#333',
                border: '1px solid #dee2e6',
                borderRadius: '20px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (selectedCategory !== category) e.target.style.backgroundColor = '#e9ecef';
              }}
              onMouseOut={(e) => {
                if (selectedCategory !== category) e.target.style.backgroundColor = '#f8f9fa';
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Options */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Sort By
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { value: 'default', label: 'Default' },
            { value: 'price-low', label: 'Price: Low to High' },
            { value: 'price-high', label: 'Price: High to Low' },
            { value: 'name', label: 'Name: A to Z' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => handleSortChange(option.value)}
              style={{
                backgroundColor: sortBy === option.value ? '#28a745' : '#f8f9fa',
                color: sortBy === option.value ? 'white' : '#333',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (sortBy !== option.value) e.target.style.backgroundColor = '#e9ecef';
              }}
              onMouseOut={(e) => {
                if (sortBy !== option.value) e.target.style.backgroundColor = '#f8f9fa';
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range (Visual only - would filter in real app) */}
      <div>
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Price Range: <span style={{ color: '#0070f3' }}>${priceRange[0]} - ${priceRange[1]}+</span>
        </div>
        <div style={{ padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '0.9rem', color: '#666' }}>
          💡 Price filtering would work here. Currently showing all price ranges.
        </div>
      </div>

      {/* Active Filters Display */}
      {(selectedCategory !== 'all' || sortBy !== 'default') && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          border: '1px solid #c3e6cb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>Active filters:</span>
            {selectedCategory !== 'all' && (
              <span style={{ marginLeft: '0.5rem', backgroundColor: '#d4edda', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                Category: {selectedCategory}
              </span>
            )}
            {sortBy !== 'default' && (
              <span style={{ marginLeft: '0.5rem', backgroundColor: '#d4edda', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                Sort: {sortBy === 'price-low' ? 'Price Low to High' : 
                       sortBy === 'price-high' ? 'Price High to Low' : 'Name A to Z'}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSortBy('default');
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #28a745',
              color: '#28a745',
              borderRadius: '4px',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
// add-sample-data.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('📝 ADDING SAMPLE DATA');
console.log('=' .repeat(60));

const addData = async () => {
  try {
    const secretsData = await fs.readFile('bossmind-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    const supabase = createClient(project.url, project.service_role_key);
    
    console.log('Adding sample categories...');
    
    // Add categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .upsert([
        { name: 'Wall Art', slug: 'wall-art', description: 'Beautiful wall decorations' },
        { name: 'Home Decor', slug: 'home-decor', description: 'Home decoration items' },
        { name: 'Personalized Gifts', slug: 'personalized-gifts', description: 'Customized gift items' },
        { name: 'Modern Art', slug: 'modern-art', description: 'Contemporary art pieces' },
        { name: 'Vintage Style', slug: 'vintage-style', description: 'Retro and vintage items' }
      ])
      .select();
    
    if (catError) throw catError;
    console.log(`✅ Added ${categories.length} categories`);
    
    console.log('\nAdding sample products...');
    
    // Add products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .upsert([
        {
          name: 'Abstract Canvas Painting',
          description: 'Modern abstract art canvas for living room decoration',
          price: 89.99,
          category: 'Wall Art',
          profit_margin: 40.00,
          tags: ['wall-art', 'modern', 'abstract', 'home-decor'],
          image_url: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262',
          supplier_url: 'https://example.com/product1'
        },
        {
          name: 'Personalized Family Name Sign',
          description: 'Wooden family name sign with custom engraving',
          price: 49.99,
          category: 'Personalized Gifts',
          profit_margin: 50.00,
          tags: ['personalized', 'wood', 'gift', 'home'],
          image_url: 'https://images.unsplash.com/photo-1503602642458-232111445657',
          supplier_url: 'https://example.com/product2'
        },
        {
          name: 'Modern Metal Wall Sculpture',
          description: 'Geometric metal sculpture for office or home',
          price: 129.99,
          category: 'Modern Art',
          profit_margin: 45.00,
          tags: ['modern', 'metal', 'sculpture', 'office'],
          image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574',
          supplier_url: 'https://example.com/product3'
        }
      ])
      .select();
    
    if (prodError) throw prodError;
    console.log(`✅ Added ${products.length} products`);
    
    console.log('\nAdding sample order...');
    
    // Add sample order
    const { error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_email: 'sample@example.com',
        customer_name: 'John Doe',
        status: 'completed',
        total_amount: 89.99,
        items: [
          { product_id: products[0].id, name: products[0].name, quantity: 1, price: products[0].price }
        ],
        shipping_address: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA'
        }
      }]);
    
    if (orderError) throw orderError;
    console.log('✅ Added sample order');
    
    console.log('\nAdding system log...');
    
    // Add system log
    const { error: logError } = await supabase
      .from('system_logs')
      .insert([{
        level: 'info',
        message: 'Sample data populated by BossMind',
        source: 'bossmind',
        metadata: { 
          products_added: products.length, 
          categories_added: categories.length 
        }
      }]);
    
    if (logError) throw logError;
    console.log('✅ Added system log');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 SAMPLE DATA ADDED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    
    // Show summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Orders: 1`);
    console.log(`   System Logs: 1`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to add sample data:', error.message);
    return false;
  }
};

addData();
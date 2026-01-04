// test-insert.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('🔍 TESTING BASIC INSERT');
console.log('=' .repeat(60));

const testInsert = async () => {
  try {
    const secretsData = await fs.readFile('bossmind-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    console.log('URL:', project.url);
    console.log('Service key (first 20 chars):', project.service_role_key.substring(0, 20));
    
    const supabase = createClient(project.url, project.service_role_key);
    
    // Test 1: Simple insert
    console.log('\nTest 1: Inserting test category...');
    
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description'
      }])
      .select();
    
    if (error) {
      console.log('❌ Insert error:', error);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);
      console.log('Error details:', error.details);
    } else {
      console.log('✅ Insert successful!');
      console.log('Inserted data:', data);
    }
    
    // Test 2: Try to read existing data
    console.log('\nTest 2: Reading existing categories...');
    
    const { data: existingData, error: readError } = await supabase
      .from('categories')
      .select('*')
      .limit(5);
    
    if (readError) {
      console.log('❌ Read error:', readError.message);
    } else {
      console.log(`✅ Found ${existingData.length} existing categories`);
      console.log('Categories:', existingData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

testInsert();
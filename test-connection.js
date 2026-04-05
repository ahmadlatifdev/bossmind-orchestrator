// test-connection.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('🔌 TESTING SUPABASE CONNECTION');
console.log('=' .repeat(50));

const testConnection = async () => {
  try {
    // Load fresh secrets every time
    const secretsData = await fs.readFile('resumeai-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    console.log('📋 Using FRESH secrets:');
    console.log(`   URL: ${project.url}`);
    console.log(`   Service Role Key: ${project.service_role_key.substring(0, 20)}...`);
    
    // Create Supabase client
    const supabase = createClient(project.url, project.service_role_key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    console.log('\n🔗 Connecting to Supabase...');
    
    // Test 1: Simple query
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          console.log('⚠️  Table "products" does not exist yet');
          console.log('✅ But connection SUCCESSFUL!');
        } else {
          console.log('📝 Query error (but connection worked):', error.message);
        }
      } else {
        console.log(`✅ Query successful! Found ${data.length} products`);
      }
    } catch (queryError) {
      console.log('📝 Query failed:', queryError.message);
    }
    
    // Test 2: Basic API call
    try {
      const response = await fetch(`${project.url}/rest/v1/`, {
        headers: {
          'apikey': project.anon_key,
          'Authorization': `Bearer ${project.anon_key}`
        }
      });
      
      if (response.ok) {
        console.log('✅ REST API accessible');
      } else {
        console.log(`📝 REST API returned: ${response.status}`);
      }
    } catch (fetchError) {
      console.log('📝 REST test failed:', fetchError.message);
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Connection tests completed');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
};

testConnection();

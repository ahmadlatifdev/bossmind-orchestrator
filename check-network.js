// check-network.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('🌐 NETWORK DIAGNOSIS');
console.log('=' .repeat(50));

const diagnose = async () => {
  try {
    const secretsData = await fs.readFile('bossmind-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    console.log('📋 Project URL:', project.url);
    
    // Test 1: Can we resolve the DNS?
    console.log('\1️⃣ Testing DNS resolution...');
    try {
      const dns = await import('dns/promises');
      const addresses = await dns.resolve4('thyfoodrqaviyqdrhnex.supabase.co');
      console.log('   ✅ DNS resolves to:', addresses[0]);
    } catch (dnsError) {
      console.log('   ❌ DNS error:', dnsError.message);
    }
    
    // Test 2: Simple fetch test
    console.log('\n2️⃣ Testing fetch to Supabase...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(project.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'BossMind-Test' }
      });
      clearTimeout(timeout);
      
      console.log('   ✅ Fetch successful:', response.status, response.statusText);
    } catch (fetchError) {
      console.log('   ❌ Fetch failed:', fetchError.message);
      console.log('   💡 This is a NETWORK issue, not a code issue');
    }
    
    // Test 3: Check if URL works in different ways
    console.log('\n3️⃣ Alternative URL tests...');
    const testURLs = [
      project.url,
      project.url + '/rest/v1/',
      'https://api.supabase.com'
    ];
    
    for (const url of testURLs) {
      try {
        const response = await fetch(url, { timeout: 3000 });
        console.log(`   ${url}: ${response.status}`);
      } catch (error) {
        console.log(`   ${url}: ❌ ${error.message}`);
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('🔧 POSSIBLE SOLUTIONS:');
    console.log('1. Check your internet connection');
    console.log('2. Disable VPN/firewall temporarily');
    console.log('3. Try: node --dns-result-order=ipv4first test-connection.js');
    console.log('4. Visit the URL in browser: ' + project.url);
    
  } catch (error) {
    console.error('Diagnosis failed:', error);
  }
};

diagnose();
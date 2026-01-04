// test-url.js
import { createClient } from '@supabase/supabase-js';

const testURL = async () => {
  const urlsToTest = [
    'https://thyfoodquiydrhnex.supabase.co',
    'https://thyfoodqqwiydrhnex.supabase.co',
    'https://thyfoodqqwuiydrhnex.supabase.co',
    'https://thyfoodqqwiydrhnex-supabase.co'
  ];
  
  for (const url of urlsToTest) {
    console.log(`\nTesting: ${url}`);
    try {
      const supabase = createClient(url, 'test-key');
      console.log('   ✅ URL format valid');
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
};

testURL();
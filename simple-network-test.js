// simple-network-test.js
import fs from 'fs/promises';

console.log('🌐 SIMPLE NETWORK TEST');
console.log('=' .repeat(50));

const test = async () => {
  try {
    const secretsData = await fs.readFile('resumeai-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const url = secrets.supabase_projects['elegancyart-ai'].url;
    
    console.log('Testing URL:', url);
    
    // Try to fetch with simple timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      console.log('⏰ Timeout after 5 seconds');
    }, 5000);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);
      
      console.log('✅ SUCCESS! Status:', response.status);
      console.log('✅ ResumeAI CAN reach Supabase');
      
    } catch (fetchError) {
      console.log('❌ FETCH ERROR:', fetchError.message);
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('1. Open browser and visit:', url);
      console.log('2. Check if you have internet');
      console.log('3. Try: node --dns-result-order=ipv4first test-connection.js');
      console.log('4. The project might be paused in Supabase');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

test();

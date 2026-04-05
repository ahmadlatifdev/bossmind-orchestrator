// bypass-test.js
import https from 'https';
import fs from 'fs/promises';

console.log('🔄 TRYING ALTERNATIVE CONNECTION');
console.log('=' .repeat(50));

const testWithHttps = async () => {
  try {
    const secretsData = await fs.readFile('resumeai-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    console.log('URL:', project.url);
    
    // Remove https:// prefix
    const hostname = project.url.replace('https://', '');
    
    const options = {
      hostname: hostname,
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'ResumeAI',
        'Accept': 'application/json'
      }
    };
    
    console.log('\nTrying direct HTTPS connection...');
    
    const req = https.request(options, (res) => {
      console.log('✅ CONNECTED! Status:', res.statusCode);
      console.log('✅ Headers:', JSON.stringify(res.headers));
      
      res.on('data', (chunk) => {
        console.log('✅ Received data (first 100 chars):', 
          chunk.toString().substring(0, 100));
      });
      
      res.on('end', () => {
        console.log('\n✅ HTTPS connection SUCCESSFUL');
        console.log('✅ The issue is with fetch() API, not network');
      });
    });
    
    req.on('error', (error) => {
      console.log('❌ HTTPS request error:', error.message);
      console.log('\n🔧 This confirms NETWORK BLOCK');
      console.log('Possible causes:');
      console.log('1. Corporate firewall blocking Node.js');
      console.log('2. Windows Defender blocking');
      console.log('3. Antivirus blocking');
      console.log('4. Proxy settings needed');
    });
    
    req.on('timeout', () => {
      console.log('⏰ Request timeout');
      req.destroy();
    });
    
    req.end();
    
  } catch (error) {
    console.error('Test error:', error.message);
  }
};

testWithHttps();

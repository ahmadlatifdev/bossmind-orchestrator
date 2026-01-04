// verify-all.js
import fs from 'fs/promises';
import { readdir } from 'fs/promises';

console.log('🔍 BOSSMIND FULL SYSTEM VERIFICATION');
console.log('=' .repeat(50));

const verify = async () => {
  const checks = [];
  
  try {
    // 1. Check bossmind-master.json
    const masterData = await fs.readFile('bossmind-master.json', 'utf8');
    const master = JSON.parse(masterData);
    
    checks.push({
      name: 'Master Config',
      status: true,
      details: `Active: ${master.active}, Mission: ${master.current_mission_file}`
    });
    
    // 2. Check all config files exist
    const requiredFiles = [
      'bossmind-config.json',
      'bossmind-agents.json', 
      'bossmind-settings.json',
      'bossmind-runtime.json',
      'bossmind-projects.json',
      master.current_mission_file
    ].filter(Boolean);
    
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        checks.push({
          name: `File: ${file}`,
          status: true,
          details: 'Found'
        });
      } catch {
        checks.push({
          name: `File: ${file}`,
          status: false,
          details: 'Missing'
        });
      }
    }
    
    // 3. Check mission files
    const missionFiles = (await readdir('.')).filter(f => f.includes('mission') && f.endsWith('.json'));
    checks.push({
      name: 'Mission Files',
      status: missionFiles.length > 0,
      details: `Found ${missionFiles.length} files`
    });
    
    // 4. Check if we can read/write
    const testFile = 'bossmind-test-permissions.json';
    const testData = { test: 'permissions', timestamp: new Date().toISOString() };
    
    await fs.writeFile(testFile, JSON.stringify(testData, null, 2));
    const readBack = await fs.readFile(testFile, 'utf8');
    const parsed = JSON.parse(readBack);
    
    checks.push({
      name: 'Read/Write Permissions',
      status: parsed.test === 'permissions',
      details: 'File system access confirmed'
    });
    
    // Clean up test file
    await fs.unlink(testFile);
    
    // Display results
    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('-'.repeat(50));
    
    checks.forEach(check => {
      const icon = check.status ? '✅' : '❌';
      console.log(`${icon} ${check.name}`);
      console.log(`   ${check.details}`);
    });
    
    // Summary
    const passed = checks.filter(c => c.status).length;
    const total = checks.length;
    
    console.log('\n' + '=' .repeat(50));
    console.log(`📈 SCORE: ${passed}/${total} checks passed`);
    
    if (passed === total) {
      console.log('🎉 BOSSMIND FULLY AUTHORIZED AND READY');
    } else {
      console.log('⚠️  Some checks failed - review above');
    }
    
    return passed === total;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
};

// Run verification
verify().then(success => {
  if (success) {
    console.log('\n' + '=' .repeat(50));
    console.log('🚀 NEXT STEP: Connect to Supabase');
    console.log('=' .repeat(50));
  }
});
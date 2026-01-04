// activate-bossmind.js
import fs from 'fs/promises';

console.log('🔐 ACTIVATING BOSSMIND...');
console.log('=' .repeat(40));

const activate = async () => {
  try {
    // Read current config
    const data = await fs.readFile('bossmind-master.json', 'utf8');
    const config = JSON.parse(data);
    
    console.log('📁 Current status:', config.active ? 'ACTIVE' : 'INACTIVE');
    
    // Activate if inactive
    if (config.active !== true) {
      config.active = true;
      config.activated_at = new Date().toISOString();
      config.authorized_by = 'system_admin';
      
      // Save updated config
      await fs.writeFile('bossmind-master.json', JSON.stringify(config, null, 2));
      
      console.log('✅ BossMind ACTIVATED');
      console.log('⏰ Activated at:', config.activated_at);
      console.log('👤 Authorized by:', config.authorized_by);
    } else {
      console.log('ℹ️ BossMind is already active');
    }
    
    // Show new permissions
    console.log('\n✅ NEW PERMISSIONS GRANTED:');
    console.log('1. Full file system access');
    console.log('2. Supabase project control');
    console.log('3. Automation engine control');
    console.log('4. Mission management');
    
    return true;
  } catch (error) {
    console.error('❌ Activation failed:', error.message);
    return false;
  }
};

// Run activation
activate().then(success => {
  if (success) {
    console.log('\n' + '=' .repeat(40));
    console.log('🚀 ACTIVATION COMPLETE');
    console.log('=' .repeat(40));
  }
});
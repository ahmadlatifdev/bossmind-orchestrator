// resumeai-authorization.js
import fs from 'fs/promises';

console.log('🔐 BOSSMIIND AUTHORIZATION CHECK');
console.log('=' .repeat(40));

// Simple authorization check
const checkAuthorization = async () => {
  try {
    // Check if resumeai-master.json exists
    const configExists = await fs.access('resumeai-master.json').then(() => true).catch(() => false);
    
    if (configExists) {
      console.log('✅ ResumeAI master file found');
      
      // Read config
      const configData = await fs.readFile('resumeai-master.json', 'utf8');
      const config = JSON.parse(configData);
      
      // Check if ResumeAI is active
      if (config.active === true) {
        console.log('✅ ResumeAI is ACTIVE');
        console.log('✅ Authorization: GRANTED');
        console.log('📁 Current mission:', config.current_mission_file);
        
        // List allowed actions
        console.log('\n✅ ALLOWED ACTIONS:');
        console.log('- Read/write JSON files');
        console.log('- Control automation');
        console.log('- Access Supabase projects');
        console.log('- Manage missions');
        
        return true;
      } else {
        console.log('❌ ResumeAI is INACTIVE');
        return false;
      }
    } else {
      console.log('❌ Master file not found');
      return false;
    }
  } catch (error) {
    console.error('❌ Authorization check failed:', error.message);
    return false;
  }
};

// Run the check
checkAuthorization().then(authorized => {
  if (authorized) {
    console.log('\n' + '=' .repeat(40));
    console.log('🚀 READY FOR NEXT STEP');
    console.log('=' .repeat(40));
  } else {
    console.log('\n❌ Please activate ResumeAI first');
  }
});

// check-missions.js
import fs from 'fs/promises';
import { readdir } from 'fs/promises';

console.log('📁 CHECKING AVAILABLE MISSIONS');
console.log('=' .repeat(40));

const checkMissions = async () => {
  try {
    // List all files in current directory
    const files = await readdir('.');
    
    // Find mission files
    const missionFiles = files.filter(file => 
      file.includes('mission') && file.endsWith('.json')
    );
    
    console.log(`✅ Found ${missionFiles.length} mission files:`);
    missionFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
    // Check resumeai-master.json for current mission
    const masterData = await fs.readFile('resumeai-master.json', 'utf8');
    const master = JSON.parse(masterData);
    
    console.log('\n📋 CURRENT CONFIG:');
    console.log(`   Current mission file: ${master.current_mission_file || 'NOT SET'}`);
    console.log(`   Active: ${master.active ? 'YES ✅' : 'NO ❌'}`);
    
    // If mission exists but not in master, suggest update
    if (missionFiles.length > 0 && !master.current_mission_file) {
      console.log('\n⚠️  SUGGESTION: Set a mission');
      console.log(`   Example: ${missionFiles[0]}`);
    }
    
    return missionFiles;
  } catch (error) {
    console.error('❌ Error checking missions:', error.message);
    return [];
  }
};

checkMissions().then(missions => {
  if (missions.length > 0) {
    console.log('\n' + '=' .repeat(40));
    console.log('🚀 MISSIONS READY');
    console.log('=' .repeat(40));
  } else {
    console.log('\n❌ No mission files found');
  }
});

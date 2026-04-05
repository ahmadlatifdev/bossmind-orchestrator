// set-mission.js
import fs from 'fs/promises';

console.log('🎯 SETTING CURRENT MISSION');
console.log('=' .repeat(40));

const setMission = async () => {
  try {
    // Read current config
    const data = await fs.readFile('resumeai-master.json', 'utf8');
    const config = JSON.parse(data);
    
    console.log('📋 BEFORE:');
    console.log(`   Mission file: ${config.current_mission_file || 'NOT SET'}`);
    
    // Set to mission-1-elegancyart.json (from your files)
    config.current_mission_file = "mission-1-elegancyart.json";
    config.mission_set_at = new Date().toISOString();
    
    // Save updated config
    await fs.writeFile('resumeai-master.json', JSON.stringify(config, null, 2));
    
    console.log('\n📋 AFTER:');
    console.log(`   Mission file: ${config.current_mission_file}`);
    console.log(`   Set at: ${config.mission_set_at}`);
    
    // Verify the mission file exists
    try {
      const missionData = await fs.readFile(config.current_mission_file, 'utf8');
      const mission = JSON.parse(missionData);
      console.log(`\n✅ Mission file verified`);
      console.log(`   Mission name: ${mission.name || 'Unknown'}`);
      console.log(`   File size: ${missionData.length} bytes`);
    } catch (error) {
      console.log(`\n⚠️  Mission file exists but couldn't read: ${error.message}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to set mission:', error.message);
    return false;
  }
};

// Run
setMission().then(success => {
  if (success) {
    console.log('\n' + '=' .repeat(40));
    console.log('🎯 MISSION SET SUCCESSFULLY');
    console.log('=' .repeat(40));
  }
});

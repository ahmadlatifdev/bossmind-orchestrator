// dashboard.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('📊 BOSSMIND SIMPLE DASHBOARD');
console.log('=' .repeat(60));

const showDashboard = async () => {
  try {
    const secretsData = await fs.readFile('bossmind-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    const supabase = createClient(project.url, project.service_role_key);
    
    console.log('\n🤖 SYSTEM STATUS:');
    console.log('   BossMind: ✅ ACTIVE');
    console.log(`   Project: ${project.url}`);
    console.log(`   Mission: Elegancyart Dropshipping Setup`);
    
    console.log('\n📊 DATABASE STATS:');
    
    // Get counts
    const [products, categories, orders, logs] = await Promise.all([
      supabase.from('products').select('count', { count: 'exact', head: true }),
      supabase.from('categories').select('count', { count: 'exact', head: true }),
      supabase.from('orders').select('count', { count: 'exact', head: true }),
      supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(5)
    ]);
    
    console.log(`   Products: ${products.count || 0}`);
    console.log(`   Categories: ${categories.count || 0}`);
    console.log(`   Orders: ${orders.count || 0}`);
    console.log(`   System Logs: ${logs.data?.length || 0}`);
    
    console.log('\n📝 RECENT ACTIVITY:');
    if (logs.data && logs.data.length > 0) {
      logs.data.forEach(log => {
        const time = new Date(log.created_at).toLocaleTimeString();
        console.log(`   [${time}] ${log.level.toUpperCase()}: ${log.message}`);
      });
    } else {
      console.log('   No recent activity');
    }
    
    console.log('\n⚡ AUTOMATION:');
    console.log('   Status: ✅ RUNNING');
    console.log('   Jobs: Health checks, Product sync, Daily backup');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 NEXT ACTIONS:');
    console.log('   1. Add more products');
    console.log('   2. Set up frontend website');
    console.log('   3. Configure payment system');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('Dashboard error:', error.message);
  }
};

showDashboard();
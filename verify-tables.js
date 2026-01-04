// verify-tables.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

console.log('🔍 VERIFYING DATABASE TABLES');
console.log('=' .repeat(60));

const verifyTables = async () => {
  try {
    const secretsData = await fs.readFile('bossmind-secrets.json', 'utf8');
    const secrets = JSON.parse(secretsData);
    const project = secrets.supabase_projects['elegancyart-ai'];
    
    const supabase = createClient(project.url, project.service_role_key);
    
    const tablesToCheck = ['products', 'categories', 'orders', 'system_logs'];
    
    console.log('📋 Checking tables in Supabase...\n');
    
    let allTablesExist = true;
    
    for (const table of tablesToCheck) {
      try {
        // Try to select from the table
        const { data, error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true })
          .limit(1);
        
        if (error) {
          if (error.code === '42P01') {
            console.log(`❌ ${table}: DOES NOT EXIST`);
            allTablesExist = false;
          } else {
            console.log(`⚠️  ${table}: Error checking (${error.code})`);
          }
        } else {
          console.log(`✅ ${table}: EXISTS`);
        }
      } catch (err) {
        console.log(`⚠️  ${table}: Check failed - ${err.message}`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    
    if (allTablesExist) {
      console.log('🎉 ALL TABLES EXIST! Database is ready.');
    } else {
      console.log('⚠️  SOME TABLES MISSING. Need to create them properly.');
      console.log('\n🔧 SOLUTION: Use Supabase SQL Editor directly.');
    }
    
    return allTablesExist;
    
  } catch (error) {
    console.error('Verification failed:', error.message);
    return false;
  }
};

verifyTables();
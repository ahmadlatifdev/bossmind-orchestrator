const express = require('express');
const router = express.Router();
const { executionGuard } = require('../middleware/executionGuard.cjs');

// Browser-friendly probe (proves route is mounted)
router.get('/activate', (req, res) => {
  res.json({
    status: 'ready',
    message: 'Route mounted. Use POST /admin/activate to run phases.',
    mode: process.env.BOSSMIND_EXECUTION_MODE || 'NOT SET',
    timestamp: new Date().toISOString(),
  });
});

// Phase runners (stubs/hooks)
async function phase0_lockSafety() { return { phase: 0, status: 'ok', action: 'LOCK_EXISTING_PROJECTS' }; }
async function phase1_bootCore() { return { phase: 1, status: 'ok', action: 'BOOT_BOSSMIND_CORE' }; }
async function phase2_attachGuardian() { return { phase: 2, status: 'ok', action: 'ATTACH_DEVOPS_GUARDIAN' }; }
async function phase3_dashboard() { return { phase: 3, status: 'ok', action: 'INIT_DASHBOARD_SERVICE' }; }
async function phase4_automationControl() { return { phase: 4, status: 'ok', action: 'ARM_AUTOMATIONS_STANDBY' }; }
async function phase5_visibility() { return { phase: 5, status: 'ok', action: 'ENABLE_LOGS_AND_STATUS' }; }
async function phase6_verify() { return { phase: 6, status: 'ok', action: 'FINAL_VERIFICATION' }; }

// POST activate (guarded)
router.post('/activate', executionGuard, async (req, res) => {
  try {
    const results = [];
    results.push(await phase0_lockSafety());
    results.push(await phase1_bootCore());
    results.push(await phase2_attachGuardian());
    results.push(await phase3_dashboard());
    results.push(await phase4_automationControl());
    results.push(await phase5_visibility());
    results.push(await phase6_verify());

    res.json({
      status: 'activated',
      mode: process.env.BOSSMIND_EXECUTION_MODE,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err) {
    res.status(500).json({
      status: 'failed',
      error: err && err.message ? err.message : 'Activation error',
    });
  }
});

module.exports = router;

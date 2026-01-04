function executionGuard(req, res, next) {
  if (process.env.BOSSMIND_EXECUTION_MODE !== 'SINGLE_WRITER') {
    return res.status(403).json({
      error: 'Execution blocked',
      reason: 'BossMind is not in SINGLE_WRITER mode'
    });
  }
  next();
}

module.exports = { executionGuard };

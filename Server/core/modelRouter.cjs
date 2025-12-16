// Server/core/modelRouter.cjs
// BossMind Model Router — HARD ENFORCEMENT (CJS)

const ALLOWED_MODELS = {
  ORCHESTRATOR: "deepseek/deepseek-chat",
  CODER: "deepseek/deepseek-coder"
};

const BENEFITS = {
  [ALLOWED_MODELS.ORCHESTRATOR]: {
    canPlan: true,
    canDecide: true,
    canApprove: true,
    canWriteCode: false
  },
  [ALLOWED_MODELS.CODER]: {
    canPlan: false,
    canDecide: false,
    canApprove: false,
    canWriteCode: true
  }
};

function routeModel({ intent, approvedFiles = [] }) {
  if (intent === "code") {
    if (!approvedFiles || approvedFiles.length === 0) {
      throw new Error("ROUTER BLOCK: Code intent detected without approved files");
    }
    return ALLOWED_MODELS.CODER;
  }
  return ALLOWED_MODELS.ORCHESTRATOR;
}

function assertBenefit(model, action) {
  const benefits = BENEFITS[model];
  if (!benefits || benefits[action] !== true) {
    throw new Error(`BENEFIT BLOCK: ${model} is not allowed to perform ${action}`);
  }
}

module.exports = {
  routeModel,
  assertBenefit,
  ALLOWED_MODELS,
  BENEFITS
};

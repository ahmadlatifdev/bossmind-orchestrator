// Legacy browser cloud service. The server remains the policy authority.
// No credential imports, key resolution, paid API requests or local fallback.
export const DEEPSEEK_MODELS = Object.freeze({
  CHAT: "deepseek-chat",
  CODER: "deepseek-coder",
  REASONER: "deepseek-reasoner"
});

function denyCloudRequest() {
  const error = new Error("Cloud inference is prohibited by BOSSMIND-OPEN-SOURCE-ONLY-1.");
  error.code = "COST_POLICY_BLOCKED";
  error.status = 403;
  error.reason = "CLOUD_PROVIDER_PROHIBITED";
  throw error;
}

class DeepSeekService {
  async _request() { denyCloudRequest(); }
  async chat() { denyCloudRequest(); }
  async embed() { denyCloudRequest(); }
  async listModels() { denyCloudRequest(); }
}

const defaultService = new DeepSeekService();
export const coreAI = defaultService;
export const DEEPSEEK_API = {
  service: defaultService,
  MODELS: DEEPSEEK_MODELS,
  chat: (opts) => defaultService.chat(opts),
  embed: (text, model) => defaultService.embed(text, model),
  listModels: () => defaultService.listModels()
};
export default DeepSeekService;

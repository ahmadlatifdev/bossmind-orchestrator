export const retry = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error("[BossMind][RetryQueue]", e.message);
  }
};

/**
 * Model resolution and fallback management utility for Google Gemini models.
 * Centralizes model selection, task-specific environment overrides,
 * and bounded 404 model failover (max 1 hop) without Antigravity/manual edits.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export const TASK_ENV_VARS = Object.freeze({
  planner: "GEMINI_PLANNER_MODEL",
  decision: "GEMINI_DECISION_MODEL",
  sentiment: "GEMINI_SENTIMENT_MODEL",
});

/**
 * Curated list of verified, compatible models supporting structured JSON output and responseSchema.
 */
export const COMPATIBLE_MODELS = Object.freeze({
  planner: Object.freeze(["gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash"]),
  decision: Object.freeze(["gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash"]),
  sentiment: Object.freeze(["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-2.5-flash"]),
});

export const MAX_FALLBACK_HOPS = 1;

/**
 * Resolve the primary Gemini model for a given task.
 * Precedence:
 * 1. options.model (explicit parameter override)
 * 2. Task-specific env: GEMINI_PLANNER_MODEL / GEMINI_DECISION_MODEL / GEMINI_SENTIMENT_MODEL
 * 3. Global env: GEMINI_MODEL
 * 4. Built-in verified default ("gemini-3.6-flash")
 *
 * @param {string} task - "planner" | "decision" | "sentiment"
 * @param {Object} [options={}] - Options containing optional model override
 * @returns {string} Model name
 */
export const resolveModel = (task = "planner", options = {}) => {
  if (options && options.model && typeof options.model === "string" && options.model.trim()) {
    return options.model.trim();
  }

  const taskEnvVar = TASK_ENV_VARS[task];
  if (
    taskEnvVar &&
    process.env[taskEnvVar] &&
    typeof process.env[taskEnvVar] === "string" &&
    process.env[taskEnvVar].trim()
  ) {
    return process.env[taskEnvVar].trim();
  }

  if (
    process.env.GEMINI_MODEL &&
    typeof process.env.GEMINI_MODEL === "string" &&
    process.env.GEMINI_MODEL.trim()
  ) {
    return process.env.GEMINI_MODEL.trim();
  }

  const taskDefaults = COMPATIBLE_MODELS[task];
  if (taskDefaults && taskDefaults.length > 0) {
    return taskDefaults[0];
  }

  return DEFAULT_GEMINI_MODEL;
};

/**
 * Get the next fallback model for a task when the current model returns 404 / MODEL_UNAVAILABLE.
 * Strictly enforces a maximum of 1 fallback hop and prevents loops.
 *
 * @param {string} task - "planner" | "decision" | "sentiment"
 * @param {string} currentModel - The model that failed
 * @param {Set<string>|Array<string>} [attemptedModels=new Set()] - Set of models already attempted
 * @returns {string|null} Next model name or null if chain is exhausted or max hops reached
 */
export const getFallbackModel = (task = "planner", currentModel, attemptedModels = new Set()) => {
  const attemptedSet = attemptedModels instanceof Set ? attemptedModels : new Set(attemptedModels);
  if (currentModel) {
    attemptedSet.add(currentModel);
  }

  // Enforce maximum ONE fallback hop (maximum 2 total models attempted: initial + 1 fallback)
  if (attemptedSet.size > MAX_FALLBACK_HOPS) {
    return null;
  }

  const chain = COMPATIBLE_MODELS[task] || COMPATIBLE_MODELS.planner;

  for (const candidate of chain) {
    if (!attemptedSet.has(candidate)) {
      return candidate;
    }
  }

  return null;
};

export default {
  DEFAULT_GEMINI_MODEL,
  TASK_ENV_VARS,
  COMPATIBLE_MODELS,
  MAX_FALLBACK_HOPS,
  resolveModel,
  getFallbackModel,
};


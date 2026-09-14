/**
 * Model resolution, capability validation, and fallback management for Google Gemini models.
 * Centralizes model selection, task-specific environment overrides, static capability matching,
 * and bounded 404 model failover (max 1 hop) without runtime network discovery or manual code edits.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export const TASK_ENV_VARS = Object.freeze({
  planner: "GEMINI_PLANNER_MODEL",
  decision: "GEMINI_DECISION_MODEL",
  sentiment: "GEMINI_SENTIMENT_MODEL",
});

/**
 * Static capability requirements by agent task.
 */
export const TASK_CAPABILITY_REQUIREMENTS = Object.freeze({
  planner: Object.freeze(["structured_json", "system_instruction", "high_reasoning"]),
  decision: Object.freeze(["structured_json", "system_instruction", "grounded_reasoning"]),
  sentiment: Object.freeze(["structured_json", "batch_text_extraction"]),
});

/**
 * Static capability profiles for verified Google Gemini models.
 */
export const MODEL_CAPABILITY_PROFILES = Object.freeze({
  "gemini-3.6-flash": Object.freeze([
    "structured_json",
    "system_instruction",
    "high_reasoning",
    "grounded_reasoning",
    "batch_text_extraction",
  ]),
  "gemini-3.7-flash": Object.freeze([
    "structured_json",
    "system_instruction",
    "high_reasoning",
    "grounded_reasoning",
    "batch_text_extraction",
  ]),
  "gemini-3.5-flash-lite": Object.freeze([
    "structured_json",
    "system_instruction",
    "batch_text_extraction",
  ]),
  "gemini-2.5-flash": Object.freeze([
    "structured_json",
    "system_instruction",
    "high_reasoning",
    "grounded_reasoning",
    "batch_text_extraction",
  ]),
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
 * Check if a model satisfies all capability requirements for a given task.
 *
 * Rules:
 * 1. Known compatible model -> true.
 * 2. Known incompatible model -> false.
 * 3. Unknown/future model -> true for forward compatibility.
 * 4. Zero runtime provider discovery or models.list() calls.
 *
 * @param {string} task - "planner" | "decision" | "sentiment"
 * @param {string} modelName - The Gemini model name
 * @returns {boolean} True if model satisfies all task capability requirements or is unknown
 */
export const isModelCompatible = (task = "planner", modelName) => {
  if (!modelName || typeof modelName !== "string") {
    return false;
  }
  const cleanModel = modelName.trim();
  const profile = MODEL_CAPABILITY_PROFILES[cleanModel];

  // Rule 3: Unknown / future model -> true for forward compatibility
  if (!profile) {
    return true;
  }

  const required = TASK_CAPABILITY_REQUIREMENTS[task];
  if (!required || required.length === 0) {
    return true;
  }

  // Rules 1 & 2: Check that all required capabilities are present in the model's profile
  return required.every((cap) => profile.includes(cap));
};

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
    const compatibleDefault = taskDefaults.find((candidate) => isModelCompatible(task, candidate));
    if (compatibleDefault) {
      return compatibleDefault;
    }
    return taskDefaults[0];
  }

  return DEFAULT_GEMINI_MODEL;
};

/**
 * Get the next fallback model for a task when the current model returns 404 / MODEL_UNAVAILABLE.
 * Strictly enforces a maximum of 1 fallback hop, prevents loops, and filters by capability compatibility.
 *
 * @param {string} task - "planner" | "decision" | "sentiment"
 * @param {string} currentModel - The model that failed
 * @param {Set<string>|Array<string>} [attemptedModels=new Set()] - Set of models already attempted
 * @returns {string|null} Next model name or null if chain is exhausted, max hops reached, or incompatible
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
    if (!attemptedSet.has(candidate) && isModelCompatible(task, candidate)) {
      return candidate;
    }
  }

  return null;
};

export default {
  DEFAULT_GEMINI_MODEL,
  TASK_ENV_VARS,
  TASK_CAPABILITY_REQUIREMENTS,
  MODEL_CAPABILITY_PROFILES,
  COMPATIBLE_MODELS,
  MAX_FALLBACK_HOPS,
  isModelCompatible,
  resolveModel,
  getFallbackModel,
};


import gemini from "../config/gemini.js";
import { resolveModel, getFallbackModel } from "../agent/modelResolver.js";
import { classifyProviderError } from "../agent/providerErrors.js";

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * System instruction provided to Gemini for technology idea analysis.
 */
const TECH_ANALYSIS_SYSTEM_INSTRUCTION = `You are an expert technology venture architect, product strategist, and software engineer.
Your task is to analyze technology product ideas to assess their real-world technical feasibility, recommend a modern technology stack, estimate a market fit score, and identify critical risks.

GUIDELINES:
1. Technical Feasibility: Assess if the product can be built using existing, proven technologies. Must be one of: "Low", "Medium", "High".
2. Suggested Stack: Provide 3-6 specific, modern, industry-standard technologies (e.g. React, Node.js, PostgreSQL, Redis, OpenAI/Gemini API, WebSockets).
3. Market Fit Score (0.0 to 10.0 scale):
   - 0.0 to 3.9: Low market fit, severe saturation, questionable demand, or fatal structural flaws (High Risk).
   - 4.0 to 6.9: Moderate market fit, viable concept but requires business-model or differentiation refinement (Needs Refinement).
   - 7.0 to 10.0: Strong market fit, clear value proposition, high demand, defensible opportunity (Viable).
4. Risks: Provide 2-5 concrete, actionable technical, market, differentiation, or execution risks.
5. Return ONLY a valid JSON object matching the requested schema. No markdown wrapping.`;

const TECH_ANALYSIS_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    feasibility: {
      type: "string",
      enum: ["Low", "Medium", "High"],
      description: "Technical feasibility assessment: 'Low', 'Medium', or 'High'",
    },
    suggestedStack: {
      type: "array",
      items: { type: "string" },
      description: "Recommended technology stack components",
    },
    marketFitScore: {
      type: "number",
      description: "Market fit score between 0.0 and 10.0",
    },
    risks: {
      type: "array",
      items: { type: "string" },
      description: "Key technical, market, or execution risks",
    },
  },
  required: ["feasibility", "suggestedStack", "marketFitScore", "risks"],
});

/**
 * Analyze a technology product idea using Google Gemini.
 *
 * @param {Object} params
 * @param {string} params.goal - The product idea / goal description.
 * @param {string|null} [params.location=null] - Optional geographic / market context.
 * @param {Object|null} [params.geminiClient=null] - Optional Gemini client override for testing.
 * @param {string|null} [params.model=null] - Optional model override.
 * @param {Function} [params.sleepFn=defaultSleep] - Sleep function for retry backoff.
 * @returns {Promise<{feasibility: string, suggestedStack: string[], marketFitScore: number, risks: string[]}>}
 */
export const analyzeTechIdea = async ({
  goal,
  location = null,
  geminiClient = null,
  model = null,
  sleepFn = defaultSleep,
}) => {
  if (typeof goal !== "string" || !goal.trim()) {
    throw new Error("Goal is required for tech idea analysis");
  }

  const cleanGoal = goal.trim();
  const cleanLocation = typeof location === "string" && location.trim() ? location.trim() : null;

  const activeClient = geminiClient || gemini;
  if (!activeClient || !activeClient.models || typeof activeClient.models.generateContent !== "function") {
    if (process.env.MOCK_MODE !== "true" && !geminiClient) {
      throw new Error("Gemini provider is not configured or unavailable in non-mock mode");
    }
  }

  const prompt = `Analyze the following technology product idea:

Product Idea:
"${cleanGoal}"
${cleanLocation ? `\nTarget Market / Location Context:\n"${cleanLocation}"` : ""}

Evaluate:
1. Technical feasibility ("Low", "Medium", or "High")
2. Suggested modern technology stack
3. Market fit score on a 0.0 to 10.0 scale
4. Critical technical, market, and execution risks`;

  let response = null;
  let activeModel = resolveModel("tech_analysis", { model });
  const attemptedModels = new Set();
  const maxRetriesPerModel = 3;

  while (activeModel) {
    attemptedModels.add(activeModel);
    let modelSucceeded = false;

    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(
          `Gemini tech idea analysis attempt ${attempt}/${maxRetriesPerModel} (model: ${activeModel})...`
        );

        response = await activeClient.models.generateContent({
          model: activeModel,
          contents: prompt,
          config: {
            systemInstruction: TECH_ANALYSIS_SYSTEM_INSTRUCTION,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: TECH_ANALYSIS_SCHEMA,
            abortSignal: AbortSignal.timeout(30000),
            httpOptions: { timeout: 30000 },
          },
        });

        modelSucceeded = true;
        break;
      } catch (error) {
        console.error(
          `Gemini attempt ${attempt} failed with model ${activeModel}:`,
          error.message
        );

        const classified = classifyProviderError(error);

        // If quota exhaustion, abort retries immediately (do not hammer provider)
        if (classified.isQuota) {
          console.warn(
            `Gemini tech idea analysis quota exhausted (${classified.sanitizedMessage}). Aborting retries immediately.`
          );
          throw error;
        }

        // If model unavailable (404), break retry loop to fail over immediately
        if (classified.isModelUnavailable) {
          const nextModel = getFallbackModel("tech_analysis", activeModel, attemptedModels);
          if (nextModel) {
            console.warn(
              `[Tech Idea Analyzer] Gemini model '${activeModel}' is unavailable (${classified.statusCode || 404}). Attempting fallback to '${nextModel}' (hop 1/1)...`
            );
            activeModel = nextModel;
            break;
          } else {
            throw error;
          }
        }

        // Retry only temporary errors (timeouts, 5xx server errors, rate limits)
        const retryable = classified.isTemporary;
        if (!retryable || attempt === maxRetriesPerModel) {
          throw error;
        }

        const waitTime = attempt === 1 ? 2000 : 5000;
        console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
        await sleepFn(waitTime);
      }
    }

    if (modelSucceeded) {
      break;
    }
  }

  if (!response) {
    throw new Error("Gemini did not return a response for tech idea analysis");
  }

  const responseText = response?.text || (typeof response === "string" ? response : null);
  if (!responseText || typeof responseText !== "string" || !responseText.trim()) {
    throw new Error("Gemini returned an empty response for tech idea analysis");
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText.trim());
  } catch (parseErr) {
    console.error("Failed to parse Gemini JSON for tech idea analysis:", parseErr.message);
    throw new Error("Gemini returned invalid JSON for tech idea analysis");
  }

  // Normalize and validate parsed output
  const rawFeasibility = String(parsed.feasibility || "").trim();
  const validFeasibilities = ["Low", "Medium", "High"];
  const feasibility = validFeasibilities.includes(rawFeasibility)
    ? rawFeasibility
    : "Medium";

  const rawStack = Array.isArray(parsed.suggestedStack) ? parsed.suggestedStack : [];
  const suggestedStack = rawStack
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const rawScore = Number(parsed.marketFitScore);
  const marketFitScore = Number.isFinite(rawScore)
    ? Number(Math.max(0, Math.min(10, rawScore)).toFixed(1))
    : 5.0;

  const rawRisks = Array.isArray(parsed.risks) ? parsed.risks : [];
  const risks = rawRisks
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return {
    feasibility,
    suggestedStack: suggestedStack.length > 0 ? suggestedStack : ["Web Application", "Cloud Services"],
    marketFitScore,
    risks: risks.length > 0 ? risks : ["Technical execution risk", "Market adoption uncertainty"],
  };
};

export default analyzeTechIdea;


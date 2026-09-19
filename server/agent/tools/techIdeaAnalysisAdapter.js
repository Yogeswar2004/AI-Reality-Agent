import BaseToolAdapter from "../toolAdapter.js";
import { TOOL_IDS, TOOL_ACCESS, TOOL_RISK, DEFAULT_QUOTA_COST, MOCK_ENABLED } from "../toolConstants.js";
import { TOOL_FIXTURES } from "../toolFixtures.js";
import { analyzeTechIdea } from "../../utils/techIdeaAnalyzer.js";

/**
 * Adapter for the tech_idea_analysis tool.
 */
class TechIdeaAnalysisAdapter extends BaseToolAdapter {
  /**
   * @param {Object} definition - The tool definition (should match our static definition).
   */
  constructor(definition) {
    super(definition);
    // Ensure the definition matches our expectations (optional)
    if (definition.id !== TOOL_IDS.TECH_IDEA_ANALYSIS) {
      throw new Error("Incorrect tool ID for TechIdeaAnalysisAdapter");
    }
    this.providerClient = null;
  }

  setProviderClient(client) {
    this.providerClient = client;
  }

  /**
   * Validate input for tech_idea_analysis.
   * Expects: { goal: string (non-empty, max 500), location?: string (max 100) or null }
   * @param {any} input
   * @throws {Error}
   */
  validateInput(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("Input must be an object");
    }
    const { goal, location } = input;

    // Validate goal
    if (typeof goal !== "string" || goal.trim() === "") {
      throw new Error("Input must have a non-empty string 'goal'");
    }
    if (goal.length > 500) {
      throw new Error("Goal must not exceed 500 characters");
    }

    // Validate location (optional)
    if (location !== undefined && location !== null) {
      if (typeof location !== "string") {
        throw new Error("Location must be a string or null");
      }
      if (location.length > 100) {
        throw new Error("Location must not exceed 100 characters");
      }
    }

    // No additional properties allowed
    const allowedKeys = ["goal", "location"];
    const extraKeys = Object.keys(input).filter(key => !allowedKeys.includes(key));
    if (extraKeys.length > 0) {
      throw new Error(`Input contains unexpected property(ies): ${extraKeys.join(", ")}`);
    }
  }

  /**
   * Execute the tool logic.
   * In Mock mode, returns deterministic fixture.
   * In Live mode, calls Gemini analyzeTechIdea.
   * @param {Object} input - The validated input.
   * @returns {Promise<Object>} The fixture or Gemini analysis output.
   */
  async _execute(input) {
    if (process.env.MOCK_MODE === "true") {
      if (input.goal === "MOCK_QUOTA_ERROR") {
        const err = new Error("Gemini API quota exceeded. Please try again later or upgrade quota.");
        err.status = 429;
        err.code = "RESOURCE_EXHAUSTED";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_RATE_LIMIT_ERROR") {
        const err = new Error("Gemini rate limit: 1 request/second exceeded. Please wait a moment and retry.");
        err.status = 429;
        err.code = "RATE_LIMIT_EXCEEDED";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_AUTH_ERROR") {
        const err = new Error("Gemini Authentication Error: Invalid or expired API key.");
        err.status = 403;
        err.code = "AUTH_ERROR";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_503_ERROR") {
        const err = new Error("Gemini Service Unavailable (503): model is temporarily overloaded. Please retry.");
        err.status = 503;
        err.code = "SERVICE_UNAVAILABLE";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_502_ERROR") {
        const err = new Error("Gemini Bad Gateway (502): upstream service was unavailable. Please retry.");
        err.status = 502;
        err.code = "BAD_GATEWAY";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_500_ERROR") {
        const err = new Error("Gemini Server Error (500): model service encountered an internal error. Please retry.");
        err.status = 500;
        err.code = "SERVER_ERROR";
        err.provider = "gemini";
        throw err;
      }
      if (input.goal === "MOCK_TIMEOUT_ERROR") {
        const err = new Error("Gemini Gateway Timeout (504): tech idea analysis request timed out. Please retry.");
        err.status = 504;
        err.code = "TIMEOUT";
        err.provider = "gemini";
        throw err;
      }

      const fixture = TOOL_FIXTURES.tech_idea_analysis;
      return {
        feasibility: fixture.feasibility,
        suggestedStack: [...fixture.suggestedStack],
        marketFitScore: fixture.marketFitScore,
        risks: [...fixture.risks],
      };
    }

    const result = await analyzeTechIdea({
      goal: input.goal.trim(),
      location: input.location ? input.location.trim() : null,
      geminiClient: this.providerClient,
    });

    const output = {
      feasibility: result.feasibility,
      suggestedStack: Array.isArray(result.suggestedStack) ? result.suggestedStack : [],
      marketFitScore: typeof result.marketFitScore === "number" ? result.marketFitScore : 5.0,
      risks: Array.isArray(result.risks) ? result.risks : [],
    };

    this.validateOutput(output);
    return output;
  }

  /**
   * Validate output for tech_idea_analysis.
   * Expects an object with:
   *   feasibility: string (enum: "Low", "Medium", "High")
   *   suggestedStack: array of strings
   *   marketFitScore: number between 0 and 10
   *   risks: array of strings
   * @param {any} output
   * @throws {Error}
   */
  validateOutput(output) {
    if (typeof output !== "object" || output === null) {
      throw new Error("Output must be an object");
    }
    const { feasibility, suggestedStack, marketFitScore, risks } = output;

    // Validate feasibility
    const feasibleValues = ["Low", "Medium", "High"];
    if (typeof feasibility !== "string" || !feasibleValues.includes(feasibility)) {
      throw new Error("Output must have a 'feasibility' string with value 'Low', 'Medium', or 'High'");
    }

    // Validate suggestedStack
    if (!Array.isArray(suggestedStack)) {
      throw new Error("Output must have a 'suggestedStack' array");
    }
    for (const item of suggestedStack) {
      if (typeof item !== "string") {
        throw new Error("Each item in 'suggestedStack' must be a string");
      }
    }

    // Validate marketFitScore
    if (typeof marketFitScore !== "number" || !isFinite(marketFitScore) || marketFitScore < 0 || marketFitScore > 10) {
      throw new Error("Output must have a 'marketFitScore' number between 0 and 10");
    }

    // Validate risks
    if (!Array.isArray(risks)) {
      throw new Error("Output must have a 'risks' array");
    }
    for (const risk of risks) {
      if (typeof risk !== "string") {
        throw new Error("Each item in 'risks' must be a string");
      }
    }

    // No additional properties allowed
    const allowedKeys = ["feasibility", "suggestedStack", "marketFitScore", "risks"];
    const extraKeys = Object.keys(output).filter(key => !allowedKeys.includes(key));
    if (extraKeys.length > 0) {
      throw new Error(`Output contains unexpected property(ies): ${extraKeys.join(", ")}`);
    }
  }
}

// Create the tool definition for registration
const definition = {
  id: TOOL_IDS.TECH_IDEA_ANALYSIS,
  name: "Tech Idea Analysis",
  description: "Analyzes a technology idea for feasibility, stack, and market fit.",
  version: "1.0.0",
  inputSchema: {
    // We don't use the schema in validation, but we keep it for metadata.
    type: "object",
    properties: {
      goal: { type: "string", minLength: 1, maxLength: 500 },
      location: { type: ["string", "null"], maxLength: 100 },
    },
    required: ["goal"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      feasibility: { type: "string", enum: ["Low", "Medium", "High"] },
      suggestedStack: { type: "array", items: { type: "string" } },
      marketFitScore: { type: "number", minimum: 0, maximum: 10 },
      risks: { type: "array", items: { type: "string" } },
    },
    required: ["feasibility", "suggestedStack", "marketFitScore", "risks"],
    additionalProperties: false,
  },
  access: TOOL_ACCESS.READ_ONLY,
  external: true, // Calls external Gemini model in live mode
  provider: "gemini",
  quotaCost: DEFAULT_QUOTA_COST,
  riskLevel: TOOL_RISK.LOW,
  mockEnabled: MOCK_ENABLED,
};

// Create a singleton instance of the adapter
const adapterInstance = new TechIdeaAnalysisAdapter(definition);

// Export the adapter instance and the definition (for registry registration)
export { adapterInstance as TechIdeaAnalysisAdapter, definition as techIdeaAnalysisDefinition };
// Default export is the adapter instance
export default adapterInstance;
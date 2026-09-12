import BaseToolAdapter from "../toolAdapter.js";
import { TOOL_IDS, TOOL_ACCESS, TOOL_RISK, DEFAULT_QUOTA_COST, MOCK_ENABLED } from "../toolConstants.js";
import { TOOL_FIXTURES } from "../toolFixtures.js";

/**
 * Adapter for the tech_idea_analysis tool (Phase 3 mock-only).
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
  };

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
   * In Phase 3, we return the deterministic fixture.
   * @param {Object} input - The validated input.
   * @returns {Object} The fixture output.
   */
  _execute(input) {
    // We ignore the input for the fixture in Phase 3 (deterministic default).
    // In a real implementation, we might use the input to vary the output.
    const fixture = TOOL_FIXTURES.tech_idea_analysis;
    return {
      feasibility: fixture.feasibility,
      suggestedStack: [...fixture.suggestedStack],
      marketFitScore: fixture.marketFitScore,
      risks: [...fixture.risks],
    };
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
  external: false, // mock-only in Phase 3
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
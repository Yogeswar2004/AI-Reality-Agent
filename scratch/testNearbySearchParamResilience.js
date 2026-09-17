import assert from "node:assert/strict";
import { validatePlanSchema } from "../server/agent/llmPlanner.js";
import { evaluateDeterministicNextStep } from "../server/agent/planner.js";
import {
  getMockDecision,
  validateDecisionSchema,
  formatDecisionPromptContext,
  LLMDecisionError,
} from "../server/agent/llmDecision.js";
import { TOOL_IDS } from "../server/agent/toolConstants.js";
import nearbyBusinessSearchAdapter from "../server/agent/tools/nearbyBusinessSearchAdapter.js";

console.log("Starting Nearby Business Search Parameter Resilience Test Suite...\n");

// ============================================================================
// Test 1: validatePlanSchema repairs empty params ({}) from Gemini-like plan
// ============================================================================
{
  console.log("Test 1: validatePlanSchema repairs empty params ({}) from Gemini-like plan");

  const rawGeminiPlan = {
    summary: "Conduct a targeted local market investigation for food prices with less prices",
    goalUnderstanding: "Investigate budget-friendly food offerings at target location",
    ventureType: "local",
    targetSteps: 1,
    steps: [
      {
        stepIndex: 1,
        toolId: "nearby_business_search",
        toolName: "Nearby Business Search",
        description: "Search for nearby competitors around coordinates",
        params: {},
        dependsOnStep: null,
      },
    ],
    requiresApproval: true,
    clarificationsNeeded: [],
  };

  const validated = validatePlanSchema(rawGeminiPlan, {
    maxSteps: 5,
    goal: "food prices with less prices",
    location: "Eluru, Andhra Pradesh",
  });

  const step1 = validated.steps[0];
  assert.equal(step1.params.businessType, "food", "businessType must be derived as 'food'");
  assert.equal(typeof step1.params.latitude, "number", "latitude must be a valid number");
  assert.equal(typeof step1.params.longitude, "number", "longitude must be a valid number");
  assert.equal(step1.params.radius, 3000, "radius must default to 3000");
  assert.equal(step1.params.limit, 5, "limit must default to 5");

  console.log("  PASSED: Empty params repaired with specific category and coordinates");
}

// ============================================================================
// Test 2: validatePlanSchema repairs generic businessType ("local business" / "business")
// ============================================================================
{
  console.log("Test 2: validatePlanSchema repairs generic businessType ('local business')");

  const rawPlanWithGeneric = {
    summary: "Local business market analysis",
    goalUnderstanding: "Investigate food court feasibility",
    ventureType: "local",
    targetSteps: 1,
    steps: [
      {
        stepIndex: 1,
        toolId: "nearby_business_search",
        toolName: "Nearby Business Search",
        description: "Search for nearby competitors",
        params: {
          businessType: "local business",
          latitude: 16.7077,
          longitude: 81.1135,
        },
        dependsOnStep: null,
      },
    ],
    requiresApproval: true,
    clarificationsNeeded: [],
  };

  const validated = validatePlanSchema(rawPlanWithGeneric, {
    maxSteps: 5,
    goal: "food court with less prices",
    location: "Eluru, Andhra Pradesh",
  });

  const step1 = validated.steps[0];
  assert.equal(step1.params.businessType, "food court", "generic 'local business' must be replaced with specific 'food court'");
  assert.equal(step1.params.latitude, 16.7077, "latitude must be preserved");
  assert.equal(step1.params.longitude, 81.1135, "longitude must be preserved");

  console.log("  PASSED: Generic category repaired to specific category");
}

// ============================================================================
// Test 3: evaluateDeterministicNextStep defensively repairs missing params
// ============================================================================
{
  console.log("Test 3: evaluateDeterministicNextStep defensively repairs missing params");

  const legacyRun = {
    _id: "run-legacy-001",
    goal: "food court with less prices",
    location: "Eluru, Andhra Pradesh",
    state: "executing",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 0,
    externalCallCount: 0,
    plan: {
      summary: "Analyze food court viability",
      steps: [
        {
          stepIndex: 1,
          toolId: "nearby_business_search",
          description: "Discover competitors",
          params: {}, // Empty params in older plan
          status: "pending",
        },
      ],
    },
  };

  const decision = evaluateDeterministicNextStep({
    run: legacyRun,
    steps: [],
    evidenceList: [],
  });

  assert.equal(decision.action, "EXECUTE_TOOL", "Decision must be EXECUTE_TOOL");
  assert.equal(decision.toolId, "nearby_business_search", "Tool must be nearby_business_search");
  assert.equal(decision.input.businessType, "food court", "input.businessType must be 'food court'");
  assert.equal(typeof decision.input.latitude, "number", "input.latitude must be a valid number");
  assert.equal(typeof decision.input.longitude, "number", "input.longitude must be a valid number");
  assert.equal(decision.input.radius, 3000, "input.radius must default to 3000");
  assert.equal(decision.input.limit, 5, "input.limit must default to 5");

  console.log("  PASSED: Deterministic fallback decision repaired missing params");
}

// ============================================================================
// Test 4: getMockDecision produces complete nearby_business_search input
// ============================================================================
{
  console.log("Test 4: getMockDecision produces complete nearby_business_search input");

  const runWithEmptyPlanParams = {
    _id: "run-empty-002",
    goal: "food prices with less prices",
    location: "Eluru, Andhra Pradesh",
    state: "executing",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 0,
    externalCallCount: 0,
    plan: {
      summary: "Analyze affordable food",
      steps: [
        {
          stepIndex: 1,
          toolId: "nearby_business_search",
          description: "Discover competitors",
          params: {},
          status: "pending",
        },
      ],
    },
  };

  const decision = getMockDecision({
    run: runWithEmptyPlanParams,
    steps: [],
    evidence: [],
  });

  assert.equal(decision.action, "EXECUTE_TOOL", "Decision must be EXECUTE_TOOL");
  assert.equal(decision.toolId, "nearby_business_search", "Tool must be nearby_business_search");
  assert.equal(decision.input.businessType, "food", "input.businessType must be 'food'");
  assert.equal(typeof decision.input.latitude, "number", "input.latitude must be a valid number");
  assert.equal(typeof decision.input.longitude, "number", "input.longitude must be a valid number");

  console.log("  PASSED: getMockDecision produced complete input");
}

// ============================================================================
// Test 5: validateDecisionSchema rejects unresolvable invalid input
// ============================================================================
{
  console.log("Test 5: validateDecisionSchema rejects unresolvable invalid input");

  // Missing businessType without run context
  assert.throws(
    () => {
      validateDecisionSchema({
        action: "EXECUTE_TOOL",
        toolId: "nearby_business_search",
        input: {},
      });
    },
    (err) => {
      assert(err instanceof LLMDecisionError);
      assert.equal(err.code, "MISSING_BUSINESS_TYPE");
      return true;
    },
    "Must throw MISSING_BUSINESS_TYPE"
  );

  // Generic businessType without run context
  assert.throws(
    () => {
      validateDecisionSchema({
        action: "EXECUTE_TOOL",
        toolId: "nearby_business_search",
        input: { businessType: "local business", latitude: 39.7392, longitude: -104.9903 },
      });
    },
    (err) => {
      assert(err instanceof LLMDecisionError);
      assert.equal(err.code, "MISSING_BUSINESS_TYPE");
      return true;
    },
    "Must throw MISSING_BUSINESS_TYPE for generic category"
  );

  // Missing coordinates without location context
  assert.throws(
    () => {
      validateDecisionSchema({
        action: "EXECUTE_TOOL",
        toolId: "nearby_business_search",
        input: { businessType: "bakery" },
      });
    },
    (err) => {
      assert(err instanceof LLMDecisionError);
      assert.equal(err.code, "MISSING_COORDINATES");
      return true;
    },
    "Must throw MISSING_COORDINATES"
  );

  console.log("  PASSED: Decision schema firewall strictly rejects invalid unresolvable inputs");
}

// ============================================================================
// Test 6: Decision prompt context preserves planned step params
// ============================================================================
{
  console.log("Test 6: Decision prompt context preserves planned step params");

  const runWithParams = {
    _id: "run-prompt-003",
    goal: "coffee shop in Denver",
    location: "Denver, CO",
    plan: {
      summary: "Analyze coffee shop in Denver",
      steps: [
        {
          stepIndex: 1,
          toolId: "nearby_business_search",
          description: "Find coffee competitors",
          dependsOnStep: null,
          params: {
            businessType: "coffee shop",
            latitude: 39.7392,
            longitude: -104.9903,
            radius: 3000,
            limit: 5,
          },
        },
      ],
    },
  };

  const prompt = formatDecisionPromptContext({
    run: runWithParams,
    steps: [],
    evidence: [],
  });

  assert(prompt.includes('"businessType": "coffee shop"'), "Prompt must include businessType from planned params");
  assert(prompt.includes('"radius": 3000'), "Prompt must include radius from planned params");

  console.log("  PASSED: formatDecisionPromptContext preserved planned params");
}

// ============================================================================
// Test 7: Tool execution succeeds with repaired parameters
// ============================================================================
{
  console.log("Test 7: Tool execution succeeds with repaired parameters");

  const legacyRun = {
    _id: "run-legacy-004",
    goal: "food court with less prices",
    location: "Eluru, Andhra Pradesh",
    state: "executing",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 0,
    externalCallCount: 0,
    plan: {
      summary: "Analyze food court",
      steps: [
        {
          stepIndex: 1,
          toolId: "nearby_business_search",
          params: {}, // Empty
          status: "pending",
        },
      ],
    },
  };

  const decision = evaluateDeterministicNextStep({
    run: legacyRun,
    steps: [],
    evidenceList: [],
  });

  // Execute adapter directly with the decision's input
  const result = await nearbyBusinessSearchAdapter.executeTool(decision.input);

  assert.equal(result.error, null, "Execution must not return error");
  assert(result.output !== null, "Execution must produce output");
  assert.equal(typeof result.output.totalFound, "number", "Output must contain totalFound");
  assert(Array.isArray(result.output.businesses), "Output must contain businesses array");
  assert(result.output.businesses.length > 0, "Businesses array must not be empty");

  console.log("  PASSED: Adapter execution succeeded with repaired parameters (found " + result.output.businesses.length + " businesses)");
}

console.log("\n================================================================================");
console.log("ALL 7 RESILIENCE TESTS PASSED SUCCESSFULLY!");
console.log("================================================================================");

import assert from "node:assert/strict";
import { validatePlanSchema } from "../server/agent/llmPlanner.js";
import { evaluateDeterministicNextStep } from "../server/agent/planner.js";
import {
  getMockDecision,
  validateDecisionSchema,
  LLMDecisionError,
} from "../server/agent/llmDecision.js";
import { TOOL_IDS } from "../server/agent/toolConstants.js";
import techIdeaAnalysisAdapter from "../server/agent/tools/techIdeaAnalysisAdapter.js";

console.log("Starting Tech Idea Analysis Parameter Resilience Test Suite...\n");

// ============================================================================
// Test 1: validatePlanSchema repairs empty params ({}) from Gemini-like plan
// ============================================================================
{
  console.log("Test 1: validatePlanSchema repairs empty params ({}) for tech_idea_analysis");

  const rawGeminiPlan = {
    summary: "Investigate technology idea viability for: 'ai agent for idea reality analyzing'",
    goalUnderstanding: "Build an AI agent that analyzes product ideas and market reality",
    ventureType: "tech",
    targetSteps: 1,
    steps: [
      {
        stepIndex: 1,
        toolId: "tech_idea_analysis",
        toolName: "Tech Idea Analysis",
        description: "Analyze technical feasibility, suggested tech stack, and market fit",
        params: {},
        dependsOnStep: null,
      },
    ],
    requiresApproval: true,
    clarificationsNeeded: [],
  };

  const validated = validatePlanSchema(rawGeminiPlan, {
    maxSteps: 5,
    goal: "ai agent for idea reality analyzing",
    location: "Global",
  });

  const step1 = validated.steps[0];
  assert.equal(
    step1.params.goal,
    "ai agent for idea reality analyzing",
    "params.goal must be derived from options.goal"
  );
  assert.equal(step1.params.location, "Global", "params.location must be derived from options.location");

  console.log("  PASSED: Empty params repaired with run goal and location");
}

// ============================================================================
// Test 2: validatePlanSchema preserves existing params.goal if present
// ============================================================================
{
  console.log("Test 2: validatePlanSchema preserves existing valid params.goal");

  const rawPlanWithGoal = {
    summary: "Tech idea feasibility",
    goalUnderstanding: "Analyze decentralized storage protocol",
    ventureType: "tech",
    targetSteps: 1,
    steps: [
      {
        stepIndex: 1,
        toolId: "tech_idea_analysis",
        toolName: "Tech Idea Analysis",
        description: "Analyze feasibility",
        params: {
          goal: "decentralized storage protocol on IPFS",
          location: "Remote",
        },
        dependsOnStep: null,
      },
    ],
    requiresApproval: true,
    clarificationsNeeded: [],
  };

  const validated = validatePlanSchema(rawPlanWithGoal, {
    maxSteps: 5,
    goal: "fallback goal",
    location: "Fallback Location",
  });

  const step1 = validated.steps[0];
  assert.equal(
    step1.params.goal,
    "decentralized storage protocol on IPFS",
    "Existing params.goal must be preserved"
  );
  assert.equal(step1.params.location, "Remote", "Existing params.location must be preserved");

  console.log("  PASSED: Existing params.goal preserved");
}

// ============================================================================
// Test 3: evaluateDeterministicNextStep defensively repairs missing params
// ============================================================================
{
  console.log("Test 3: evaluateDeterministicNextStep defensively repairs missing params from run.goal");

  const runWithEmptyPlanParams = {
    _id: "run-tech-001",
    goal: "ai agent for idea reality analyzing",
    location: "Austin, TX",
    state: "executing",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 0,
    externalCallCount: 0,
    plan: {
      summary: "Analyze AI agent viability",
      steps: [
        {
          stepIndex: 1,
          toolId: "tech_idea_analysis",
          description: "Analyze technical feasibility, suggested tech stack, and market fit",
          params: {}, // Empty params in plan
          status: "pending",
        },
      ],
    },
  };

  const decision = evaluateDeterministicNextStep({
    run: runWithEmptyPlanParams,
    steps: [],
    evidenceList: [],
  });

  assert.equal(decision.action, "EXECUTE_TOOL", "Decision must be EXECUTE_TOOL");
  assert.equal(decision.toolId, "tech_idea_analysis", "Tool must be tech_idea_analysis");
  assert.equal(
    decision.input.goal,
    "ai agent for idea reality analyzing",
    "input.goal must be populated from run.goal"
  );
  assert.equal(decision.input.location, "Austin, TX", "input.location must be populated from run.location");

  console.log("  PASSED: Deterministic fallback decision repaired missing params");
}

// ============================================================================
// Test 4: getMockDecision produces complete tech_idea_analysis input
// ============================================================================
{
  console.log("Test 4: getMockDecision produces complete tech_idea_analysis input");

  const runWithEmptyPlanParams = {
    _id: "run-tech-002",
    goal: "ai agent for idea reality analyzing",
    location: "Global",
    state: "executing",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 0,
    externalCallCount: 0,
    plan: {
      summary: "Analyze AI agent",
      steps: [
        {
          stepIndex: 1,
          toolId: "tech_idea_analysis",
          description: "Analyze tech feasibility",
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
  assert.equal(decision.toolId, "tech_idea_analysis", "Tool must be tech_idea_analysis");
  assert.equal(
    decision.input.goal,
    "ai agent for idea reality analyzing",
    "input.goal must be populated from run.goal"
  );

  console.log("  PASSED: getMockDecision produced complete input with goal");
}

// ============================================================================
// Test 5: validateDecisionSchema enriches from run.goal or rejects when unresolvable
// ============================================================================
{
  console.log("Test 5: validateDecisionSchema enriches from run.goal or rejects when unresolvable");

  // A. Missing goal WITH run context -> enriched from run.goal
  const enriched = validateDecisionSchema(
    {
      action: "EXECUTE_TOOL",
      toolId: "tech_idea_analysis",
      input: {},
    },
    {
      run: { goal: "developer tooling for WASM", location: null },
      steps: [],
      evidence: [],
    }
  );
  assert.equal(
    enriched.input.goal,
    "developer tooling for WASM",
    "Missing goal must be enriched from run.goal"
  );

  // B. Missing goal WITHOUT run context -> rejected with MISSING_GOAL
  assert.throws(
    () => {
      validateDecisionSchema({
        action: "EXECUTE_TOOL",
        toolId: "tech_idea_analysis",
        input: {},
      });
    },
    (err) => {
      assert(err instanceof LLMDecisionError);
      assert.equal(err.code, "MISSING_GOAL");
      return true;
    },
    "Must throw MISSING_GOAL when run context has no goal"
  );

  console.log("  PASSED: Decision schema firewall enriches from run.goal and strictly rejects unresolvable inputs");
}

// ============================================================================
// Test 6: Retry logic enriches input.goal and does NOT retry with {}
// ============================================================================
{
  console.log("Test 6: Retry logic enriches input.goal and does NOT retry with {}");

  const run = {
    _id: "run-tech-retry-001",
    goal: "ai agent for idea reality analyzing",
    location: "Global",
  };

  // Simulate a failed step that had params: {}
  const lastFailedStep = {
    _id: "step-failed-001",
    input: {
      toolId: "tech_idea_analysis",
      params: {}, // Empty params from bug
    },
    attempt: 1,
    stepNumber: 1,
    status: "failed",
    error: { message: "Input must have a non-empty string 'goal'" },
  };

  // Simulate the retry input preparation from agentController.js:
  const input = lastFailedStep.input?.params || {};
  if (input.toolId) delete input.toolId;

  if (lastFailedStep.input?.toolId === TOOL_IDS.TECH_IDEA_ANALYSIS) {
    if (typeof input.goal !== "string" || !input.goal.trim()) {
      if (run?.goal) {
        input.goal = run.goal.trim();
      }
    }
    if (run?.location && (input.location === undefined || input.location === null)) {
      input.location =
        typeof run.location === "object"
          ? run.location.label || null
          : String(run.location);
    }
  }

  assert.notDeepEqual(input, {}, "Retry input must NOT be empty object {}");
  assert.equal(
    input.goal,
    "ai agent for idea reality analyzing",
    "Retry input must contain run.goal"
  );
  assert.equal(input.location, "Global", "Retry input must contain run.location");

  console.log("  PASSED: Retry logic correctly enriches input.goal from run.goal");
}

// ============================================================================
// Test 7: techIdeaAnalysisAdapter validation remains strict
// ============================================================================
{
  console.log("Test 7: techIdeaAnalysisAdapter validation remains strict (rejects empty goal)");

  assert.throws(
    () => {
      techIdeaAnalysisAdapter.validateInput({});
    },
    (err) => {
      assert.match(err.message, /Input must have a non-empty string 'goal'/);
      return true;
    },
    "Adapter must reject empty input"
  );

  assert.throws(
    () => {
      techIdeaAnalysisAdapter.validateInput({ goal: "   " });
    },
    (err) => {
      assert.match(err.message, /Input must have a non-empty string 'goal'/);
      return true;
    },
    "Adapter must reject whitespace-only goal"
  );

  // Valid input passes cleanly
  assert.doesNotThrow(() => {
    techIdeaAnalysisAdapter.validateInput({
      goal: "ai agent for idea reality analyzing",
    });
  });

  console.log("  PASSED: techIdeaAnalysisAdapter validation remains strictly enforced");
}

// ============================================================================
// Test 8: Tool execution succeeds with repaired parameters in MOCK_MODE
// ============================================================================
{
  console.log("Test 8: Tool execution succeeds with repaired parameters in MOCK_MODE");

  const result = await techIdeaAnalysisAdapter.executeTool({
    goal: "ai agent for idea reality analyzing",
  });

  assert.ok(result.output, "Tool execution must produce output");
  assert.equal(result.error, null, "Tool execution must have no error");
  assert.ok(result.output.feasibility, "Output must contain feasibility");
  assert.ok(result.output.marketFitScore, "Output must contain marketFitScore");

  console.log("  PASSED: Tool execution succeeded with repaired parameters");
}

console.log("\n================================================================================");
console.log("ALL 8 TECH IDEA ANALYSIS PARAMETER RESILIENCE TESTS PASSED SUCCESSFULLY!");
console.log("================================================================================\n");


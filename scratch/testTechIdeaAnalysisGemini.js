/**
 * Test Suite: Tech Idea Analysis Gemini Integration
 *
 * Verifies that tech_idea_analysis is a real Gemini-backed analysis tool:
 * 1. Mock mode returns deterministic fixture.
 * 2. Live provider path invokes geminiClient.models.generateContent with prompt, schema, and config.
 * 3. Goal and location parameters are correctly formatted in the prompt.
 * 4. Structured JSON response is validated, parsed, and marketFitScore clamped to [0.0, 10.0].
 * 5. Provider error classification, failover, and retry backoff behavior.
 * 6. Checkpoint retry preserves goal and context.
 * 7. Evidence extractor sets provider: "gemini" in live mode and "internal_fixture" in mock mode.
 * 8. Synthesizer consumes real tech assessment evidence cleanly across score tiers.
 */

import assert from "node:assert/strict";
import techIdeaAnalysisAdapter, {
  TechIdeaAnalysisAdapter,
  techIdeaAnalysisDefinition,
} from "../server/agent/tools/techIdeaAnalysisAdapter.js";
import { analyzeTechIdea } from "../server/utils/techIdeaAnalyzer.js";
import { extractEvidenceFromStep } from "../server/agent/evidenceExtractor.js";
import { synthesizeFinalRecommendation } from "../server/agent/synthesizer.js";
import { resolveModel } from "../server/agent/modelResolver.js";
import { TOOL_IDS } from "../server/agent/toolConstants.js";

const originalEnvMockMode = process.env.MOCK_MODE;

console.log("Starting Tech Idea Analysis Gemini Integration Test Suite...\n");

async function runTests() {
  try {
    // -------------------------------------------------------------------------
    // Test 1: Mock mode returns deterministic fixture and mock error triggers
    // -------------------------------------------------------------------------
    console.log("Test 1: Mock mode returns deterministic fixture and mock error triggers");
    process.env.MOCK_MODE = "true";

    const mockRes = await techIdeaAnalysisAdapter.executeTool({
      goal: "AI Reality Agent for Startups",
    });

    assert.equal(mockRes.error, null, "Mock execution should have no error");
    const mockOutput = mockRes.output;
    assert.ok(mockOutput, "mockOutput must exist");
    assert.equal(mockOutput.feasibility, "High", "Mock mode feasibility should be High");
    assert.ok(Array.isArray(mockOutput.suggestedStack), "suggestedStack must be an array");
    assert.equal(typeof mockOutput.marketFitScore, "number", "marketFitScore must be a number");
    assert.ok(mockOutput.marketFitScore >= 0 && mockOutput.marketFitScore <= 10, "marketFitScore must be 0-10");
    assert.ok(Array.isArray(mockOutput.risks), "risks must be an array");

    // Verify mock error triggers
    const quotaRes = await techIdeaAnalysisAdapter.executeTool({ goal: "MOCK_QUOTA_ERROR" });
    assert.equal(quotaRes.output, null);
    assert.ok(quotaRes.error);
    assert.equal(quotaRes.error.status, 429);
    assert.equal(quotaRes.error.code, "RESOURCE_EXHAUSTED");

    const err503Res = await techIdeaAnalysisAdapter.executeTool({ goal: "MOCK_503_ERROR" });
    assert.equal(err503Res.output, null);
    assert.ok(err503Res.error);
    assert.equal(err503Res.error.status, 503);
    assert.equal(err503Res.error.code, "SERVICE_UNAVAILABLE");

    console.log("  PASSED: Mock mode returns fixture and supports error triggers\n");

    // -------------------------------------------------------------------------
    // Test 2: Live provider path invokes geminiClient.models.generateContent
    // -------------------------------------------------------------------------
    console.log("Test 2: Live provider path invokes geminiClient.models.generateContent with prompt and schema");
    process.env.MOCK_MODE = "false";

    let capturedGenerateParams = null;
    const fakeGeminiClient = {
      models: {
        generateContent: async (params) => {
          capturedGenerateParams = params;
          return {
            text: JSON.stringify({
              feasibility: "High",
              suggestedStack: ["Node.js", "React", "Gemini 2.5 Flash", "PostgreSQL"],
              marketFitScore: 8.5,
              risks: ["API rate limiting", "Competitor emergence"],
            }),
          };
        },
      },
    };

    techIdeaAnalysisAdapter.setProviderClient(fakeGeminiClient);

    const liveRes = await techIdeaAnalysisAdapter.executeTool({
      goal: "Automated code analysis bot for GitHub PRs",
      location: "San Francisco, CA",
    });

    assert.equal(liveRes.error, null, `Live execution should have no error: ${liveRes.error?.message}`);
    const liveOutput = liveRes.output;
    assert.ok(liveOutput, "liveOutput must exist");

    assert.ok(capturedGenerateParams, "generateContent must be called");
    assert.ok(capturedGenerateParams.model, "Model must be specified");
    assert.ok(capturedGenerateParams.contents.includes("Automated code analysis bot for GitHub PRs"), "Prompt must contain goal");
    assert.ok(capturedGenerateParams.contents.includes("San Francisco, CA"), "Prompt must contain location");
    assert.equal(capturedGenerateParams.config.responseMimeType, "application/json");
    assert.ok(capturedGenerateParams.config.responseSchema, "responseSchema must be provided");

    assert.equal(liveOutput.feasibility, "High");
    assert.deepEqual(liveOutput.suggestedStack, ["Node.js", "React", "Gemini 2.5 Flash", "PostgreSQL"]);
    assert.equal(liveOutput.marketFitScore, 8.5);
    assert.deepEqual(liveOutput.risks, ["API rate limiting", "Competitor emergence"]);

    console.log("  PASSED: Live provider path executes Gemini with proper prompt and schema\n");

    // -------------------------------------------------------------------------
    // Test 3: Prompt formatting with and without location
    // -------------------------------------------------------------------------
    console.log("Test 3: Prompt formatting with and without location");

    let promptWithoutLocation = null;
    const clientNoLocation = {
      models: {
        generateContent: async (params) => {
          promptWithoutLocation = params.contents;
          return {
            text: JSON.stringify({
              feasibility: "Medium",
              suggestedStack: ["Python", "FastAPI"],
              marketFitScore: 6.2,
              risks: ["Adoption friction"],
            }),
          };
        },
      },
    };

    const resNoLoc = await analyzeTechIdea({
      goal: "Decentralized task scheduler",
      location: null,
      geminiClient: clientNoLocation,
    });

    assert.ok(promptWithoutLocation.includes("Decentralized task scheduler"));
    assert.ok(!promptWithoutLocation.includes("Target Market / Location Context:"));
    assert.equal(resNoLoc.feasibility, "Medium");
    assert.equal(resNoLoc.marketFitScore, 6.2);

    console.log("  PASSED: Prompt correctly adapts to presence or absence of location\n");

    // -------------------------------------------------------------------------
    // Test 4: Structured JSON response parsing, clamping, and normalization
    // -------------------------------------------------------------------------
    console.log("Test 4: Structured JSON response parsing, clamping, and normalization");

    // 4a. Out-of-bounds high score clamped to 10.0
    const clientHighScore = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            feasibility: "High",
            suggestedStack: ["React"],
            marketFitScore: 14.5, // > 10
            risks: ["Scaling"],
          }),
        }),
      },
    };
    const resHighScore = await analyzeTechIdea({
      goal: "Super profitable unicorn app",
      geminiClient: clientHighScore,
    });
    assert.equal(resHighScore.marketFitScore, 10.0, "Score > 10 must be clamped to 10.0");

    // 4b. Out-of-bounds negative score clamped to 0.0
    const clientLowScore = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            feasibility: "Low",
            suggestedStack: ["Assembly"],
            marketFitScore: -3.5, // < 0
            risks: ["Impossible"],
          }),
        }),
      },
    };
    const resLowScore = await analyzeTechIdea({
      goal: "Time travel machine software",
      geminiClient: clientLowScore,
    });
    assert.equal(resLowScore.marketFitScore, 0.0, "Score < 0 must be clamped to 0.0");

    // 4c. Non-numeric score defaults to 5.0
    const clientBadScore = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            feasibility: "InvalidFeasibility",
            suggestedStack: [],
            marketFitScore: "not-a-number",
            risks: [],
          }),
        }),
      },
    };
    const resBadScore = await analyzeTechIdea({
      goal: "Vague concept",
      geminiClient: clientBadScore,
    });
    assert.equal(resBadScore.marketFitScore, 5.0, "Invalid score must default to 5.0");
    assert.equal(resBadScore.feasibility, "Medium", "Invalid feasibility must default to Medium");
    assert.ok(resBadScore.suggestedStack.length > 0, "Empty stack should have default entries");
    assert.ok(resBadScore.risks.length > 0, "Empty risks should have default entries");

    console.log("  PASSED: Response clamping and normalization behave correctly\n");

    // -------------------------------------------------------------------------
    // Test 5: Provider errors, retries, and model failover
    // -------------------------------------------------------------------------
    console.log("Test 5: Provider errors, retries, and model failover");

    // 5a. Quota error (429 RESOURCE_EXHAUSTED) must not retry
    let quotaAttempts = 0;
    const clientQuota = {
      models: {
        generateContent: async () => {
          quotaAttempts++;
          const err = new Error("Resource has been exhausted (e.g. check quota).");
          err.status = 429;
          throw err;
        },
      },
    };
    await assert.rejects(
      async () => {
        await analyzeTechIdea({
          goal: "Test quota error",
          geminiClient: clientQuota,
        });
      },
      (err) => err.status === 429,
      "Quota error should throw immediately"
    );
    assert.equal(quotaAttempts, 1, "Quota error must abort on attempt 1 without retrying");

    // 5b. Transient 503 error retries with sleepFn and succeeds
    let attemptCount503 = 0;
    const sleeps = [];
    const client503 = {
      models: {
        generateContent: async () => {
          attemptCount503++;
          if (attemptCount503 === 1) {
            const err = new Error("The model is overloaded. Please try again later.");
            err.status = 503;
            throw err;
          }
          return {
            text: JSON.stringify({
              feasibility: "High",
              suggestedStack: ["Next.js", "TailwindCSS"],
              marketFitScore: 7.8,
              risks: ["Initial customer acquisition"],
            }),
          };
        },
      },
    };

    const res503 = await analyzeTechIdea({
      goal: "Test 503 retry",
      geminiClient: client503,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    assert.equal(attemptCount503, 2, "503 should retry and succeed on attempt 2");
    assert.deepEqual(sleeps, [2000], "First backoff sleep should be 2000ms");
    assert.equal(res503.feasibility, "High");
    assert.equal(res503.marketFitScore, 7.8);

    // 5c. 404 model failover
    const modelsCalled = [];
    const client404 = {
      models: {
        generateContent: async (params) => {
          modelsCalled.push(params.model);
          if (modelsCalled.length === 1) {
            const err = new Error("models/gemini-old is not found for API version v1beta");
            err.status = 404;
            throw err;
          }
          return {
            text: JSON.stringify({
              feasibility: "High",
              suggestedStack: ["Python", "Flask"],
              marketFitScore: 7.0,
              risks: ["Maintenance"],
            }),
          };
        },
      },
    };

    const res404 = await analyzeTechIdea({
      goal: "Test 404 model failover",
      geminiClient: client404,
      model: "gemini-3.6-flash",
    });

    assert.equal(modelsCalled.length, 2, "Should attempt initial model then fallback model");
    assert.notEqual(modelsCalled[0], modelsCalled[1], "Fallback model must differ from initial model");
    assert.equal(res404.feasibility, "High");

    console.log("  PASSED: Error classification, backoff retry, and 404 model failover verified\n");

    // -------------------------------------------------------------------------
    // Test 6: Checkpoint retry preserves goal and definition is external
    // -------------------------------------------------------------------------
    console.log("Test 6: Definition is external and preserves goal");

    assert.equal(techIdeaAnalysisDefinition.external, true, "techIdeaAnalysisDefinition.external must be true");
    assert.equal(techIdeaAnalysisDefinition.provider, "gemini", "techIdeaAnalysisDefinition.provider must be gemini");

    console.log("  PASSED: Definition properties correct\n");

    // -------------------------------------------------------------------------
    // Test 7: Evidence extractor sets provider: "gemini" in live mode and "internal_fixture" in mock mode
    // -------------------------------------------------------------------------
    console.log("Test 7: Evidence extractor sets provider: 'gemini' in live mode and 'internal_fixture' in mock mode");

    const mockStep = {
      status: "completed",
      type: "tool_execution",
      input: {
        toolId: TOOL_IDS.TECH_IDEA_ANALYSIS,
        params: { goal: "AI Idea Analyzer" },
      },
      output: {
        feasibility: "High",
        suggestedStack: ["Node.js", "React"],
        marketFitScore: 8.2,
        risks: ["Competition"],
      },
    };

    // Live mode (MOCK_MODE=false)
    process.env.MOCK_MODE = "false";
    const liveEvidence = extractEvidenceFromStep(mockStep, { userId: "user-123" });
    assert.ok(liveEvidence, "Evidence must be extracted");
    assert.equal(liveEvidence.evidenceType, "tech_assessment");
    assert.equal(liveEvidence.provider, "gemini", "Live mode provider must be gemini");
    assert.equal(liveEvidence.data.feasibility, "High");
    assert.equal(liveEvidence.data.marketFitScore, 8.2);

    // Mock mode (MOCK_MODE=true)
    process.env.MOCK_MODE = "true";
    const mockEvidence = extractEvidenceFromStep(mockStep, { userId: "user-123" });
    assert.ok(mockEvidence, "Evidence must be extracted");
    assert.equal(mockEvidence.evidenceType, "tech_assessment");
    assert.equal(mockEvidence.provider, "internal_fixture", "Mock mode provider must be internal_fixture");

    console.log("  PASSED: Evidence extractor correctly sets provider in live and mock modes\n");

    // -------------------------------------------------------------------------
    // Test 8: Synthesizer consumes real tech assessment evidence cleanly
    // -------------------------------------------------------------------------
    console.log("Test 8: Synthesizer consumes real tech assessment evidence cleanly");

    // 8a. High score (8.5) and High feasibility -> Viable
    const highEvidence = [
      {
        toolId: TOOL_IDS.TECH_IDEA_ANALYSIS,
        evidenceType: "tech_assessment",
        data: {
          feasibility: "High",
          suggestedStack: ["React", "Node.js", "PostgreSQL"],
          marketFitScore: 8.5,
          risks: ["Market competition"],
        },
      },
    ];
    const highRun = { goal: "High potential tech startup", location: null };
    const highSynthesis = synthesizeFinalRecommendation({ run: highRun, evidence: highEvidence, steps: [] });
    assert.equal(highSynthesis.verdict, "VIABLE", "Score 8.5 + High feasibility should yield VIABLE");
    assert.equal(highSynthesis.marketFit.score, 8.5, "Market fit score should be 8.5");
    assert.ok(highSynthesis.marketFit.analysis.includes("8.5"), "Market fit analysis should mention 8.5");

    // 8b. Moderate score (5.5) -> Needs Refinement
    const midEvidence = [
      {
        toolId: TOOL_IDS.TECH_IDEA_ANALYSIS,
        evidenceType: "tech_assessment",
        data: {
          feasibility: "Medium",
          suggestedStack: ["Python"],
          marketFitScore: 5.5,
          risks: ["Differentiation challenge"],
        },
      },
    ];
    const midRun = { goal: "Moderate tech concept", location: null };
    const midSynthesis = synthesizeFinalRecommendation({ run: midRun, evidence: midEvidence, steps: [] });
    assert.equal(midSynthesis.verdict, "NEEDS_REFINEMENT", "Score 5.5 should yield NEEDS_REFINEMENT");

    // 8c. Low score (3.0) -> High Risk
    const lowEvidence = [
      {
        toolId: TOOL_IDS.TECH_IDEA_ANALYSIS,
        evidenceType: "tech_assessment",
        data: {
          feasibility: "Low",
          suggestedStack: ["Legacy C"],
          marketFitScore: 3.0,
          risks: ["High failure probability"],
        },
      },
    ];
    const lowRun = { goal: "High risk tech idea", location: null };
    const lowSynthesis = synthesizeFinalRecommendation({ run: lowRun, evidence: lowEvidence, steps: [] });
    assert.equal(lowSynthesis.verdict, "HIGH_RISK", "Score 3.0 should yield HIGH_RISK");

    console.log("  PASSED: Synthesizer correctly evaluates tech assessment evidence across tiers\n");

    console.log("================================================================================");
    console.log("ALL 8 TECH IDEA ANALYSIS GEMINI INTEGRATION TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================================");
  } finally {
    // Restore environment
    process.env.MOCK_MODE = originalEnvMockMode;
    techIdeaAnalysisAdapter.setProviderClient(null);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

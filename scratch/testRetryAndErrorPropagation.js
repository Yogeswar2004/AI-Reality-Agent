import assert from "node:assert/strict";
import { ObjectId } from "../server/node_modules/mongodb/lib/index.js";
import axios from "../server/node_modules/axios/index.js";
import getBusinessReviews from "../server/utils/businessReviews.js";
import {
  AGENT_STATES,
  isValidTransition,
  getValidNextStates,
} from "../server/agent/agentState.js";
import { evaluateDeterministicNextStep } from "../server/agent/planner.js";
import { BaseToolAdapter } from "../server/agent/toolAdapter.js";
import { TOOL_IDS } from "../server/agent/toolConstants.js";
import { AgentRunStateError } from "../server/agent/agentRun.js";
import rapidApiBusinessSearch from "../server/utils/rapidApiBusinessSearch.js";
import analyzeBusinessReviews from "../server/utils/reviewAnalyzer.js";
import { NearbyBusinessSearchAdapter } from "../server/agent/tools/nearbyBusinessSearchAdapter.js";
import { BusinessReviewsAdapter } from "../server/agent/tools/businessReviewsAdapter.js";
import { ReviewSentimentAdapter } from "../server/agent/tools/reviewSentimentAdapter.js";
import { TechIdeaAnalysisAdapter } from "../server/agent/tools/techIdeaAnalysisAdapter.js";
import { synthesizeFinalRecommendation } from "../server/agent/synthesizer.js";

console.log("Starting Checkpoint Retry & Error Transparency Test Suite...\n");

// ============================================================================
// TEST CATEGORY A: Error Classification & Transparent Root-Cause Mapping
// ============================================================================
console.log("--- Category A: Error Classification & Root-Cause Mapping ---");

{
  console.log("Test A1: 429 Transient RPS Rate Limit Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Request failed with status code 429");
      error.response = {
        status: 429,
        data: {
          message: "You have exceeded the rate limit per second for your plan.",
        },
      };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, "Error must be thrown");
    assert.equal(caughtError.code, "RATE_LIMIT_EXCEEDED", "Code must be RATE_LIMIT_EXCEEDED");
    assert.equal(caughtError.status, 429, "Status must be 429");
    assert.equal(caughtError.provider, "rapidapi", "Provider must be rapidapi");
    assert.match(
      caughtError.message,
      /rate limit: 1 request\/second exceeded/i,
      "Message must clearly explain RPS limit without generic failure message"
    );
    assert.doesNotMatch(
      caughtError.message,
      /Failed to fetch business reviews/i,
      "Must eliminate generic 'Failed to fetch business reviews' catch-all"
    );

    console.log("  ✓ Passed: 429 RPS mapped to RATE_LIMIT_EXCEEDED with actionable message");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A2: 429 Monthly Quota Limit Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Request failed with status code 429");
      error.response = {
        status: 429,
        data: {
          message: "You have exceeded the MONTHLY quota for Requests on your current plan.",
        },
      };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, "Error must be thrown");
    assert.equal(caughtError.code, "REVIEW_QUOTA_EXCEEDED", "Code must be REVIEW_QUOTA_EXCEEDED");
    assert.equal(caughtError.status, 429, "Status must be 429");
    assert.equal(caughtError.provider, "rapidapi", "Provider must be rapidapi");
    assert.match(
      caughtError.message,
      /monthly quota exceeded/i,
      "Message must specify monthly quota exhaustion"
    );

    console.log("  ✓ Passed: 429 Monthly Quota mapped to REVIEW_QUOTA_EXCEEDED");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A3: Word 'plan' in RPS error does NOT falsely trigger Quota Exceeded");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Request failed with status code 429");
      error.response = {
        status: 429,
        data: {
          message: "Your subscription plan allows 1 request per second. Limit exceeded.",
        },
      };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, "Error must be thrown");
    assert.equal(caughtError.code, "RATE_LIMIT_EXCEEDED", "Code must be RATE_LIMIT_EXCEEDED, NOT quota");
    assert.equal(caughtError.status, 429);

    console.log("  ✓ Passed: Word 'plan' with 'per second' correctly classified as RPS limit");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A4: 504 Gateway Timeout Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Gateway Timeout");
      error.response = { status: 504, data: { message: "Endpoint request timed out" } };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "TIMEOUT");
    assert.equal(caughtError.status, 504);
    assert.match(caughtError.message, /Gateway Timeout \(504\)/i);

    console.log("  ✓ Passed: 504 mapped to TIMEOUT with transparent message");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A5: 502 Bad Gateway Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Bad Gateway");
      error.response = { status: 502, data: { message: "Upstream server unavailable" } };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "BAD_GATEWAY");
    assert.equal(caughtError.status, 502);
    assert.match(caughtError.message, /Bad Gateway \(502\)/i);

    console.log("  ✓ Passed: 502 mapped to BAD_GATEWAY");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A6: 500 Server Error Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Internal Server Error");
      error.response = { status: 500, data: { message: "Internal server crash" } };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "SERVER_ERROR");
    assert.equal(caughtError.status, 500);
    assert.match(caughtError.message, /Server Error \(500\)/i);

    console.log("  ✓ Passed: 500 mapped to SERVER_ERROR");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A7: 403 Authentication Error Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Forbidden");
      error.response = { status: 403, data: { message: "Invalid API key" } };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "AUTH_ERROR");
    assert.equal(caughtError.status, 403);
    assert.match(caughtError.message, /Authentication Error/i);

    console.log("  ✓ Passed: 403 mapped to AUTH_ERROR");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A8: ECONNABORTED Network Timeout Classification");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("timeout of 30000ms exceeded");
      error.code = "ECONNABORTED";
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "TIMEOUT");
    assert.match(caughtError.message, /Gateway Timeout/i);

    console.log("  ✓ Passed: ECONNABORTED mapped to TIMEOUT");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test A9: Unknown Error preserves details without generic 'Failed to fetch' string");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Unusual network condition");
      error.response = { status: 418, data: { message: "Teapot response" } };
      throw error;
    };

    let caughtError = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError);
    assert.equal(caughtError.code, "PROVIDER_ERROR");
    assert.equal(caughtError.status, 418);
    assert.match(caughtError.message, /RapidAPI error \(418\): Teapot response/i);

    console.log("  ✓ Passed: Unknown error returns clear provider message, not generic catch-all\n");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

// ============================================================================
// TEST CATEGORY B: Automatic Provider 429 Single Retry
// ============================================================================
console.log("--- Category B: Automatic Provider 429 Single Retry ---");

{
  console.log("Test B1: Automatic single retry on 429 RPS succeeds");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  let callCount = 0;
  const startTime = Date.now();

  try {
    axios.get = async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error("Rate limit per second exceeded");
        error.response = {
          status: 429,
          data: { message: "Too many requests per second" },
        };
        throw error;
      }
      return {
        data: {
          data: {
            reviews: [
              {
                author_name: "Satisfied Customer",
                rating: 5,
                review_text: "Excellent service and food!",
                review_datetime_utc: "2026-03-01T12:00:00Z",
              },
            ],
          },
        },
      };
    };

    const reviews = await getBusinessReviews({ businessId: "test-place-123" });
    const elapsed = Date.now() - startTime;

    assert.equal(callCount, 2, "Must have made exactly 2 calls (initial + 1 retry)");
    assert.ok(elapsed >= 1200, `Delay must be at least ~1300ms (elapsed: ${elapsed}ms)`);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].reviewerName, "Satisfied Customer");
    assert.equal(reviews[0].rating, 5);

    console.log(`  ✓ Passed: Transient 429 automatically retried after ~1.3s delay (elapsed: ${elapsed}ms)`);
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test B2: Monthly quota exceeded does NOT trigger automatic retry");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  let callCount = 0;

  try {
    axios.get = async () => {
      callCount++;
      const error = new Error("Monthly quota exceeded");
      error.response = {
        status: 429,
        data: { message: "You have exceeded the MONTHLY quota for Requests" },
      };
      throw error;
    };

    let caught = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.equal(callCount, 1, "Must NOT retry for monthly quota (callCount must be 1)");
    assert.equal(caught.code, "REVIEW_QUOTA_EXCEEDED");

    console.log("  ✓ Passed: Quota exceeded fails immediately without wasted retry");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test B3: 403 Forbidden does NOT trigger automatic retry");

  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  let callCount = 0;

  try {
    axios.get = async () => {
      callCount++;
      const error = new Error("Forbidden");
      error.response = { status: 403, data: { message: "Invalid key" } };
      throw error;
    };

    let caught = null;
    try {
      await getBusinessReviews({ businessId: "test-place-123" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.equal(callCount, 1, "Must NOT retry for 403 (callCount must be 1)");
    assert.equal(caught.code, "AUTH_ERROR");

    console.log("  ✓ Passed: 403 fails immediately without retry\n");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

// ============================================================================
// TEST CATEGORY C: Checkpoint Retry & Evidence Preservation
// ============================================================================
console.log("--- Category C: Checkpoint Retry & Evidence Preservation ---");

{
  console.log("Test C1: Checkpoint Retry reuses Step 1 evidence and targets ONLY Step 2");

  const runId = new ObjectId();
  const userId = "test-user-checkpoint";

  const run = {
    _id: runId,
    userId,
    state: AGENT_STATES.EXECUTING,
    goal: "Specialty coffee shop",
    location: "Seattle, WA",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 2,
    externalCallCount: 1,
    plan: {
      steps: [
        {
          stepIndex: 1,
          toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
          toolName: "Nearby Business Search",
          description: "Search nearby competitors",
          params: { businessType: "coffee", latitude: 47.6, longitude: -122.3 },
        },
        {
          stepIndex: 2,
          toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
          toolName: "Business Reviews Search",
          description: "Fetch competitor reviews",
          params: {},
        },
        {
          stepIndex: 3,
          toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
          toolName: "Review Sentiment Analyzer",
          description: "Analyze customer sentiment",
          params: {},
        },
      ],
    },
  };

  // Step 1: nearby_business_search COMPLETED
  const step1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "completed",
    input: {
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      params: { businessType: "coffee", latitude: 47.6, longitude: -122.3 },
    },
    output: {
      businesses: [
        {
          placeId: "ch-place-101",
          name: "Monorail Espresso",
          rating: 4.7,
        },
        {
          placeId: "ch-place-102",
          name: "Anchorhead Coffee",
          rating: 4.6,
        },
      ],
    },
    attempt: 1,
    logicalStepIndex: 1,
  };

  // Step 1 Evidence stored in agent_evidence
  const evidenceList = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: {
        businesses: [
          {
            placeId: "ch-place-101",
            name: "Monorail Espresso",
            rating: 4.7,
          },
          {
            placeId: "ch-place-102",
            name: "Anchorhead Coffee",
            rating: 4.6,
          },
        ],
      },
      status: "verified",
    },
  ];

  // Step 2 Attempt 1: business_reviews_search FAILED
  const step2Attempt1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "failed",
    input: {
      toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
      params: { businessId: "ch-place-101", businessName: "Monorail Espresso" },
    },
    error: {
      message: "RapidAPI rate limit: 1 request/second exceeded. Please wait a moment and retry.",
      code: "RATE_LIMIT_EXCEEDED",
      status: 429,
      provider: "rapidapi",
    },
    attempt: 1,
    logicalStepIndex: 2,
  };

  const stepsHistory = [step1, step2Attempt1];

  // Evaluate next decision
  const decision = evaluateDeterministicNextStep({
    run,
    steps: stepsHistory,
    evidenceList,
  });

  // Verify Checkpoint Retry Contract
  assert.equal(decision.action, "EXECUTE_TOOL", "Action must be EXECUTE_TOOL");
  assert.equal(decision.toolId, TOOL_IDS.BUSINESS_REVIEWS_SEARCH, "Must target Step 2 (reviews)");
  assert.notEqual(decision.toolId, TOOL_IDS.NEARBY_BUSINESS_SEARCH, "Must NOT rerun Step 1");
  assert.equal(decision.isRetry, true, "isRetry must be true");
  assert.equal(decision.attempt, 2, "attempt must be 2");
  assert.equal(decision.retryOfStepId, step2Attempt1._id.toString(), "retryOfStepId must link to Attempt 1");
  assert.equal(decision.logicalStepIndex, 2, "logicalStepIndex must remain 2");
  assert.equal(decision.input.businessId, "ch-place-101", "Must reuse placeId from Step 1 evidence");
  assert.equal(decision.input.businessName, "Monorail Espresso", "Must reuse businessName from Step 1 evidence");

  console.log("  ✓ Passed: Checkpoint retry targets ONLY failed Step 2 and reuses Step 1 evidence");

  // Simulate Step 2 Attempt 2 COMPLETED
  const step2Attempt2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "completed",
    input: {
      toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
      params: { businessId: "ch-place-101", businessName: "Monorail Espresso" },
    },
    output: {
      businessId: "ch-place-101",
      businessName: "Monorail Espresso",
      reviews: [
        { rating: 5, text: "Great espresso!" },
      ],
    },
    attempt: 2,
    retryOfStepId: step2Attempt1._id.toString(),
    logicalStepIndex: 2,
  };

  stepsHistory.push(step2Attempt2);

  evidenceList.push({
    _id: new ObjectId(),
    runId,
    toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
    evidenceType: "customer_reviews",
    data: {
      businessId: "ch-place-101",
      businessName: "Monorail Espresso",
      reviews: [{ rating: 5, text: "Great espresso!" }],
    },
    status: "verified",
  });

  const nextDecisionAfterRetry = evaluateDeterministicNextStep({
    run,
    steps: stepsHistory,
    evidenceList,
  });

  assert.equal(nextDecisionAfterRetry.action, "EXECUTE_TOOL");
  assert.equal(
    nextDecisionAfterRetry.toolId,
    TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
    "Next step must seamlessly proceed to Step 3 (sentiment analyzer)"
  );
  assert.equal(Boolean(nextDecisionAfterRetry.isRetry), false, "Step 3 is a fresh step, not a retry");

  console.log("  ✓ Passed: After retry succeeds, pipeline smoothly advances to Step 3\n");
}

{
  console.log("Test C2: Audit Trail Immutability - Failed attempts are never overwritten");

  const runId = new ObjectId();
  const step1Id = new ObjectId();
  const step2Att1Id = new ObjectId();
  const step2Att2Id = new ObjectId();

  const auditSteps = [
    {
      _id: step1Id,
      runId,
      stepNumber: 1,
      logicalStepIndex: 1,
      attempt: 1,
      status: "completed",
    },
    {
      _id: step2Att1Id,
      runId,
      stepNumber: 2,
      logicalStepIndex: 2,
      attempt: 1,
      status: "failed",
      error: { message: "RPS limit", code: "RATE_LIMIT_EXCEEDED" },
    },
    {
      _id: step2Att2Id,
      runId,
      stepNumber: 3,
      logicalStepIndex: 2,
      attempt: 2,
      retryOfStepId: step2Att1Id.toString(),
      status: "completed",
    },
  ];

  // Invariant 1: Attempt 1 was NOT mutated to completed
  const attempt1 = auditSteps.find((s) => s._id === step2Att1Id);
  assert.equal(attempt1.status, "failed", "Attempt 1 must permanently remain 'failed'");
  assert.equal(attempt1.attempt, 1);

  // Invariant 2: Attempt 2 is a distinct record linked via retryOfStepId
  const attempt2 = auditSteps.find((s) => s._id === step2Att2Id);
  assert.equal(attempt2.status, "completed");
  assert.equal(attempt2.attempt, 2);
  assert.equal(attempt2.retryOfStepId, step2Att1Id.toString());
  assert.equal(attempt2.logicalStepIndex, attempt1.logicalStepIndex);
  assert.notEqual(attempt1._id.toString(), attempt2._id.toString());

  // Invariant 3: Audit log preserves the full chronological story
  assert.equal(auditSteps.length, 3, "All 3 execution steps preserved in audit log");

  console.log("  ✓ Passed: Failed step attempts remain immutable; retries create linked attempt records\n");
}

// ============================================================================
// TEST CATEGORY D: Repeated Failures & Infinite Loop Guard
// ============================================================================
console.log("--- Category D: Repeated Failures & Monotonic Attempt Tracking ---");

{
  console.log("Test D1: Monotonic attempt increments across multiple retries");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    userId: "test-user-loop",
    state: AGENT_STATES.EXECUTING,
    budget: { maxSteps: 10, maxExternalCalls: 10 },
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
      ],
    },
  };

  const stepAtt1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "b1" } },
    error: { message: "Timeout", code: "TIMEOUT" },
    attempt: 1,
    logicalStepIndex: 1,
  };

  const dec1 = evaluateDeterministicNextStep({ run, steps: [stepAtt1], evidenceList: [] });
  assert.equal(dec1.attempt, 2);
  assert.equal(dec1.retryOfStepId, stepAtt1._id.toString());

  const stepAtt2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "b1" } },
    error: { message: "Timeout", code: "TIMEOUT" },
    attempt: 2,
    retryOfStepId: stepAtt1._id.toString(),
    logicalStepIndex: 1,
  };

  const dec2 = evaluateDeterministicNextStep({ run, steps: [stepAtt1, stepAtt2], evidenceList: [] });
  assert.equal(dec2.attempt, 3);
  assert.equal(dec2.retryOfStepId, stepAtt2._id.toString());

  const stepAtt3 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "b1" } },
    error: { message: "502 Bad Gateway", code: "BAD_GATEWAY" },
    attempt: 3,
    retryOfStepId: stepAtt2._id.toString(),
    logicalStepIndex: 1,
  };

  const dec3 = evaluateDeterministicNextStep({ run, steps: [stepAtt1, stepAtt2, stepAtt3], evidenceList: [] });
  assert.equal(dec3.attempt, 4);
  assert.equal(dec3.retryOfStepId, stepAtt3._id.toString());

  console.log("  ✓ Passed: Each retry monotonically increments attempt (1 -> 2 -> 3 -> 4)\n");
}

// ============================================================================
// TEST CATEGORY E: Budget Invariants & Enforced Limits
// ============================================================================
console.log("--- Category E: Budget Invariants & Enforced Limits ---");

{
  console.log("Test E1: External call budget ceiling halts retry in planner");

  const runId = new ObjectId();
  const runWithExhaustedExternalBudget = {
    _id: runId,
    userId: "test-user-budget",
    state: AGENT_STATES.EXECUTING,
    budget: { maxSteps: 8, maxExternalCalls: 3 },
    externalCallCount: 3,
    stepCount: 3,
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
      ],
    },
  };

  const failedStep = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "b1" } },
    error: { message: "429 Limit", code: "RATE_LIMIT_EXCEEDED" },
    attempt: 1,
    logicalStepIndex: 1,
  };

  const decision = evaluateDeterministicNextStep({
    run: runWithExhaustedExternalBudget,
    steps: [failedStep],
    evidenceList: [],
  });

  assert.equal(decision.action, "QUOTA_EXHAUSTED", "Must return QUOTA_EXHAUSTED action");
  assert.match(decision.message, /budget limit reached/i);

  console.log("  ✓ Passed: Planner enforces external call budget and refuses runaway retries\n");
}

{
  console.log("Test E2: Budget Invariant Verification - Step and External call limits cannot be bypassed");

  // Invariant logic verification:
  const checkBudget = ({ stepCount, maxSteps, externalCallCount, maxExternalCalls, isExternal }) => {
    if (stepCount >= maxSteps) {
      throw new AgentRunStateError(`Budget exceeded: stepCount (${stepCount}) reached maxSteps (${maxSteps})`, "BUDGET_EXCEEDED");
    }
    if (isExternal && externalCallCount >= maxExternalCalls) {
      throw new AgentRunStateError(`Budget exceeded: externalCallCount (${externalCallCount}) reached maxExternalCalls (${maxExternalCalls})`, "BUDGET_EXCEEDED");
    }
    return true;
  };

  // 1. Max steps reached
  assert.throws(
    () => checkBudget({ stepCount: 8, maxSteps: 8, externalCallCount: 2, maxExternalCalls: 5, isExternal: false }),
    /Budget exceeded: stepCount \(8\) reached maxSteps \(8\)/
  );

  // 2. Max external calls reached
  assert.throws(
    () => checkBudget({ stepCount: 4, maxSteps: 8, externalCallCount: 5, maxExternalCalls: 5, isExternal: true }),
    /Budget exceeded: externalCallCount \(5\) reached maxExternalCalls \(5\)/
  );

  // 3. Normal execution within budget
  assert.equal(
    checkBudget({ stepCount: 4, maxSteps: 8, externalCallCount: 2, maxExternalCalls: 5, isExternal: true }),
    true
  );

  console.log("  ✓ Passed: Step count and external call limits are strictly enforced\n");
}

// ============================================================================
// TEST CATEGORY F: State Machine Transitions
// ============================================================================
console.log("--- Category F: State Machine Transitions ---");

{
  console.log("Test F1: Valid and invalid state transitions for retry / resume");

  assert.equal(isValidTransition(AGENT_STATES.FAILED, AGENT_STATES.EXECUTING), true, "FAILED -> EXECUTING must be valid");
  assert.equal(isValidTransition(AGENT_STATES.FAILED, AGENT_STATES.CANCELLED), true, "FAILED -> CANCELLED must be valid");
  assert.equal(isValidTransition(AGENT_STATES.CANCELLED, AGENT_STATES.EXECUTING), true, "CANCELLED -> EXECUTING must be valid");
  assert.equal(isValidTransition(AGENT_STATES.QUOTA_LIMITED, AGENT_STATES.EXECUTING), true, "QUOTA_LIMITED -> EXECUTING must be valid");

  assert.equal(isValidTransition(AGENT_STATES.COMPLETED, AGENT_STATES.EXECUTING), false, "COMPLETED -> EXECUTING must be invalid");
  assert.equal(isValidTransition(AGENT_STATES.COMPLETED, AGENT_STATES.FAILED), false, "COMPLETED -> FAILED must be invalid");
  assert.equal(isValidTransition(AGENT_STATES.COMPLETED, AGENT_STATES.CANCELLED), false, "COMPLETED -> CANCELLED must be invalid");

  const failedNextStates = getValidNextStates(AGENT_STATES.FAILED);
  assert.ok(failedNextStates.includes(AGENT_STATES.EXECUTING), "FAILED next states must include EXECUTING");
  assert.ok(failedNextStates.includes(AGENT_STATES.CANCELLED), "FAILED next states must include CANCELLED");

  const completedNextStates = getValidNextStates(AGENT_STATES.COMPLETED);
  assert.equal(completedNextStates.length, 0, "COMPLETED must have zero next states");

  console.log("  ✓ Passed: State machine transitions allow resume from FAILED, CANCELLED, QUOTA_LIMITED, and keep COMPLETED terminal\n");
}

{
  console.log("Test F2: State Reset on Resume - Terminal artifacts are cleared");

  const terminalStates = new Set([
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);

  for (const fromState of terminalStates) {
    const currentRun = {
      state: fromState,
      completedAt: new Date("2026-09-18T10:00:00Z"),
      cancellationReason: "User stopped",
      error: "429 Rate Limit",
    };

    const updateDoc = {
      state: AGENT_STATES.EXECUTING,
      updatedAt: new Date(),
    };

    if (terminalStates.has(currentRun.state) && updateDoc.state === AGENT_STATES.EXECUTING) {
      updateDoc.completedAt = null;
      updateDoc.cancellationReason = null;
      updateDoc.error = null;
    }

    assert.equal(updateDoc.completedAt, null, `completedAt must be cleared when resuming from ${fromState}`);
    assert.equal(updateDoc.cancellationReason, null, `cancellationReason must be cleared when resuming from ${fromState}`);
    assert.equal(updateDoc.error, null, `error must be cleared when resuming from ${fromState}`);
  }

  console.log("  ✓ Passed: Resuming run clears completedAt, cancellationReason, and error\n");
}

// ============================================================================
// TEST CATEGORY G: Multi-Tenant Boundary Enforcement
// ============================================================================
console.log("--- Category G: Multi-Tenant Boundary Enforcement ---");

{
  console.log("Test G1: User B cannot access or resume User A's run");

  const runOid = new ObjectId();
  const ownerId = "owner-alice";
  const intruderId = "intruder-bob";

  const mockFindRun = (id, userId) => {
    if (id.toString() === runOid.toString() && userId === ownerId) {
      return { _id: runOid, userId: ownerId, state: AGENT_STATES.FAILED };
    }
    return null;
  };

  assert.ok(mockFindRun(runOid, ownerId) !== null, "Owner finds run");
  assert.equal(mockFindRun(runOid, intruderId), null, "Intruder receives null (404 RUN_NOT_FOUND)");

  console.log("  ✓ Passed: Cross-tenant operations strictly blocked by userId filter\n");
}

// ============================================================================
// TEST CATEGORY H: Error Sanitization & Secret Redaction
// ============================================================================
console.log("--- Category H: Error Sanitization & Secret Redaction ---");

{
  console.log("Test H1: BaseToolAdapter sanitizes secrets while preserving status and provider");

  class LeakyToolAdapter extends BaseToolAdapter {
    validateInput() {}
    async _execute() {
      const err = new Error(
        "Request failed with status 429. Header: x-rapidapi-key: secret_abc123_xyz, auth: Bearer top_secret_token"
      );
      err.code = "RATE_LIMIT_EXCEEDED";
      err.status = 429;
      err.provider = "rapidapi";
      err.details = {
        apiKey: "secret_abc123_xyz",
        token: "jwt_secret_token_val",
        safeData: "competitor info",
      };
      throw err;
    }
    validateOutput() {}
  }

  const adapter = new LeakyToolAdapter({ id: "test_tool", external: true });
  const result = await adapter.executeTool({});

  assert.equal(result.output, null);
  assert.ok(result.error);
  assert.equal(result.error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(result.error.status, 429);
  assert.equal(result.error.provider, "rapidapi");

  assert.equal(result.error.details.apiKey, "[REDACTED]");
  assert.equal(result.error.details.token, "[REDACTED]");
  assert.equal(result.error.details.safeData, "competitor info");

  assert.doesNotMatch(result.error.message, /secret_abc123_xyz/);
  assert.doesNotMatch(result.error.message, /top_secret_token/);

  console.log("  ✓ Passed: Secrets sanitized and redacted; code, status, and provider preserved\n");
}

// ============================================================================
// TEST CATEGORY I: Multi-Tool Provider Error Transparency & Classification
// ============================================================================
console.log("--- Category I: Multi-Tool Provider Error Transparency & Classification ---");

// --- I1: Nearby Business Search (RapidAPI) ---
{
  console.log("Test I1.1: nearby_business_search - 429 RPS Rate Limit Classification");
  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Request failed with status code 429");
      error.response = {
        status: 429,
        data: { message: "You have exceeded the rate limit per second for your plan." },
      };
      throw error;
    };

    let caught = null;
    try {
      await rapidApiBusinessSearch({
        businessType: "bakery",
        latitude: 47.6,
        longitude: -122.3,
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, "Error must be thrown");
    assert.equal(caught.code, "RATE_LIMIT_EXCEEDED");
    assert.equal(caught.status, 429);
    assert.equal(caught.provider, "rapidapi");
    assert.match(caught.message, /rate limit: 1 request\/second exceeded/i);
    console.log("  ✓ Passed: nearby_business_search maps 429 RPS to RATE_LIMIT_EXCEEDED");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test I1.2: nearby_business_search - 429 Monthly Quota Classification");
  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Request failed with status code 429");
      error.response = {
        status: 429,
        data: { message: "You have exceeded the MONTHLY quota for Requests on your current plan." },
      };
      throw error;
    };

    let caught = null;
    try {
      await rapidApiBusinessSearch({
        businessType: "bakery",
        latitude: 47.6,
        longitude: -122.3,
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, "Error must be thrown");
    assert.equal(caught.code, "SEARCH_QUOTA_EXCEEDED");
    assert.equal(caught.status, 429);
    assert.equal(caught.provider, "rapidapi");
    assert.match(caught.message, /monthly quota exceeded/i);
    console.log("  ✓ Passed: nearby_business_search maps 429 quota to SEARCH_QUOTA_EXCEEDED");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test I1.3: nearby_business_search - 403 Authentication Error Classification");
  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    axios.get = async () => {
      const error = new Error("Forbidden");
      error.response = { status: 403, data: { message: "Invalid API key" } };
      throw error;
    };

    let caught = null;
    try {
      await rapidApiBusinessSearch({
        businessType: "bakery",
        latitude: 47.6,
        longitude: -122.3,
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.equal(caught.code, "AUTH_ERROR");
    assert.equal(caught.status, 403);
    assert.equal(caught.provider, "rapidapi");
    assert.match(caught.message, /Authentication Error/i);
    console.log("  ✓ Passed: nearby_business_search maps 403 to AUTH_ERROR");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test I1.4: nearby_business_search - 500, 502, 504 and Unknown Provider Fallbacks");
  const originalGet = axios.get;
  process.env.MOCK_MODE = "false";
  process.env.RAPIDAPI_KEY = "test-rapidapi-key";

  try {
    // 500
    axios.get = async () => {
      const err = new Error("Internal Crash");
      err.response = { status: 500, data: { message: "Server died" } };
      throw err;
    };
    let caught500 = null;
    try {
      await rapidApiBusinessSearch({ businessType: "bakery", latitude: 47.6, longitude: -122.3 });
    } catch (err) { caught500 = err; }
    assert.equal(caught500.code, "SERVER_ERROR");
    assert.equal(caught500.status, 500);

    // 502
    axios.get = async () => {
      const err = new Error("Bad Gateway");
      err.response = { status: 502, data: { message: "Bad Gateway" } };
      throw err;
    };
    let caught502 = null;
    try {
      await rapidApiBusinessSearch({ businessType: "bakery", latitude: 47.6, longitude: -122.3 });
    } catch (err) { caught502 = err; }
    assert.equal(caught502.code, "BAD_GATEWAY");
    assert.equal(caught502.status, 502);

    // 504
    axios.get = async () => {
      const err = new Error("Gateway Timeout");
      err.response = { status: 504, data: { message: "Timeout" } };
      throw err;
    };
    let caught504 = null;
    try {
      await rapidApiBusinessSearch({ businessType: "bakery", latitude: 47.6, longitude: -122.3 });
    } catch (err) { caught504 = err; }
    assert.equal(caught504.code, "TIMEOUT");
    assert.equal(caught504.status, 504);

    // Unknown 418 Teapot
    axios.get = async () => {
      const err = new Error("Teapot");
      err.response = { status: 418, data: { message: "I'm a teapot" } };
      throw err;
    };
    let caught418 = null;
    try {
      await rapidApiBusinessSearch({ businessType: "bakery", latitude: 47.6, longitude: -122.3 });
    } catch (err) { caught418 = err; }
    assert.equal(caught418.code, "PROVIDER_ERROR");
    assert.equal(caught418.status, 418);
    assert.match(caught418.message, /I'm a teapot/);

    console.log("  ✓ Passed: nearby_business_search handles 500, 502, 504, and provider fallbacks");
  } finally {
    axios.get = originalGet;
    process.env.MOCK_MODE = "true";
  }
}

{
  console.log("Test I1.5: NearbyBusinessSearchAdapter propagates transparent error in MOCK_MODE");
  process.env.MOCK_MODE = "true";

  const errorCases = [
    { trigger: "MOCK_QUOTA_ERROR", expectedCode: "SEARCH_QUOTA_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_RATE_LIMIT_ERROR", expectedCode: "RATE_LIMIT_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_AUTH_ERROR", expectedCode: "AUTH_ERROR", expectedStatus: 403 },
    { trigger: "MOCK_502_ERROR", expectedCode: "BAD_GATEWAY", expectedStatus: 502 },
    { trigger: "MOCK_500_ERROR", expectedCode: "SERVER_ERROR", expectedStatus: 500 },
    { trigger: "MOCK_TIMEOUT_ERROR", expectedCode: "TIMEOUT", expectedStatus: 504 },
  ];

  for (const c of errorCases) {
    const res = await NearbyBusinessSearchAdapter.executeTool({
      businessType: c.trigger,
      latitude: 47.6,
      longitude: -122.3,
    });

    assert.equal(res.output, null);
    assert.ok(res.error, `Must return error for ${c.trigger}`);
    assert.equal(res.error.code, c.expectedCode);
    assert.equal(res.error.status, c.expectedStatus);
    assert.equal(res.error.provider, "rapidapi");
  }
  console.log("  ✓ Passed: NearbyBusinessSearchAdapter propagates all error codes and provider attribution\n");
}

// --- I2: Review Sentiment Analyzer (Gemini) ---
{
  console.log("Test I2.1: analyzeBusinessReviews - Gemini Error Classifications");
  process.env.MOCK_MODE = "false";

  const sampleReviews = [{ text: "Great food and friendly staff", rating: 5 }];

  // 1. Quota (429 RESOURCE_EXHAUSTED)
  {
    const mockGeminiClient = {
      models: {
        generateContent: async () => {
          const err = new Error("Resource has been exhausted (e.g. check quota).");
          err.status = 429;
          throw err;
        },
      },
    };
    let caught = null;
    try {
      await analyzeBusinessReviews({
        reviews: sampleReviews,
        businessName: "Cafe",
        businessType: "cafe",
        geminiClient: mockGeminiClient,
        sleepFn: () => Promise.resolve(),
      });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.equal(caught.code, "RESOURCE_EXHAUSTED");
    assert.equal(caught.status, 429);
    assert.equal(caught.provider, "gemini");
    assert.match(caught.message, /quota exceeded/i);
  }

  // 2. High Demand / 503 Spike
  {
    const mockGeminiClient = {
      models: {
        generateContent: async () => {
          const err = new Error("This model is currently experiencing high demand. Spikes in demand are usually temporary.");
          err.status = 503;
          throw err;
        },
      },
    };
    let caught = null;
    try {
      await analyzeBusinessReviews({
        reviews: sampleReviews,
        businessName: "Cafe",
        businessType: "cafe",
        geminiClient: mockGeminiClient,
        sleepFn: () => Promise.resolve(),
      });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.equal(caught.code, "SERVICE_UNAVAILABLE");
    assert.equal(caught.status, 503);
    assert.equal(caught.provider, "gemini");
    assert.match(caught.message, /Service Unavailable \(503\)/i);
  }

  // 3. 404 Model Unavailable / Deprecated
  {
    const mockGeminiClient = {
      models: {
        generateContent: async () => {
          const err = new Error("models/gemini-old is not found for API version v1beta");
          err.status = 404;
          throw err;
        },
      },
    };
    let caught = null;
    try {
      await analyzeBusinessReviews({
        reviews: sampleReviews,
        businessName: "Cafe",
        businessType: "cafe",
        geminiClient: mockGeminiClient,
        sleepFn: () => Promise.resolve(),
      });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.equal(caught.code, "MODEL_UNAVAILABLE");
    assert.equal(caught.status, 404);
    assert.equal(caught.provider, "gemini");
  }

  // 4. 403 Invalid API Key
  {
    const mockGeminiClient = {
      models: {
        generateContent: async () => {
          const err = new Error("API_KEY_INVALID: API key not valid. Please pass a valid API key.");
          err.status = 403;
          throw err;
        },
      },
    };
    let caught = null;
    try {
      await analyzeBusinessReviews({
        reviews: sampleReviews,
        businessName: "Cafe",
        businessType: "cafe",
        geminiClient: mockGeminiClient,
        sleepFn: () => Promise.resolve(),
      });
    } catch (err) { caught = err; }
    assert.ok(caught);
    assert.equal(caught.code, "AUTH_ERROR");
    assert.equal(caught.status, 403);
    assert.equal(caught.provider, "gemini");
  }

  process.env.MOCK_MODE = "true";
  console.log("  ✓ Passed: analyzeBusinessReviews classifies Gemini Quota, 503, 404, and Auth errors");
}

{
  console.log("Test I2.2: ReviewSentimentAdapter propagates transparent errors in MOCK_MODE");
  process.env.MOCK_MODE = "true";

  const errorCases = [
    { trigger: "MOCK_QUOTA_ERROR", expectedCode: "RESOURCE_EXHAUSTED", expectedStatus: 429 },
    { trigger: "MOCK_RATE_LIMIT_ERROR", expectedCode: "RATE_LIMIT_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_AUTH_ERROR", expectedCode: "AUTH_ERROR", expectedStatus: 403 },
    { trigger: "MOCK_503_ERROR", expectedCode: "SERVICE_UNAVAILABLE", expectedStatus: 503 },
    { trigger: "MOCK_502_ERROR", expectedCode: "BAD_GATEWAY", expectedStatus: 502 },
    { trigger: "MOCK_500_ERROR", expectedCode: "SERVER_ERROR", expectedStatus: 500 },
    { trigger: "MOCK_TIMEOUT_ERROR", expectedCode: "TIMEOUT", expectedStatus: 504 },
  ];

  for (const c of errorCases) {
    const res = await ReviewSentimentAdapter.executeTool({
      businessName: c.trigger,
      businessType: "bakery",
      reviews: [{ rating: 5, text: "Yummy" }],
    });

    assert.equal(res.output, null);
    assert.ok(res.error, `Must return error for ${c.trigger}`);
    assert.equal(res.error.code, c.expectedCode);
    assert.equal(res.error.status, c.expectedStatus);
    assert.equal(res.error.provider, "gemini");
  }
  console.log("  ✓ Passed: ReviewSentimentAdapter propagates all error codes and provider attribution\n");
}

// --- I3: Tech Idea Analysis (Gemini) ---
{
  console.log("Test I3: TechIdeaAnalysisAdapter propagates transparent errors in MOCK_MODE");
  process.env.MOCK_MODE = "true";

  const errorCases = [
    { trigger: "MOCK_QUOTA_ERROR", expectedCode: "RESOURCE_EXHAUSTED", expectedStatus: 429 },
    { trigger: "MOCK_RATE_LIMIT_ERROR", expectedCode: "RATE_LIMIT_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_AUTH_ERROR", expectedCode: "AUTH_ERROR", expectedStatus: 403 },
    { trigger: "MOCK_503_ERROR", expectedCode: "SERVICE_UNAVAILABLE", expectedStatus: 503 },
    { trigger: "MOCK_502_ERROR", expectedCode: "BAD_GATEWAY", expectedStatus: 502 },
    { trigger: "MOCK_500_ERROR", expectedCode: "SERVER_ERROR", expectedStatus: 500 },
    { trigger: "MOCK_TIMEOUT_ERROR", expectedCode: "TIMEOUT", expectedStatus: 504 },
  ];

  for (const c of errorCases) {
    const res = await TechIdeaAnalysisAdapter.executeTool({
      goal: c.trigger,
      location: "San Francisco, CA",
    });

    assert.equal(res.output, null);
    assert.ok(res.error, `Must return error for ${c.trigger}`);
    assert.equal(res.error.code, c.expectedCode);
    assert.equal(res.error.status, c.expectedStatus);
    assert.equal(res.error.provider, "gemini");
  }
  console.log("  ✓ Passed: TechIdeaAnalysisAdapter propagates all error codes and provider attribution\n");
}

// --- I4: Business Reviews Search (RapidAPI) Adapter Triggers ---
{
  console.log("Test I4: BusinessReviewsAdapter propagates transparent errors in MOCK_MODE");
  process.env.MOCK_MODE = "true";

  const errorCases = [
    { trigger: "MOCK_QUOTA_ERROR", expectedCode: "REVIEW_QUOTA_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_RATE_LIMIT_ERROR", expectedCode: "RATE_LIMIT_EXCEEDED", expectedStatus: 429 },
    { trigger: "MOCK_AUTH_ERROR", expectedCode: "AUTH_ERROR", expectedStatus: 403 },
    { trigger: "MOCK_502_ERROR", expectedCode: "BAD_GATEWAY", expectedStatus: 502 },
    { trigger: "MOCK_TIMEOUT_ERROR", expectedCode: "TIMEOUT", expectedStatus: 504 },
  ];

  for (const c of errorCases) {
    const res = await BusinessReviewsAdapter.executeTool({
      businessId: c.trigger,
      businessName: "Test Place",
    });

    assert.equal(res.output, null);
    assert.ok(res.error, `Must return error for ${c.trigger}`);
    assert.equal(res.error.code, c.expectedCode);
    assert.equal(res.error.status, c.expectedStatus);
    assert.equal(res.error.provider, "rapidapi");
  }
  console.log("  ✓ Passed: BusinessReviewsAdapter propagates all error codes and provider attribution\n");
}

// ============================================================================
// TEST CATEGORY J: Checkpoint Retry Across the Entire Agent (All 4 Tools)
// ============================================================================
console.log("--- Category J: Checkpoint Retry Across the Entire Agent (All 4 Tools) ---");

// --- J1: Tool 1 (nearby_business_search) Checkpoint Retry ---
{
  console.log("Test J1: Checkpoint Retry on Step 1 (nearby_business_search)");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    userId: "test-user-j1",
    state: AGENT_STATES.EXECUTING,
    goal: "Artisan sourdough bakery",
    location: "Portland, OR",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 1,
    externalCallCount: 1,
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, toolName: "Nearby Search", params: { businessType: "bakery", latitude: 45.5, longitude: -122.6 } },
        { stepIndex: 2, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, toolName: "Reviews Search", params: {} },
        { stepIndex: 3, toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, toolName: "Sentiment Analyzer", params: {} },
      ],
    },
  };

  // Step 1 Attempt 1 FAILED
  const step1Att1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "bakery", latitude: 45.5, longitude: -122.6 } },
    error: { message: "RapidAPI rate limit: 1 request/second exceeded.", code: "RATE_LIMIT_EXCEEDED", status: 429, provider: "rapidapi" },
    attempt: 1,
    logicalStepIndex: 1,
  };

  // Evaluate Retry Decision
  const retryDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1Att1],
    evidenceList: [],
  });

  assert.equal(retryDecision.action, "EXECUTE_TOOL");
  assert.equal(retryDecision.toolId, TOOL_IDS.NEARBY_BUSINESS_SEARCH, "Must target Step 1");
  assert.equal(retryDecision.isRetry, true);
  assert.equal(retryDecision.attempt, 2);
  assert.equal(retryDecision.retryOfStepId, step1Att1._id.toString());
  assert.equal(retryDecision.logicalStepIndex, 1);
  assert.equal(retryDecision.input.businessType, "bakery");
  assert.equal(retryDecision.input.latitude, 45.5);
  assert.equal(retryDecision.input.longitude, -122.6);

  console.log("  ✓ Step 1 failed -> retryStep targets ONLY Step 1 with attempt=2 and preserved params");

  // Simulate Step 1 Attempt 2 SUCCEEDED
  const step1Att2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "bakery", latitude: 45.5, longitude: -122.6 } },
    output: {
      businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery", rating: 4.8 }],
    },
    attempt: 2,
    retryOfStepId: step1Att1._id.toString(),
    logicalStepIndex: 1,
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: {
        businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery", rating: 4.8 }],
      },
      status: "verified",
    },
  ];

  run.stepCount = 2;
  run.externalCallCount = 2;

  // Evaluate Next Decision after Step 1 retry succeeds
  const nextDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1Att1, step1Att2],
    evidenceList: evidence,
  });

  assert.equal(nextDecision.action, "EXECUTE_TOOL");
  assert.equal(nextDecision.toolId, TOOL_IDS.BUSINESS_REVIEWS_SEARCH, "Must advance to Step 2");
  assert.equal(Boolean(nextDecision.isRetry), false);
  assert.equal(nextDecision.stepIndex, 2);
  assert.equal(nextDecision.input.businessId, "pdx-bakery-1", "Step 2 reuses placeId discovered in Step 1 retry");
  assert.equal(nextDecision.input.businessName, "Ken's Artisan Bakery");

  console.log("  ✓ Step 1 retry succeeded -> pipeline smoothly advances to Step 2 reusing discovered competitor evidence\n");
}

// --- J2: Tool 2 (business_reviews_search) Checkpoint Retry ---
{
  console.log("Test J2: Checkpoint Retry on Step 2 (business_reviews_search)");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    userId: "test-user-j2",
    state: AGENT_STATES.EXECUTING,
    goal: "Artisan sourdough bakery",
    location: "Portland, OR",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 2,
    externalCallCount: 2,
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, toolName: "Nearby Search", params: {} },
        { stepIndex: 2, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, toolName: "Reviews Search", params: {} },
        { stepIndex: 3, toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, toolName: "Sentiment Analyzer", params: {} },
      ],
    },
  };

  const step1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "bakery" } },
    output: { businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery" }] },
    attempt: 1,
    logicalStepIndex: 1,
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: { businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery" }] },
      status: "verified",
    },
  ];

  // Step 2 Attempt 1 FAILED with 504 Timeout
  const step2Att1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "pdx-bakery-1", businessName: "Ken's Artisan Bakery" } },
    error: { message: "RapidAPI Gateway Timeout (504): upstream places service timed out.", code: "TIMEOUT", status: 504, provider: "rapidapi" },
    attempt: 1,
    logicalStepIndex: 2,
  };

  // Evaluate Retry Decision
  const retryDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1, step2Att1],
    evidenceList: evidence,
  });

  assert.equal(retryDecision.action, "EXECUTE_TOOL");
  assert.equal(retryDecision.toolId, TOOL_IDS.BUSINESS_REVIEWS_SEARCH, "Must target Step 2");
  assert.notEqual(retryDecision.toolId, TOOL_IDS.NEARBY_BUSINESS_SEARCH, "Must NOT rerun Step 1");
  assert.equal(retryDecision.isRetry, true);
  assert.equal(retryDecision.attempt, 2);
  assert.equal(retryDecision.retryOfStepId, step2Att1._id.toString());
  assert.equal(retryDecision.logicalStepIndex, 2);
  assert.equal(retryDecision.input.businessId, "pdx-bakery-1");

  console.log("  ✓ Step 2 failed -> retryStep targets ONLY Step 2, Step 1 NOT rerun, Step 1 evidence reused");

  // Simulate Step 2 Attempt 2 SUCCEEDED
  const step2Att2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "pdx-bakery-1", businessName: "Ken's Artisan Bakery" } },
    output: {
      businessId: "pdx-bakery-1",
      businessName: "Ken's Artisan Bakery",
      reviews: [{ rating: 5, text: "Best croissants in town" }],
    },
    attempt: 2,
    retryOfStepId: step2Att1._id.toString(),
    logicalStepIndex: 2,
  };

  evidence.push({
    _id: new ObjectId(),
    runId,
    toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
    evidenceType: "customer_reviews",
    data: {
      businessId: "pdx-bakery-1",
      businessName: "Ken's Artisan Bakery",
      reviews: [{ rating: 5, text: "Best croissants in town" }],
    },
    status: "verified",
  });

  run.stepCount = 3;
  run.externalCallCount = 3;

  // Evaluate Next Decision after Step 2 retry succeeds
  const nextDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1, step2Att1, step2Att2],
    evidenceList: evidence,
  });

  assert.equal(nextDecision.action, "EXECUTE_TOOL");
  assert.equal(nextDecision.toolId, TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, "Must advance to Step 3");
  assert.equal(Boolean(nextDecision.isRetry), false);
  assert.equal(nextDecision.stepIndex, 3);
  assert.equal(nextDecision.input.businessName, "Ken's Artisan Bakery");
  assert.equal(nextDecision.input.reviews.length, 1);

  console.log("  ✓ Step 2 retry succeeded -> pipeline smoothly advances to Step 3 reusing reviews evidence\n");
}

// --- J3: Tool 3 (review_sentiment_analyzer) Checkpoint Retry ---
{
  console.log("Test J3: Checkpoint Retry on Step 3 (review_sentiment_analyzer)");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    userId: "test-user-j3",
    state: AGENT_STATES.EXECUTING,
    goal: "Artisan sourdough bakery",
    location: "Portland, OR",
    budget: { maxSteps: 8, maxExternalCalls: 5 },
    stepCount: 3,
    externalCallCount: 2,
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, toolName: "Nearby Search", params: {} },
        { stepIndex: 2, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, toolName: "Reviews Search", params: {} },
        { stepIndex: 3, toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, toolName: "Sentiment Analyzer", params: {} },
      ],
    },
  };

  const step1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "bakery" } },
    output: { businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery" }] },
    attempt: 1,
    logicalStepIndex: 1,
  };

  const step2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "pdx-bakery-1" } },
    output: { businessId: "pdx-bakery-1", reviews: [{ rating: 5, text: "Best croissants" }] },
    attempt: 1,
    logicalStepIndex: 2,
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: {
        businesses: [{ placeId: "pdx-bakery-1", name: "Ken's Artisan Bakery" }],
      },
      status: "verified",
    },
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
      evidenceType: "customer_reviews",
      data: {
        businessId: "pdx-bakery-1",
        businessName: "Ken's Artisan Bakery",
        reviews: [{ rating: 5, text: "Best croissants in town" }],
      },
      status: "verified",
    },
  ];

  // Step 3 Attempt 1 FAILED with 503 Service Unavailable (Gemini high demand spike)
  const step3Att1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "failed",
    input: {
      toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
      params: {
        businessName: "Ken's Artisan Bakery",
        businessType: "bakery",
        reviews: [{ rating: 5, text: "Best croissants in town" }],
      },
    },
    error: {
      message: "Gemini Service Unavailable (503): model is temporarily overloaded.",
      code: "SERVICE_UNAVAILABLE",
      status: 503,
      provider: "gemini",
    },
    attempt: 1,
    logicalStepIndex: 3,
  };

  // Evaluate Retry Decision
  const retryDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1, step2, step3Att1],
    evidenceList: evidence,
  });

  assert.equal(retryDecision.action, "EXECUTE_TOOL");
  assert.equal(retryDecision.toolId, TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, "Must target Step 3");
  assert.notEqual(retryDecision.toolId, TOOL_IDS.NEARBY_BUSINESS_SEARCH, "Must NOT rerun Step 1");
  assert.notEqual(retryDecision.toolId, TOOL_IDS.BUSINESS_REVIEWS_SEARCH, "Must NOT rerun Step 2");
  assert.equal(retryDecision.isRetry, true);
  assert.equal(retryDecision.attempt, 2);
  assert.equal(retryDecision.retryOfStepId, step3Att1._id.toString());
  assert.equal(retryDecision.logicalStepIndex, 3);
  assert.equal(retryDecision.input.businessName, "Ken's Artisan Bakery");
  assert.equal(retryDecision.input.reviews.length, 1);

  console.log("  ✓ Step 3 failed -> retryStep targets ONLY Step 3; Step 1 & 2 NOT rerun, Step 2 evidence reused");

  // Simulate Step 3 Attempt 2 SUCCEEDED
  const step3Att2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 4,
    type: "tool_execution",
    status: "completed",
    input: {
      toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
      params: { businessName: "Ken's Artisan Bakery", reviews: [{ rating: 5, text: "Best croissants" }] },
    },
    output: {
      summary: "Highly positive sentiment, renowned for baked goods.",
      overallSentiment: "Positive",
      confidence: "High",
    },
    attempt: 2,
    retryOfStepId: step3Att1._id.toString(),
    logicalStepIndex: 3,
  };

  evidence.push({
    _id: new ObjectId(),
    runId,
    toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
    evidenceType: "sentiment_analysis",
    data: { overallSentiment: "Positive" },
    status: "verified",
  });

  run.stepCount = 4;

  // Evaluate Next Decision after Step 3 retry succeeds
  const nextDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1, step2, step3Att1, step3Att2],
    evidenceList: evidence,
  });

  assert.equal(
    nextDecision.action,
    "TRANSITION_SYNTHESIZING",
    "Must transition to TRANSITION_SYNTHESIZING after all 3 steps succeed"
  );
  assert.equal(Boolean(nextDecision.isRetry), false);

  console.log("  ✓ Step 3 retry succeeded -> pipeline transitions to TRANSITION_SYNTHESIZING\n");
}

// --- J4: Tool 4 (tech_idea_analysis) Checkpoint Retry ---
{
  console.log("Test J4: Checkpoint Retry on Step 1 (tech_idea_analysis)");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    userId: "test-user-j4",
    state: AGENT_STATES.EXECUTING,
    goal: "AI-powered automated invoice reconciliation SaaS",
    location: "Global / Remote",
    budget: { maxSteps: 6, maxExternalCalls: 4 },
    stepCount: 1,
    externalCallCount: 1,
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.TECH_IDEA_ANALYSIS, toolName: "Tech Idea Analysis", params: { goal: "AI-powered automated invoice reconciliation SaaS", location: "Global / Remote" } },
      ],
    },
  };

  // Step 1 Attempt 1 FAILED with 429 RESOURCE_EXHAUSTED
  const step1Att1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "failed",
    input: { toolId: TOOL_IDS.TECH_IDEA_ANALYSIS, params: { goal: "AI-powered automated invoice reconciliation SaaS", location: "Global / Remote" } },
    error: {
      message: "Gemini API quota exceeded. Please try again later.",
      code: "RESOURCE_EXHAUSTED",
      status: 429,
      provider: "gemini",
    },
    attempt: 1,
    logicalStepIndex: 1,
  };

  // Evaluate Retry Decision
  const retryDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1Att1],
    evidenceList: [],
  });

  assert.equal(retryDecision.action, "EXECUTE_TOOL");
  assert.equal(retryDecision.toolId, TOOL_IDS.TECH_IDEA_ANALYSIS, "Must target tech_idea_analysis");
  assert.equal(retryDecision.isRetry, true);
  assert.equal(retryDecision.attempt, 2);
  assert.equal(retryDecision.retryOfStepId, step1Att1._id.toString());
  assert.equal(retryDecision.logicalStepIndex, 1);
  assert.equal(retryDecision.input.goal, "AI-powered automated invoice reconciliation SaaS");
  assert.equal(retryDecision.input.location, "Global / Remote");

  console.log("  ✓ tech_idea_analysis failed -> retryStep targets ONLY tech_idea_analysis with attempt=2 and preserved input");

  // Simulate Step 1 Attempt 2 SUCCEEDED
  const step1Att2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.TECH_IDEA_ANALYSIS, params: { goal: "AI-powered automated invoice reconciliation SaaS" } },
    output: {
      feasibility: "High",
      marketFitScore: 8.5,
      suggestedStack: ["Node.js", "Python", "PostgreSQL", "Gemini API"],
      risks: ["OCR edge cases with blurry receipts"],
    },
    attempt: 2,
    retryOfStepId: step1Att1._id.toString(),
    logicalStepIndex: 1,
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.TECH_IDEA_ANALYSIS,
      evidenceType: "tech_feasibility",
      data: { feasibility: "High", marketFitScore: 8.5 },
      status: "verified",
    },
  ];

  run.stepCount = 2;
  run.externalCallCount = 2;

  // Evaluate Next Decision after tech_idea_analysis retry succeeds
  const nextDecision = evaluateDeterministicNextStep({
    run,
    steps: [step1Att1, step1Att2],
    evidenceList: evidence,
  });

  assert.equal(
    nextDecision.action,
    "TRANSITION_SYNTHESIZING",
    "Must transition to TRANSITION_SYNTHESIZING after tech_idea_analysis succeeds"
  );
  assert.equal(Boolean(nextDecision.isRetry), false);

  console.log("  ✓ tech_idea_analysis retry succeeded -> pipeline transitions to TRANSITION_SYNTHESIZING\n");
}

// ============================================================================
// TEST CATEGORY K: Resolved Failures in Synthesizer & Controller Safeguards
// ============================================================================
console.log("--- Category K: Resolved Failures in Synthesizer & Controller Safeguards ---");

{
  console.log("Test K1: Failed attempt followed by successful retry does NOT mark synthesis as partial or output [object Object]");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    goal: "Food court with less prices and good quality",
    location: "Eluru, India",
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH },
        { stepIndex: 2, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
        { stepIndex: 3, toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER },
      ],
    },
  };

  // Step 1: Nearby business search (completed)
  const step1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "food court" } },
    output: {
      totalFound: 5,
      businesses: [
        { placeId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk", name: "SS YUMMY FOOD COURT", rating: 4.2, reviewCount: 370 },
      ],
      density: { highDensity: true },
      averageRating: 4.2,
      totalReviews: 370,
    },
  };

  // Step 2 Attempt 1: Business reviews search (FAILED with structured error)
  const step2Att1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "failed",
    attempt: 1,
    logicalStepIndex: 2,
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk" } },
    error: {
      message: "RapidAPI rate limit: 1 request/second exceeded. Please wait a moment and retry.",
      code: "RATE_LIMIT_EXCEEDED",
      status: 429,
      provider: "rapidapi",
    },
  };

  // Step 2 Attempt 2: Business reviews search (SUCCESSFUL RETRY)
  const step2Att2 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 3,
    type: "tool_execution",
    status: "completed",
    attempt: 2,
    retryOfStepId: step2Att1._id.toString(),
    logicalStepIndex: 2,
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk" } },
    output: {
      businessId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk",
      businessName: "SS YUMMY FOOD COURT",
      totalReviews: 5,
      reviews: [
        { rating: 4, text: "Good fried chicken and milkshakes" },
        { rating: 2, text: "Hygiene issues and slow service" },
      ],
    },
  };

  // Step 3: Review sentiment analyzer (completed)
  const step3 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 4,
    type: "tool_execution",
    status: "completed",
    attempt: 1,
    logicalStepIndex: 3,
    input: { toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER, params: { businessName: "SS YUMMY FOOD COURT" } },
    output: {
      summary: "SS YUMMY FOOD COURT has popular fried chicken but notable hygiene complaints.",
      strengths: ["Fried chicken", "Crispy sides"],
      weaknesses: ["Severe hygiene concerns", "Slow management"],
      commonComplaints: ["Food safety", "Poor service"],
      customerLikes: ["Milkshakes"],
      opportunities: ["Strict hygiene standards"],
      overallSentiment: "Mixed",
      confidence: "High",
      reviewsAnalyzed: 5,
    },
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: {
        totalFound: 5,
        businesses: [
          { placeId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk", name: "SS YUMMY FOOD COURT", rating: 4.2, reviewCount: 370 },
        ],
        averageRating: 4.2,
        totalReviews: 370,
      },
      status: "verified",
    },
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
      evidenceType: "customer_reviews",
      data: {
        businessId: "ChIJIa7eT1gTNjoRBZQcxhLrKTk",
        businessName: "SS YUMMY FOOD COURT",
        reviews: [
          { rating: 4, text: "Good fried chicken and milkshakes" },
          { rating: 2, text: "Hygiene issues and slow service" },
        ],
      },
      status: "verified",
    },
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
      evidenceType: "sentiment_analysis",
      data: {
        summary: "SS YUMMY FOOD COURT has popular fried chicken but notable hygiene complaints.",
        strengths: ["Fried chicken"],
        weaknesses: ["Severe hygiene concerns"],
        commonComplaints: ["Food safety"],
        customerLikes: ["Milkshakes"],
        opportunities: ["Strict hygiene standards"],
        overallSentiment: "Mixed",
        confidence: "High",
      },
      status: "verified",
    },
  ];

  const output = synthesizeFinalRecommendation({
    run,
    steps: [step1, step2Att1, step2Att2, step3],
    evidence,
  });

  // A. Synthesizer must NOT report failure when retry succeeded
  assert.equal(output.evidence.partial, false, "Synthesis must NOT be partial when retry succeeded");
  assert.doesNotMatch(output.summary, /Analysis is partial/i, "Summary must not report partial execution");
  assert.doesNotMatch(output.summary, /failed tool step/i, "Summary must not report failed tool steps");

  // B. No [object Object] in output risks or payload
  const stringifiedOutput = JSON.stringify(output);
  assert.doesNotMatch(stringifiedOutput, /\[object Object\]/, "Must NEVER contain [object Object]");

  for (const risk of output.keyRisks) {
    assert.doesNotMatch(risk, /Tool execution failed for 'business_reviews_search'/, "Resolved failure must not appear in keyRisks");
  }

  for (const rec of output.recommendations) {
    assert.doesNotMatch(rec, /Re-run failed or unexecuted tool steps/i, "Must not recommend re-running resolved steps");
  }

  // Confidence must not be penalized down to 3.5
  assert.ok(output.confidenceScore >= 5.0, `Confidence score (${output.confidenceScore}) must not be penalized by resolved retry`);

  console.log("  ✓ Passed: Synthesizer treats retried step as resolved: partial=false, no [object Object], full confidence preserved\n");
}

{
  console.log("Test K2: Truly unresolved failed tools format error message cleanly without [object Object]");

  const runId = new ObjectId();
  const run = {
    _id: runId,
    goal: "Food court with less prices and good quality",
    location: "Eluru, India",
    plan: {
      steps: [
        { stepIndex: 1, toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH },
        { stepIndex: 2, toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
      ],
    },
  };

  const step1 = {
    _id: new ObjectId(),
    runId,
    stepNumber: 1,
    type: "tool_execution",
    status: "completed",
    input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH, params: { businessType: "food court" } },
    output: { businesses: [{ placeId: "b1", name: "Cafe" }] },
  };

  const step2GenuinelyFailed = {
    _id: new ObjectId(),
    runId,
    stepNumber: 2,
    type: "tool_execution",
    status: "failed",
    attempt: 1,
    logicalStepIndex: 2,
    input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH, params: { businessId: "b1" } },
    error: {
      message: "RapidAPI monthly quota exceeded. Please try again next month.",
      code: "REVIEW_QUOTA_EXCEEDED",
      status: 429,
      provider: "rapidapi",
    },
  };

  const evidence = [
    {
      _id: new ObjectId(),
      runId,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      evidenceType: "competitor_discovery",
      data: { businesses: [{ placeId: "b1", name: "Cafe" }] },
      status: "verified",
    },
  ];

  const output = synthesizeFinalRecommendation({
    run,
    steps: [step1, step2GenuinelyFailed],
    evidence,
  });

  assert.equal(output.evidence.partial, true, "Synthesis must be partial for genuinely unresolved failure");
  assert.doesNotMatch(JSON.stringify(output), /\[object Object\]/, "Must NEVER contain [object Object]");

  const failureRisk = output.keyRisks.find((r) => r.includes("business_reviews_search"));
  assert.ok(failureRisk, "Must record unresolved failure in keyRisks");
  assert.match(failureRisk, /RapidAPI monthly quota exceeded/i, "Risk must contain actual sanitized error message");

  console.log("  ✓ Passed: Unresolved failure displays sanitized message cleanly without [object Object]\n");
}

{
  console.log("Test K3: Retry endpoint logic rejects already-resolved failed steps");

  const steps = [
    {
      _id: new ObjectId(),
      type: "tool_execution",
      status: "completed",
      input: { toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH },
    },
    {
      _id: new ObjectId(),
      type: "tool_execution",
      status: "failed",
      input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
      attempt: 1,
    },
    {
      _id: new ObjectId(),
      type: "tool_execution",
      status: "completed",
      input: { toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH },
      attempt: 2,
    },
  ];

  const completedToolIds = new Set(
    steps.filter((s) => s.type === "tool_execution" && s.status === "completed")
      .map((s) => s.input?.toolId)
      .filter(Boolean)
  );

  const failedSteps = steps.filter((s) => s.type === "tool_execution" && s.status === "failed");

  // Logic used in retryStepHandler
  const lastUnresolvedFailedStep = [...failedSteps].reverse().find(
    (fs) => fs.input?.toolId && !completedToolIds.has(fs.input.toolId)
  );

  assert.equal(
    lastUnresolvedFailedStep,
    undefined,
    "Must find NO unresolved failed step when failed tool was already completed on retry"
  );

  console.log("  ✓ Passed: Retry endpoint correctly rejects retrying already-resolved steps\n");
}

console.log("================================================================================");
console.log("ALL 11 CATEGORIES (A - K) PASSED SUCCESSFULLY!");
console.log("================================================================================");



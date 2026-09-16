import assert from "node:assert/strict";
import { synthesizeFinalRecommendation } from "../server/agent/synthesizer.js";

console.log("Starting Multi-Mode Synthesizer Test Suite...\n");

// ============================================================================
// Test 1: LOCAL Complete Investigation (Food Court in Eluru)
// ============================================================================
{
  console.log("Test 1: LOCAL Mode Complete Investigation (Food Court in Eluru)");

  const run = {
    _id: "run-local-001",
    goal: "food court with less prices",
    location: "Eluru, Andhra Pradesh",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 3,
    plan: {
      category: "local",
      ventureType: "local",
    },
  };

  const steps = [
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "nearby_business_search" },
      output: {
        totalFound: 5,
        averageRating: 4.96,
        totalReviews: 73,
        density: { within500m: 0, within1km: 1, within3km: 5 },
        businesses: [
          { placeId: "place-1", name: "Nani Fast Foods", rating: 4.96, userRatingsTotal: 7, address: "Eluru Main Rd" },
          { placeId: "place-2", name: "Sri Krishna Tiffins", rating: 4.8, userRatingsTotal: 25, address: "Powerpet, Eluru" },
          { placeId: "place-3", name: "Bawarchi Biryani", rating: 4.5, userRatingsTotal: 18, address: "Fire Station Rd, Eluru" },
          { placeId: "place-4", name: "Annapurna Canteen", rating: 4.3, userRatingsTotal: 12, address: "RR Pet, Eluru" },
          { placeId: "place-5", name: "Swagath Food Court", rating: 4.1, userRatingsTotal: 11, address: "Bypass Rd, Eluru" },
        ],
      },
    },
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "business_reviews_search" },
      output: {
        businessId: "place-1",
        businessName: "Nani Fast Foods",
        totalReviews: 5,
        reviews: [
          { authorName: "Ravi", rating: 5, text: "Great food quality and fast service." },
          { authorName: "Sita", rating: 5, text: "Peaceful atmosphere and clean tables." },
          { authorName: "Kiran", rating: 5, text: "Pocket friendly and quick." },
          { authorName: "Lakshmi", rating: 5, text: "Tasty snacks." },
          { authorName: "Venkat", rating: 4, text: "Good food but limited seating." },
        ],
      },
    },
    {
      type: "tool_execution",
      status: "completed",
      input: {
        toolId: "review_sentiment_analyzer",
        businessName: "Nani Fast Foods",
      },
      output: {
        businessName: "Nani Fast Foods",
        overallSentiment: "positive",
        summary:
          "Nani Fast Foods receives positive ratings with customers praising the food quality, peaceful atmosphere, and fast service speed, though feedback volume is very limited.",
        strengths: ["food quality", "peaceful atmosphere", "fast service speed"],
        weaknesses: ["limited seating", "low review count"],
        opportunities: ["transparent menu listings", "active local marketing", "expanded value combos"],
        confidence: 0.85,
      },
    },
  ];

  const evidence = [
    {
      evidenceType: "competitor_discovery",
      toolId: "nearby_business_search",
      data: steps[0].output,
    },
    {
      evidenceType: "customer_reviews",
      toolId: "business_reviews_search",
      data: steps[1].output,
    },
    {
      evidenceType: "sentiment_analysis",
      toolId: "review_sentiment_analyzer",
      data: steps[2].output,
      metadata: { params: { businessName: "Nani Fast Foods" } },
    },
  ];

  const output = synthesizeFinalRecommendation({ run, steps, evidence });

  // 1. Suppression of Tech Artifacts
  assert.equal(output.feasibility, null, "feasibility must be null in LOCAL mode");
  assert.deepEqual(output.suggestedStack, [], "suggestedStack must be empty in LOCAL mode");
  assert.equal(output.marketFit.score, null, "marketFit.score must be null in LOCAL mode");

  // 2. Summary Formatting & Exclusion of Banned Tech Phrasing
  assert.ok(!output.summary.includes("technology idea"), "Summary must NOT include technology idea");
  assert.ok(!output.summary.includes("technical feasibility"), "Summary must NOT include technical feasibility");
  assert.ok(!output.summary.includes("null/10"), "Summary must NOT include null/10");
  assert.ok(!output.summary.includes("market fit score"), "Summary must NOT include market fit score");
  assert.ok(!output.summary.includes("unknown technical feasibility"), "Summary must NOT include unknown technical feasibility");
  assert.ok(output.summary.includes("Investigated local market viability for 'food court with less prices' in Eluru, Andhra Pradesh."), "Summary must have clean local intro");
  assert.ok(output.summary.includes("5 nearby business(es)"), "Summary must mention 5 nearby businesses");
  assert.ok(output.summary.includes("4.96 avg rating"), "Summary must mention 4.96 avg rating");
  assert.ok(output.summary.includes("73 total reviews"), "Summary must mention 73 total reviews");
  assert.ok(output.summary.includes("Nani Fast Foods"), "Summary must mention sampled competitor Nani Fast Foods");
  assert.ok(output.summary.includes("Customer sentiment analysis:"), "Summary must include sentiment analysis");

  // 3. Verdict & Confidence
  assert.equal(output.verdict, "NEEDS_REFINEMENT", "Verdict must be conservative NEEDS_REFINEMENT");
  assert.equal(output.confidenceScore, 5.0, "Confidence score must be neutral 5.0 baseline");

  // 4. Market Fit Analysis text
  assert.ok(!output.marketFit.analysis.includes("tech_idea_analysis"), "marketFit.analysis must NOT mention tech_idea_analysis");
  assert.ok(!output.marketFit.analysis.includes("null/10"), "marketFit.analysis must NOT mention null/10");
  assert.ok(output.marketFit.analysis.includes("5 competitor(s)"), "marketFit.analysis must mention 5 competitors");
  assert.ok(output.marketFit.analysis.includes("4.96 ★"), "marketFit.analysis must mention 4.96 rating");

  // 5. Local Evidence Payload
  assert.ok(output.localEvidence, "localEvidence must be populated");
  assert.equal(output.localEvidence.competitorCount, 5);
  assert.equal(output.localEvidence.averageCompetitorRating, 4.96);
  assert.equal(output.localEvidence.totalCompetitorReviews, 73);
  assert.equal(output.localEvidence.reviewedBusinessName, "Nani Fast Foods");
  assert.equal(output.localEvidence.reviewsSampled, 5);
  assert.equal(Array.isArray(output.localEvidence.discoveredBusinesses), true);
  assert.equal(output.localEvidence.discoveredBusinesses.length, 5);
  assert.equal(output.localEvidence.discoveredBusinesses[0].name, "Nani Fast Foods");

  // 6. Risks & Recommendations
  assert.ok(output.keyRisks.some((r) => r.includes("High competitor satisfaction")), "Must flag high competitor satisfaction risk");
  assert.ok(output.keyRisks.some((r) => r.includes("Limited feedback volume")), "Must flag limited review feedback volume risk");
  assert.ok(output.keyRisks.some((r) => r.includes("Financial unit economics")), "Must flag unverified unit economics risk");
  assert.ok(output.recommendations.some((r) => r.includes("Eluru, Andhra Pradesh")), "Must recommend foot traffic in Eluru");
  assert.ok(output.recommendations.some((r) => r.includes("transparent menu listings")), "Must recommend sentiment opportunities");
  assert.ok(output.recommendations.some((r) => r.includes("Differentiate from existing competitors")), "Must recommend solving customer pain points");
  assert.ok(output.recommendations.some((r) => r.includes("Benchmark menu offerings and price points against primary competitor 'Nani Fast Foods'")), "Must recommend benchmarking against Nani Fast Foods");

  // 7. Integrity & Execution
  assert.equal(output.evidence.partial, false);
  assert.equal(output.evidence.failedTools.length, 0);

  console.log("  ✓ Test 1 passed\n");
}

// ============================================================================
// Test 2: LOCAL Zero Competitors Investigation
// ============================================================================
{
  console.log("Test 2: LOCAL Mode Zero Competitors Investigation");

  const run = {
    _id: "run-local-002",
    goal: "artisanal pottery studio",
    location: "Rural Valley",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 1,
    plan: { category: "local", ventureType: "local" },
  };

  const steps = [
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "nearby_business_search" },
      output: {
        totalFound: 0,
        businesses: [],
      },
    },
  ];

  const evidence = [
    {
      evidenceType: "competitor_discovery",
      toolId: "nearby_business_search",
      data: steps[0].output,
    },
  ];

  const output = synthesizeFinalRecommendation({ run, steps, evidence });

  assert.equal(output.feasibility, null);
  assert.deepEqual(output.suggestedStack, []);
  assert.equal(output.marketFit.score, null);
  assert.equal(output.verdict, "NEEDS_REFINEMENT");
  assert.equal(output.confidenceScore, 5.0);
  assert.equal(output.localEvidence.competitorCount, 0);
  assert.ok(output.summary.includes("0 nearby businesses"), "Summary must state 0 nearby businesses");
  assert.ok(output.summary.includes("Market validation is limited due to the lack of observable direct competitors"), "Summary must acknowledge lack of direct competitors");
  assert.ok(output.keyRisks.some((r) => r.includes("Zero direct competitors identified")), "Must flag zero competitors risk");
  assert.ok(output.recommendations.some((r) => r.includes("Survey local foot-traffic")), "Must recommend baseline foot traffic survey");

  console.log("  ✓ Test 2 passed\n");
}

// ============================================================================
// Test 3: LOCAL Partial Investigation with Tool Failure
// ============================================================================
{
  console.log("Test 3: LOCAL Mode Partial Failure Investigation");

  const run = {
    _id: "run-local-003",
    goal: "organic juice bar",
    location: "Koramangala, Bangalore",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 2,
    plan: { category: "local", ventureType: "local" },
  };

  const steps = [
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "nearby_business_search" },
      output: {
        totalFound: 3,
        averageRating: 4.4,
        totalReviews: 45,
        businesses: [
          { placeId: "p-juice-1", name: "Fresh Squeeze", rating: 4.5, userRatingsTotal: 30 },
          { placeId: "p-juice-2", name: "Juice Point", rating: 4.3, userRatingsTotal: 15 },
        ],
      },
    },
    {
      type: "tool_execution",
      status: "failed",
      error: "RapidAPI endpoint timeout (504)",
      input: { toolId: "business_reviews_search" },
    },
  ];

  const evidence = [
    {
      evidenceType: "competitor_discovery",
      toolId: "nearby_business_search",
      data: steps[0].output,
    },
  ];

  const output = synthesizeFinalRecommendation({ run, steps, evidence });

  assert.equal(output.feasibility, null);
  assert.deepEqual(output.suggestedStack, []);
  assert.equal(output.marketFit.score, null);
  assert.equal(output.evidence.partial, true, "Must be flagged as partial");
  assert.equal(output.verdict, "NEEDS_REFINEMENT");
  assert.equal(output.confidenceScore, 3.5, "Confidence must be penalized 5.0 * 0.7 = 3.5");
  assert.ok(output.summary.includes("Analysis is partial with 1 failed tool step(s)"), "Summary must reflect partial execution");
  assert.ok(output.keyRisks.some((r) => r.includes("Tool execution failed for 'business_reviews_search'")), "Failed tool must appear in keyRisks");
  assert.ok(output.recommendations.some((r) => r.includes("Re-run failed or unexecuted tool steps")), "Must recommend re-running tools");

  console.log("  ✓ Test 3 passed\n");
}

// ============================================================================
// Test 4: TECH Mode Regression (Automated Micro-Fulfillment Platform)
// ============================================================================
{
  console.log("Test 4: TECH Mode Regression");

  const run = {
    _id: "run-tech-001",
    goal: "automated micro-fulfillment platform",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 1,
    plan: { category: "tech", ventureType: "tech" },
  };

  const steps = [
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "tech_idea_analysis" },
      output: {
        feasibility: "High",
        marketFitScore: 8.5,
        suggestedStack: ["React", "Node.js", "PostgreSQL", "MQTT"],
        risks: ["Hardware integration latency with custom robotics"],
      },
    },
  ];

  const evidence = [
    {
      evidenceType: "tech_assessment",
      toolId: "tech_idea_analysis",
      data: steps[0].output,
    },
  ];

  const output = synthesizeFinalRecommendation({ run, steps, evidence });

  assert.equal(output.feasibility, "High", "Feasibility must be High");
  assert.deepEqual(output.suggestedStack, ["React", "Node.js", "PostgreSQL", "MQTT"]);
  assert.equal(output.marketFit.score, 8.5);
  assert.equal(output.confidenceScore, 8.5);
  assert.equal(output.verdict, "VIABLE");
  assert.ok(output.summary.includes("Investigated technology idea viability for 'automated micro-fulfillment platform'"));
  assert.ok(output.summary.includes("Tool analysis indicates high technical feasibility with a 8.5/10 market fit score."));
  assert.equal(output.localEvidence, undefined, "localEvidence must NOT be populated in purely tech mode");
  assert.equal(output.evidence.partial, false);
  assert.ok(output.recommendations.some((r) => r.includes("Proceed with MVP architecture using React, Node.js, PostgreSQL, MQTT")));

  console.log("  ✓ Test 4 passed\n");
}

// ============================================================================
// Test 5: HYBRID Mode Complete Investigation
// ============================================================================
{
  console.log("Test 5: HYBRID Mode Investigation");

  const run = {
    _id: "run-hybrid-001",
    goal: "smart autonomous cloud kitchen network",
    location: "Hyderabad",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 4,
    plan: { category: "hybrid", ventureType: "hybrid" },
  };

  const steps = [
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "tech_idea_analysis" },
      output: {
        feasibility: "High",
        marketFitScore: 7.5,
        suggestedStack: ["Python", "FastAPI", "MongoDB"],
        risks: ["Sensor calibration drift in commercial ovens"],
      },
    },
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "nearby_business_search" },
      output: {
        totalFound: 4,
        averageRating: 4.2,
        totalReviews: 120,
        businesses: [
          { placeId: "hyb-1", name: "Kitchen Hub", rating: 4.2, userRatingsTotal: 60 },
          { placeId: "hyb-2", name: "Cloud Cook", rating: 4.1, userRatingsTotal: 40 },
          { placeId: "hyb-3", name: "Byte Foods", rating: 4.3, userRatingsTotal: 20 },
        ],
      },
    },
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "business_reviews_search" },
      output: {
        businessId: "hyb-1",
        businessName: "Kitchen Hub",
        totalReviews: 3,
        reviews: [
          { authorName: "Anil", rating: 4, text: "Fast delivery and great hygiene." },
        ],
      },
    },
    {
      type: "tool_execution",
      status: "completed",
      input: { toolId: "review_sentiment_analyzer", businessName: "Kitchen Hub" },
      output: {
        businessName: "Kitchen Hub",
        overallSentiment: "positive",
        summary: "Kitchen Hub provides dependable cloud kitchen facilities with positive customer sentiment.",
        strengths: ["hygiene", "delivery speed"],
        weaknesses: ["peak hour delays"],
        opportunities: ["automated scheduling"],
      },
    },
  ];

  const evidence = [
    {
      evidenceType: "tech_assessment",
      toolId: "tech_idea_analysis",
      data: steps[0].output,
    },
    {
      evidenceType: "competitor_discovery",
      toolId: "nearby_business_search",
      data: steps[1].output,
    },
    {
      evidenceType: "customer_reviews",
      toolId: "business_reviews_search",
      data: steps[2].output,
    },
    {
      evidenceType: "sentiment_analysis",
      toolId: "review_sentiment_analyzer",
      data: steps[3].output,
      metadata: { params: { businessName: "Kitchen Hub" } },
    },
  ];

  const output = synthesizeFinalRecommendation({ run, steps, evidence });

  assert.equal(output.feasibility, "High");
  assert.equal(output.marketFit.score, 7.5);
  assert.deepEqual(output.suggestedStack, ["Python", "FastAPI", "MongoDB"]);
  assert.equal(output.confidenceScore, 7.5);
  assert.equal(output.verdict, "VIABLE");
  assert.ok(output.summary.includes("Investigated venture viability for 'smart autonomous cloud kitchen network' in Hyderabad."));
  assert.ok(output.summary.includes("Technical feasibility is high with a 7.5/10 market fit score."));
  assert.ok(output.summary.includes("Local competitor analysis identified 4 nearby competitor(s) with 4.2 avg rating."));
  assert.ok(!output.summary.includes("null/10"));
  assert.ok(output.localEvidence);
  assert.equal(output.localEvidence.competitorCount, 4);

  console.log("  ✓ Test 5 passed\n");
}

// ============================================================================
// Test 6: Inconclusive (0 Tools Executed)
// ============================================================================
{
  console.log("Test 6: Inconclusive Investigation (0 Tools Executed)");

  const run = {
    _id: "run-zero-001",
    goal: "pop-up tea stall",
    location: "Vijayawada",
    budget: { maxSteps: 8, maxExternalCalls: 5, maxSynthesisCalls: 2 },
    stepCount: 0,
    plan: { category: "local", ventureType: "local" },
  };

  const output = synthesizeFinalRecommendation({ run, steps: [], evidence: [] });

  assert.equal(output.verdict, "INCONCLUSIVE");
  assert.equal(output.confidenceScore, 0);
  assert.equal(output.feasibility, null);
  assert.equal(output.marketFit.score, null);
  assert.ok(output.summary.includes("No valid tool execution evidence collected. Cannot evaluate viability deterministically."));
  assert.ok(output.recommendations.some((r) => r.includes("Execute planned analysis tools before requesting final recommendation.")));

  console.log("  ✓ Test 6 passed\n");
}

console.log("=================================================================");
console.log("ALL 6 SYNTHESIZER MULTI-MODE TESTS PASSED SUCCESSFULLY! ✓✓✓");
console.log("=================================================================");

class SynthesizerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "SynthesizerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const EVIDENCE_TYPE_TO_TOOL_MAP = {
  tech_assessment: "tech_idea_analysis",
  competitor_discovery: "nearby_business_search",
  customer_reviews: "business_reviews_search",
  sentiment_analysis: "review_sentiment_analyzer",
};

/**
 * Pure deterministic synthesis function.
 * Derives every claim, score, suggested technology, and risk solely from
 * actual completed tool outputs in `steps` and/or `evidence`. Zero invented market evidence.
 *
 * Side-effect-free: no DB access, no network calls, no state mutations.
 *
 * @param {Object} params
 * @param {Object} params.run - Read-only agent run snapshot { _id, goal, location, budget, stepCount, plan }
 * @param {Array<Object>} [params.steps=[]] - Read-only array of step documents for this run
 * @param {Array<Object>} [params.evidence=[]] - Read-only array of evidence documents for this run
 * @returns {Object} Structured finalOutput recommendation
 */
const synthesizeFinalRecommendation = ({ run, steps = [], evidence = [] }) => {
  if (!run || typeof run !== "object") {
    throw new SynthesizerError("Run object is required for synthesis", "INVALID_RUN", 400);
  }

  if (typeof run.goal !== "string" || !run.goal.trim()) {
    throw new SynthesizerError("Run must have a valid goal for synthesis", "INVALID_GOAL", 400);
  }

  const cleanGoal = run.goal.trim();
  const cleanLocation = typeof run.location === "string" ? run.location.trim() || null : null;

  // 1. Partition steps (for execution history and failure tracking)
  const safeSteps = Array.isArray(steps) ? steps : [];
  const safeEvidence = Array.isArray(evidence) ? evidence : [];

  const toolSteps = safeSteps.filter((s) => s && s.type === "tool_execution");
  const completedToolSteps = toolSteps.filter((s) => s.status === "completed");
  const failedToolSteps = toolSteps.filter((s) => s.status === "failed");

  const toolsExecuted = toolSteps
    .map((s) => s.input?.toolId)
    .filter((id) => typeof id === "string");

  // If evidence is provided, successful tools are derived from evidence toolIds or mapped evidenceTypes, unioned with completed steps
  const evidenceToolIds = safeEvidence
    .map((e) => e.toolId || EVIDENCE_TYPE_TO_TOOL_MAP[e.evidenceType])
    .filter((id) => typeof id === "string");
  const stepToolIds = completedToolSteps
    .map((s) => s.input?.toolId)
    .filter((id) => typeof id === "string");

  const successfulTools = safeEvidence.length > 0
    ? [...new Set([...evidenceToolIds, ...stepToolIds])]
    : stepToolIds;

  const failedTools = failedToolSteps.map((s) => ({
    toolId: s.input?.toolId || "unknown",
    error: s.error || "Tool execution failed",
  }));

  // Determine if synthesis is partial based on plan or failed tools
  const plannedSteps = Array.isArray(run.plan?.steps) ? run.plan.steps : [];
  const plannedToolIds = plannedSteps.map((s) => s.toolId);

  let partial = false;
  if (failedTools.length > 0) {
    partial = true;
  } else if (plannedToolIds.length > 0 && successfulTools.length < plannedToolIds.length) {
    partial = true;
  } else if (toolSteps.length === 0 && safeEvidence.length === 0) {
    partial = true;
  }

  // 2. Locate evidence objects (or fallback to completed step outputs)
  const techEvidence = safeEvidence.find(
    (e) => e.evidenceType === "tech_assessment" || e.toolId === "tech_idea_analysis"
  );
  const techIdeaStep = completedToolSteps.find(
    (s) => s.input?.toolId === "tech_idea_analysis"
  );

  const nearbyEvidence = safeEvidence.find(
    (e) => e.evidenceType === "competitor_discovery" || e.toolId === "nearby_business_search"
  );
  const nearbyStep = completedToolSteps.find(
    (s) => s.input?.toolId === "nearby_business_search"
  );

  const reviewsEvidence = safeEvidence.find(
    (e) => e.evidenceType === "customer_reviews" || e.toolId === "business_reviews_search"
  );
  const reviewsStep = completedToolSteps.find(
    (s) => s.input?.toolId === "business_reviews_search"
  );

  const sentimentEvidence = safeEvidence.find(
    (e) => e.evidenceType === "sentiment_analysis" || e.toolId === "review_sentiment_analyzer"
  );
  const sentimentStep = completedToolSteps.find(
    (s) => s.input?.toolId === "review_sentiment_analyzer"
  );

  let feasibility = "Unknown";
  let suggestedStack = [];
  let marketFitScore = null;
  const keyRisks = [];

  const techData = techEvidence?.data ?? techIdeaStep?.output;
  if (techData && typeof techData === "object") {
    if (typeof techData.feasibility === "string") {
      feasibility = techData.feasibility;
    }
    if (Array.isArray(techData.suggestedStack)) {
      suggestedStack = [...techData.suggestedStack];
    }
    if (typeof techData.marketFitScore === "number" && isFinite(techData.marketFitScore)) {
      marketFitScore = techData.marketFitScore;
    }
    if (Array.isArray(techData.risks)) {
      keyRisks.push(...techData.risks);
    }
  }

  // If any tool failed in steps, append the failure as an explicit risk
  for (const failed of failedTools) {
    keyRisks.push(`Tool execution failed for '${failed.toolId}': ${failed.error}`);
  }

  // --- Local tool evidence extraction & cross-tool integrity verification ---
  let hasValidNearbyEvidence = false;
  let competitorCount = 0;
  let competitorDensity = null;
  let averageCompetitorRating = null;
  let totalCompetitorReviews = 0;
  let discoveredBusinesses = [];

  const nearbyData = nearbyEvidence?.data ?? nearbyStep?.output;
  if (nearbyData && typeof nearbyData === "object") {
    if (typeof nearbyData.totalFound === "number" && Array.isArray(nearbyData.businesses)) {
      hasValidNearbyEvidence = true;
      competitorCount = nearbyData.totalFound;
      discoveredBusinesses = nearbyData.businesses;
      if (nearbyData.density && typeof nearbyData.density === "object") {
        competitorDensity = { ...nearbyData.density };
      }
      if (typeof nearbyData.averageRating === "number" && isFinite(nearbyData.averageRating)) {
        averageCompetitorRating = nearbyData.averageRating;
      }
      if (typeof nearbyData.totalReviews === "number" && isFinite(nearbyData.totalReviews)) {
        totalCompetitorReviews = nearbyData.totalReviews;
      }
    }
  }

  let hasValidReviewsEvidence = false;
  let reviewedBusinessName = null;
  let reviewsSampled = 0;
  let integrityRisk = null;

  const reviewsData = reviewsEvidence?.data ?? reviewsStep?.output;
  if (reviewsData && typeof reviewsData === "object") {
    const reviewBusinessId =
      typeof reviewsData.businessId === "string" ? reviewsData.businessId.trim() : "";
    const reviewBusinessName =
      typeof reviewsData.businessName === "string" ? reviewsData.businessName.trim() : "";

    if (hasValidNearbyEvidence) {
      const matchingCompetitor = discoveredBusinesses.find(
        (b) => typeof b.placeId === "string" && b.placeId.trim() === reviewBusinessId
      );

      if (matchingCompetitor) {
        hasValidReviewsEvidence = true;
        reviewedBusinessName = reviewBusinessName || matchingCompetitor.name || null;
        reviewsSampled =
          typeof reviewsData.totalReviews === "number"
            ? reviewsData.totalReviews
            : Array.isArray(reviewsData.reviews)
              ? reviewsData.reviews.length
              : 0;
      } else {
        integrityRisk = `Evidence mismatch: Reviews target placeId '${reviewBusinessId}' does not match any discovered nearby business`;
      }
    } else if (!nearbyEvidence && !nearbyStep) {
      hasValidReviewsEvidence = true;
      reviewedBusinessName = reviewBusinessName || null;
      reviewsSampled =
        typeof reviewsData.totalReviews === "number"
          ? reviewsData.totalReviews
          : Array.isArray(reviewsData.reviews)
            ? reviewsData.reviews.length
            : 0;
    } else {
      integrityRisk = "Evidence mismatch: Reviews executed with missing or invalid nearby search evidence";
    }
  }

  let hasValidSentimentEvidence = false;
  let sentimentSummary = null;
  let sentimentStrengths = [];
  let sentimentWeaknesses = [];
  let sentimentOpportunities = [];
  let overallSentiment = null;
  let sentimentConfidence = null;

  const sentimentData = sentimentEvidence?.data ?? sentimentStep?.output;
  if (sentimentData && typeof sentimentData === "object") {
    const rawTargetName =
      (typeof sentimentData.businessName === "string" && sentimentData.businessName.trim()) ||
      (typeof sentimentEvidence?.metadata?.params?.businessName === "string" &&
        sentimentEvidence.metadata.params.businessName.trim()) ||
      (typeof sentimentStep?.input?.businessName === "string" &&
        sentimentStep.input.businessName.trim()) ||
      (typeof sentimentStep?.input?.params?.businessName === "string" &&
        sentimentStep.input.params.businessName.trim()) ||
      null;
    const sentimentTargetName = rawTargetName ? rawTargetName.trim() : null;

    const isNameMatching =
      !reviewedBusinessName ||
      !sentimentTargetName ||
      reviewedBusinessName.toLowerCase() === sentimentTargetName.toLowerCase();

    if (isNameMatching && (!reviewsEvidence && !reviewsStep || hasValidReviewsEvidence)) {
      hasValidSentimentEvidence = true;
      if (typeof sentimentData.summary === "string") sentimentSummary = sentimentData.summary;
      if (Array.isArray(sentimentData.strengths)) sentimentStrengths = [...sentimentData.strengths];
      if (Array.isArray(sentimentData.weaknesses)) sentimentWeaknesses = [...sentimentData.weaknesses];
      if (Array.isArray(sentimentData.opportunities)) sentimentOpportunities = [...sentimentData.opportunities];
      if (typeof sentimentData.overallSentiment === "string") overallSentiment = sentimentData.overallSentiment;
      if (typeof sentimentData.confidence === "string" || typeof sentimentData.confidence === "number") {
        sentimentConfidence = sentimentData.confidence;
      }
    } else if (!integrityRisk) {
      integrityRisk = `Evidence mismatch: Sentiment analyzed business '${sentimentTargetName}' does not match reviewed business '${reviewedBusinessName}'`;
    }
  }

  if (integrityRisk) {
    keyRisks.push(integrityRisk);
    partial = true;
  }

  // Dynamic unverified dimensions reflecting the actual evidence chain
  const unverifiedDimensions = [];
  if (!hasValidNearbyEvidence) {
    unverifiedDimensions.push("Local competitor density");
    unverifiedDimensions.push("Local competitor reviews");
    unverifiedDimensions.push("Customer sentiment analysis");
  } else if (!hasValidReviewsEvidence) {
    unverifiedDimensions.push("Local competitor reviews");
    unverifiedDimensions.push("Customer sentiment analysis");
  } else if (!hasValidSentimentEvidence) {
    unverifiedDimensions.push("Customer sentiment analysis");
  }

  unverifiedDimensions.push("Financial unit economics");
  unverifiedDimensions.push("Regulatory & compliance constraints");

  // 3. Deterministic verdict and confidence calculation (Phase 6 exact formula)
  let verdict = "INCONCLUSIVE";
  let confidenceScore = 0;
  let summary = "";
  const recommendations = [];

  const goalSnippet =
    cleanGoal.length > 80 ? `${cleanGoal.slice(0, 80)}...` : cleanGoal;

  if (successfulTools.length === 0) {
    verdict = "INCONCLUSIVE";
    confidenceScore = 0;
    summary = `Investigated viability for '${goalSnippet}'. No valid tool execution evidence collected. Cannot evaluate viability deterministically.`;
    recommendations.push(
      "Execute planned analysis tools before requesting final recommendation."
    );
  } else {
    // Grounded confidence score derived strictly from actual marketFitScore (0-10)
    let rawConfidence = marketFitScore !== null ? marketFitScore : 5.0;

    if (partial) {
      verdict = "NEEDS_REFINEMENT";
      // Penalize confidence for partial or failed executions
      rawConfidence = Math.max(1.0, rawConfidence * 0.7);
      summary = `Investigated viability for '${goalSnippet}'. Analysis is partial with ${failedTools.length} failed tool step(s). Feasibility is ${feasibility.toLowerCase()}.`;
    } else {
      if (feasibility.toLowerCase() === "high" && marketFitScore !== null && marketFitScore >= 7.0) {
        verdict = "VIABLE";
      } else if (
        feasibility.toLowerCase() === "low" ||
        (marketFitScore !== null && marketFitScore < 4.0)
      ) {
        verdict = "HIGH_RISK";
      } else {
        verdict = "NEEDS_REFINEMENT";
      }

      summary = `Investigated technology idea viability for '${goalSnippet}'. Tool analysis indicates ${feasibility.toLowerCase()} technical feasibility with a ${marketFitScore}/10 market fit score.`;
    }

    // Append local evidence context to summary if verified
    if (hasValidNearbyEvidence) {
      summary += ` Local competitor analysis identified ${competitorCount} nearby competitor(s)`;
      if (averageCompetitorRating !== null) {
        summary += ` with ${averageCompetitorRating} avg rating`;
      }
      summary += `.`;
      if (hasValidSentimentEvidence && sentimentSummary) {
        summary += ` Customer sentiment: ${sentimentSummary}`;
      }
    }

    confidenceScore = Number(rawConfidence.toFixed(1));

    // Recommendations derived strictly from evidence
    if (suggestedStack.length > 0) {
      recommendations.push(
        `Proceed with MVP architecture using ${suggestedStack.join(", ")}.`
      );
    }
    if (keyRisks.length > 0) {
      const topRisk = keyRisks[0];
      recommendations.push(`Prioritize risk mitigation for: ${topRisk}.`);
    }
    if (cleanLocation) {
      recommendations.push(
        `Conduct field validation and customer discovery in ${cleanLocation}.`
      );
    }
    if (hasValidSentimentEvidence && sentimentOpportunities.length > 0) {
      recommendations.push(
        `Consider addressing unmet needs: ${sentimentOpportunities.join(", ")}.`
      );
    }
    if (hasValidSentimentEvidence && sentimentWeaknesses.length > 0 && competitorCount > 0) {
      recommendations.push(
        `Competitors show weaknesses in: ${sentimentWeaknesses.join(", ")}. Differentiate here.`
      );
    }
    if (partial) {
      recommendations.push(
        "Re-run failed or unexecuted tool steps to complete unverified analysis dimensions."
      );
    }
  }

  let marketFitAnalysis =
    marketFitScore !== null
      ? `Derived strictly from tech_idea_analysis tool findings (${marketFitScore}/10).`
      : "Market fit score not evaluated.";

  if (hasValidNearbyEvidence) {
    marketFitAnalysis += ` Local competitor density: ${competitorCount} discovered within search radius.`;
  } else {
    marketFitAnalysis += ` Live consumer reviews and local competitor density were not evaluated.`;
  }

  const hasAnyLocalEvidence =
    hasValidNearbyEvidence || hasValidReviewsEvidence || hasValidSentimentEvidence;

  const finalOutput = {
    summary,
    verdict,
    confidenceScore,
    feasibility,
    suggestedStack,
    marketFit: {
      score: marketFitScore,
      analysis: marketFitAnalysis,
    },
    keyRisks,
    recommendations,
    evidence: {
      totalSteps: toolSteps.length,
      toolsExecuted,
      successfulTools,
      failedTools,
      partial,
      unverifiedDimensions,
    },
    synthesizedAt: new Date(),
  };

  if (hasAnyLocalEvidence) {
    finalOutput.localEvidence = {
      ...(hasValidNearbyEvidence
        ? {
            competitorCount,
            competitorDensity,
            averageCompetitorRating,
            totalCompetitorReviews,
          }
        : {}),
      ...(hasValidReviewsEvidence
        ? {
            reviewedBusinessName,
            reviewsSampled,
          }
        : {}),
      ...(hasValidSentimentEvidence
        ? {
            sentimentSummary,
            sentimentStrengths,
            sentimentWeaknesses,
            sentimentOpportunities,
            overallSentiment,
            sentimentConfidence,
          }
        : {}),
    };
  }

  return finalOutput;
};

export { SynthesizerError, synthesizeFinalRecommendation };


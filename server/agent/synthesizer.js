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

  // Only consider a tool failed if it remains UNRESOLVED (i.e. has no completed attempt or evidence)
  const unresolvedFailedSteps = failedToolSteps.filter(
    (s) => s.input?.toolId && !successfulTools.includes(s.input.toolId)
  );

  // Take the latest failed attempt for each unresolved tool
  const unresolvedFailedByTool = new Map();
  for (const s of unresolvedFailedSteps) {
    const toolId = s.input?.toolId || "unknown";
    unresolvedFailedByTool.set(toolId, s);
  }

  const failedTools = Array.from(unresolvedFailedByTool.values()).map((s) => {
    const rawError = s.error;
    let errorMessage = "Tool execution failed";
    if (typeof rawError === "string" && rawError.trim()) {
      errorMessage = rawError.trim();
    } else if (rawError && typeof rawError === "object") {
      errorMessage = rawError.message || rawError.code || "Tool execution failed";
    }
    return {
      toolId: s.input?.toolId || "unknown",
      error: errorMessage,
    };
  });

  // 2. Locate evidence objects across all execution steps
  const techEvidence = safeEvidence.find(
    (e) => e.evidenceType === "tech_assessment" || e.toolId === "tech_idea_analysis"
  );
  const techIdeaStep = completedToolSteps.find(
    (s) => s.input?.toolId === "tech_idea_analysis"
  );

  const allNearbyEvidence = safeEvidence.filter(
    (e) =>
      (e.evidenceType === "competitor_discovery" ||
        e.toolId === "nearby_business_search") &&
      e.status !== "contradicted" &&
      e.status !== "stale"
  );
  const allNearbySteps = completedToolSteps.filter(
    (s) => s.input?.toolId === "nearby_business_search"
  );

  const allReviewsEvidence = safeEvidence.filter(
    (e) =>
      (e.evidenceType === "customer_reviews" ||
        e.toolId === "business_reviews_search") &&
      e.status !== "contradicted" &&
      e.status !== "stale"
  );
  const allReviewsSteps = completedToolSteps.filter(
    (s) => s.input?.toolId === "business_reviews_search"
  );

  const allSentimentEvidence = safeEvidence.filter(
    (e) =>
      (e.evidenceType === "sentiment_analysis" ||
        e.toolId === "review_sentiment_analyzer") &&
      e.status !== "contradicted" &&
      e.status !== "stale"
  );
  const allSentimentSteps = completedToolSteps.filter(
    (s) => s.input?.toolId === "review_sentiment_analyzer"
  );

  const nearbyEvidence = allNearbyEvidence.length > 0
    ? allNearbyEvidence[allNearbyEvidence.length - 1]
    : null;
  const nearbyStep = allNearbySteps.length > 0
    ? allNearbySteps[allNearbySteps.length - 1]
    : null;

  const reviewsEvidence = allReviewsEvidence.length > 0
    ? allReviewsEvidence[allReviewsEvidence.length - 1]
    : null;
  const reviewsStep = allReviewsSteps.length > 0
    ? allReviewsSteps[allReviewsSteps.length - 1]
    : null;

  const sentimentEvidence = allSentimentEvidence.length > 0
    ? allSentimentEvidence[allSentimentEvidence.length - 1]
    : null;
  const sentimentStep = allSentimentSteps.length > 0
    ? allSentimentSteps[allSentimentSteps.length - 1]
    : null;

  let feasibility = null;
  let suggestedStack = [];
  let marketFitScore = null;
  const keyRisks = [];

  const techData = techEvidence?.data ?? techIdeaStep?.output;
  if (techData && typeof techData === "object") {
    feasibility =
      typeof techData.feasibility === "string" ? techData.feasibility : "Unknown";
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

  // Deduplicate discovered businesses across all competitor discovery records and steps by placeId
  const discoveredBusinessesMap = new Map();
  for (const ne of allNearbyEvidence) {
    if (Array.isArray(ne.data?.businesses)) {
      for (const b of ne.data.businesses) {
        const placeId = typeof b?.placeId === "string" ? b.placeId.trim() : null;
        if (placeId && !discoveredBusinessesMap.has(placeId)) {
          discoveredBusinessesMap.set(placeId, b);
        }
      }
    }
  }
  for (const ns of allNearbySteps) {
    if (Array.isArray(ns.output?.businesses)) {
      for (const b of ns.output.businesses) {
        const placeId = typeof b?.placeId === "string" ? b.placeId.trim() : null;
        if (placeId && !discoveredBusinessesMap.has(placeId)) {
          discoveredBusinessesMap.set(placeId, b);
        }
      }
    }
  }
  discoveredBusinesses = Array.from(discoveredBusinessesMap.values());

  const nearbyData = nearbyEvidence?.data ?? nearbyStep?.output;
  if (allNearbyEvidence.length > 0 || allNearbySteps.length > 0) {
    hasValidNearbyEvidence = true;
    competitorCount = discoveredBusinesses.length;
    if (typeof nearbyData?.totalFound === "number") {
      competitorCount = Math.max(competitorCount, nearbyData.totalFound);
    }
    if (nearbyData?.density && typeof nearbyData.density === "object") {
      competitorDensity = { ...nearbyData.density };
    }
    if (typeof nearbyData?.averageRating === "number" && isFinite(nearbyData.averageRating)) {
      averageCompetitorRating = nearbyData.averageRating;
    }
    if (typeof nearbyData?.totalReviews === "number" && isFinite(nearbyData.totalReviews)) {
      totalCompetitorReviews = nearbyData.totalReviews;
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
  }

  // --- Mode determination ---
  const hasValidTechEvidence = Boolean(
    techData && typeof techData === "object"
  );
  const hasAnyLocalEvidence = Boolean(
    hasValidNearbyEvidence || hasValidReviewsEvidence || hasValidSentimentEvidence
  );
  const ventureType = String(
    run.plan?.ventureType || run.plan?.category || ""
  ).toLowerCase();

  const plannedToolIds = Array.isArray(run.plan?.steps)
    ? run.plan.steps.map((s) => (typeof s === "string" ? s : s?.toolId)).filter(Boolean)
    : [];
  const hasPlannedTech = plannedToolIds.includes("tech_idea_analysis");
  const hasPlannedLocal = plannedToolIds.some((id) =>
    ["nearby_business_search", "business_reviews_search", "review_sentiment_analyzer"].includes(id)
  );

  const isLocalMode =
    (hasAnyLocalEvidence || (!hasValidTechEvidence && (ventureType === "local" || (hasPlannedLocal && !hasPlannedTech)))) &&
    !hasValidTechEvidence;
  const isTechMode =
    (hasValidTechEvidence || (!hasAnyLocalEvidence && (ventureType === "tech" || hasPlannedTech || !isLocalMode))) &&
    !hasAnyLocalEvidence;
  const isHybridMode = hasValidTechEvidence && hasAnyLocalEvidence;

  // Determine if synthesis is partial based on evidence completeness and execution integrity
  let partial = false;
  if (failedTools.length > 0) {
    partial = true;
  } else if (integrityRisk) {
    partial = true;
  } else if (toolSteps.length === 0 && safeEvidence.length === 0) {
    partial = true;
  } else if (plannedToolIds.length > 0 && successfulTools.length < plannedToolIds.length) {
    partial = true;
  } else if (
    hasValidNearbyEvidence &&
    competitorCount > 0 &&
    (!hasValidReviewsEvidence || !hasValidSentimentEvidence)
  ) {
    // Genuinely incomplete local investigation: competitors exist, but reviews or sentiment were never collected
    partial = true;
  } else if (!hasValidNearbyEvidence && !hasValidTechEvidence) {
    // No valid domain evidence collected
    partial = true;
  } else if (hasValidTechEvidence && feasibility === "Unknown") {
    partial = true;
  }

  // Dynamic unverified dimensions reflecting the actual evidence chain
  const unverifiedDimensions = [];
  if (!hasValidNearbyEvidence) {
    unverifiedDimensions.push("Local competitor density");
    unverifiedDimensions.push("Local competitor reviews");
    unverifiedDimensions.push("Customer sentiment analysis");
  } else if (competitorCount > 0 && !hasValidReviewsEvidence) {
    unverifiedDimensions.push("Local competitor reviews");
    unverifiedDimensions.push("Customer sentiment analysis");
  } else if (competitorCount > 0 && !hasValidSentimentEvidence) {
    unverifiedDimensions.push("Customer sentiment analysis");
  } else if (competitorCount === 0) {
    unverifiedDimensions.push("Direct customer demand validation");
  }

  unverifiedDimensions.push("Financial unit economics");
  unverifiedDimensions.push("Regulatory & compliance constraints");

  // Mode-specific grounded risks
  if (isLocalMode) {
    if (averageCompetitorRating !== null && averageCompetitorRating >= 4.5 && competitorCount > 0) {
      keyRisks.push(
        `High competitor satisfaction: nearby competitors maintain a strong average rating of ${averageCompetitorRating} ★, requiring meaningful differentiation in pricing, menu quality, or service.`
      );
    }
    if (totalCompetitorReviews !== null && totalCompetitorReviews < 100 && competitorCount > 0) {
      keyRisks.push(
        `Limited feedback volume: total verified review volume is low (${totalCompetitorReviews} reviews across ${competitorCount} businesses), signaling unvalidated broader customer demand.`
      );
    }
    if (competitorCount === 0 && hasValidNearbyEvidence) {
      keyRisks.push(
        `Zero direct competitors identified in search catchment; market demand for this concept in this specific location remains unvalidated.`
      );
    }
    keyRisks.push(
      "Financial unit economics, physical lease/stall costs, and operating margins have not been verified."
    );
  }

  // 3. Deterministic verdict, confidence, and summary calculation
  let verdict = "INCONCLUSIVE";
  let confidenceScore = 0;
  let summary = "";
  const recommendations = [];

  const goalSnippet =
    cleanGoal.length > 80 ? `${cleanGoal.slice(0, 80)}...` : cleanGoal;

  if (successfulTools.length === 0) {
    verdict = "INCONCLUSIVE";
    confidenceScore = 0;
    feasibility = isLocalMode ? null : "Unknown";
    summary = `Investigated viability for '${goalSnippet}'. No valid tool execution evidence collected. Cannot evaluate viability deterministically.`;
    recommendations.push(
      "Execute planned analysis tools before requesting final recommendation."
    );
  } else if (isLocalMode) {
    // -------------------------------------------------------------
    // LOCAL MODE: Evidence-grounded local market synthesis
    // -------------------------------------------------------------
    feasibility = null;
    suggestedStack = [];
    marketFitScore = null;

    let rawConfidence = 5.0;

    if (partial) {
      verdict = "NEEDS_REFINEMENT";
      rawConfidence = Math.max(1.0, 5.0 * 0.7);
      summary = `Investigated local market viability for '${goalSnippet}'${cleanLocation ? ` in ${cleanLocation}` : ""}. Analysis is partial with ${failedTools.length} failed tool step(s).${hasValidNearbyEvidence ? ` Competitor discovery identified ${competitorCount} nearby business(es)${averageCompetitorRating !== null ? ` with ${averageCompetitorRating} avg rating` : ""}.` : ""}`;
    } else {
      if (overallSentiment && overallSentiment.toLowerCase() === "negative") {
        verdict = "HIGH_RISK";
      } else if (competitorCount === 0) {
        verdict = "NEEDS_REFINEMENT";
      } else {
        // Sufficiently complete local evidence: early-stage physical venture facing established
        // competitors requires business-model refinement and field validation before capital commitment
        verdict = "NEEDS_REFINEMENT";
      }

      if (competitorCount === 0) {
        summary = `Investigated local market viability for '${goalSnippet}'${cleanLocation ? ` in ${cleanLocation}` : ""}. Local competitor discovery identified 0 nearby businesses within the search radius. Market validation is limited due to the lack of observable direct competitors.`;
      } else {
        summary = `Investigated local market viability for '${goalSnippet}'${cleanLocation ? ` in ${cleanLocation}` : ""}. Competitor discovery identified ${competitorCount} nearby business(es)${averageCompetitorRating !== null ? ` with ${averageCompetitorRating} avg rating` : ""}${totalCompetitorReviews > 0 ? ` across ${totalCompetitorReviews} total reviews` : ""}.${reviewedBusinessName ? ` Customer review sampling for primary competitor '${reviewedBusinessName}' analyzed ${reviewsSampled} review(s).` : ""}${hasValidSentimentEvidence && sentimentSummary ? ` Customer sentiment analysis: ${sentimentSummary}` : ""}`;
      }
    }

    confidenceScore = Number(rawConfidence.toFixed(1));

    // LOCAL recommendations grounded in findings
    if (cleanLocation) {
      recommendations.push(
        `Conduct on-the-ground foot-traffic analysis and direct customer discovery in ${cleanLocation}.`
      );
    }
    if (hasValidSentimentEvidence && sentimentOpportunities.length > 0) {
      recommendations.push(
        `Address identified market opportunities: ${sentimentOpportunities.join(", ")}.`
      );
    }
    if (hasValidSentimentEvidence && sentimentWeaknesses.length > 0 && competitorCount > 0) {
      recommendations.push(
        `Differentiate from existing competitors by solving customer pain points: ${sentimentWeaknesses.join(", ")}.`
      );
    }
    if (hasValidNearbyEvidence && competitorCount > 0) {
      recommendations.push(
        `Benchmark menu offerings and price points against primary competitor '${reviewedBusinessName || "identified competitors"}' to validate value proposition.`
      );
    } else if (competitorCount === 0 && hasValidNearbyEvidence) {
      recommendations.push(
        "Survey local foot-traffic and nearby consumers to confirm baseline demand before committing to a physical location."
      );
    }
    if (partial) {
      recommendations.push(
        "Re-run failed or unexecuted tool steps to complete unverified analysis dimensions."
      );
    }
    recommendations.push(
      "Model initial capital expenditures, food cost margins, and break-even daily customer volume."
    );
  } else {
    // -------------------------------------------------------------
    // TECH OR HYBRID MODE: Technical feasibility & market fit synthesis
    // -------------------------------------------------------------
    if (feasibility === null) {
      feasibility = "Unknown";
    }

    let rawConfidence = marketFitScore !== null ? marketFitScore : 5.0;

    if (partial) {
      verdict = "NEEDS_REFINEMENT";
      rawConfidence = Math.max(1.0, rawConfidence * 0.7);
      summary = `Investigated viability for '${goalSnippet}'. Analysis is partial with ${failedTools.length} failed tool step(s). Feasibility is ${feasibility ? feasibility.toLowerCase() : "unknown"}.`;
    } else {
      if (
        feasibility &&
        feasibility.toLowerCase() === "high" &&
        marketFitScore !== null &&
        marketFitScore >= 7.0
      ) {
        verdict = "VIABLE";
      } else if (
        (feasibility && feasibility.toLowerCase() === "low") ||
        (marketFitScore !== null && marketFitScore < 4.0)
      ) {
        verdict = "HIGH_RISK";
      } else {
        verdict = "NEEDS_REFINEMENT";
      }

      if (isHybridMode) {
        summary = `Investigated venture viability for '${goalSnippet}'${cleanLocation ? ` in ${cleanLocation}` : ""}. Technical feasibility is ${feasibility ? feasibility.toLowerCase() : "unknown"} with a ${marketFitScore}/10 market fit score.`;
      } else {
        summary = `Investigated technology idea viability for '${goalSnippet}'. Tool analysis indicates ${feasibility ? feasibility.toLowerCase() : "unknown"} technical feasibility with a ${marketFitScore}/10 market fit score.`;
      }
    }

    // Append local evidence context to summary if verified (for hybrid mode)
    if (hasValidNearbyEvidence && isHybridMode) {
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

  // Market Fit analysis text
  let marketFitAnalysis = "";
  if (isLocalMode) {
    if (hasValidNearbyEvidence) {
      if (competitorCount === 0) {
        marketFitAnalysis = `Local market discovery identified 0 direct competitors within search radius${cleanLocation ? ` in ${cleanLocation}` : ""}. Further customer discovery is needed to validate local market demand.`;
      } else {
        marketFitAnalysis = `Local market discovery identified ${competitorCount} competitor(s) within the search catchment area${averageCompetitorRating !== null ? ` with an average rating of ${averageCompetitorRating} ★` : ""}.${reviewedBusinessName ? ` Primary competitor '${reviewedBusinessName}' analyzed across ${reviewsSampled} customer review(s).` : ""}`;
      }
    } else {
      marketFitAnalysis = "Local market competitor density and customer reviews were not evaluated.";
    }
  } else {
    marketFitAnalysis =
      marketFitScore !== null
        ? `Derived strictly from tech_idea_analysis tool findings (${marketFitScore}/10).`
        : "Market fit score not evaluated.";

    if (hasValidNearbyEvidence) {
      marketFitAnalysis += ` Local competitor density: ${competitorCount} discovered within search radius.`;
    } else {
      marketFitAnalysis += ` Live consumer reviews and local competitor density were not evaluated.`;
    }
  }

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
            discoveredBusinesses: discoveredBusinesses.slice(0, 5),
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


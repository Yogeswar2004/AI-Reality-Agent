class SynthesizerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "SynthesizerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Pure deterministic synthesis function.
 * Derives every claim, score, suggested technology, and risk solely from
 * actual completed tool outputs in `steps`. Zero invented market evidence.
 *
 * Side-effect-free: no DB access, no network calls, no state mutations.
 *
 * @param {Object} params
 * @param {Object} params.run - Read-only agent run snapshot { _id, goal, location, budget, stepCount, plan }
 * @param {Array<Object>} [params.steps=[]] - Read-only array of step documents for this run
 * @returns {Object} Structured finalOutput recommendation
 */
const synthesizeFinalRecommendation = ({ run, steps = [] }) => {
  if (!run || typeof run !== "object") {
    throw new SynthesizerError("Run object is required for synthesis", "INVALID_RUN", 400);
  }

  if (typeof run.goal !== "string" || !run.goal.trim()) {
    throw new SynthesizerError("Run must have a valid goal for synthesis", "INVALID_GOAL", 400);
  }

  const cleanGoal = run.goal.trim();
  const cleanLocation = typeof run.location === "string" ? run.location.trim() || null : null;

  // 1. Partition steps
  const safeSteps = Array.isArray(steps) ? steps : [];
  const toolSteps = safeSteps.filter((s) => s && s.type === "tool_execution");
  const completedToolSteps = toolSteps.filter((s) => s.status === "completed");
  const failedToolSteps = toolSteps.filter((s) => s.status === "failed");

  const toolsExecuted = toolSteps
    .map((s) => s.input?.toolId)
    .filter((id) => typeof id === "string");

  const successfulTools = completedToolSteps
    .map((s) => s.input?.toolId)
    .filter((id) => typeof id === "string");

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
  } else if (toolSteps.length === 0) {
    partial = true;
  }

  // 2. Extract tool-grounded outputs (specifically tech_idea_analysis)
  const techIdeaStep = completedToolSteps.find(
    (s) => s.input?.toolId === "tech_idea_analysis"
  );

  let feasibility = "Unknown";
  let suggestedStack = [];
  let marketFitScore = null;
  const keyRisks = [];

  if (techIdeaStep && techIdeaStep.output) {
    const out = techIdeaStep.output;
    if (typeof out.feasibility === "string") {
      feasibility = out.feasibility;
    }
    if (Array.isArray(out.suggestedStack)) {
      suggestedStack = [...out.suggestedStack];
    }
    if (typeof out.marketFitScore === "number" && isFinite(out.marketFitScore)) {
      marketFitScore = out.marketFitScore;
    }
    if (Array.isArray(out.risks)) {
      keyRisks.push(...out.risks);
    }
  }

  // If any tool failed, append the failure as an explicit risk
  for (const failed of failedTools) {
    keyRisks.push(`Tool execution failed for '${failed.toolId}': ${failed.error}`);
  }

  // Explicit disclosure of unanalyzed dimensions (no fabricated evidence)
  const unverifiedDimensions = [
    "Local competitor reviews",
    "Financial unit economics",
    "Regulatory & compliance constraints",
  ];

  // 3. Deterministic verdict and confidence calculation
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
    // Grounded confidence score derived from actual marketFitScore (0-10)
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
    if (partial) {
      recommendations.push(
        "Re-run failed or unexecuted tool steps to complete unverified analysis dimensions."
      );
    }
  }

  const marketFitAnalysis =
    marketFitScore !== null
      ? `Derived strictly from tech_idea_analysis tool findings (${marketFitScore}/10). Live consumer reviews and local competitor density were not evaluated.`
      : "Market fit score not evaluated.";

  return {
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
};

export { SynthesizerError, synthesizeFinalRecommendation };


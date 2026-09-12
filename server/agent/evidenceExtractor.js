import { TOOL_IDS } from "./toolConstants.js";
import { createAgentEvidence } from "./agentEvidence.js";

/**
 * Pure extraction function that translates a completed agent step into an evidence payload.
 *
 * @param {Object} step - The step document (persisted or serialized).
 * @param {Object} [runContext={}] - Additional context such as { userId }.
 * @returns {Object|null} Extracted evidence record object or null if step produces no evidence.
 */
export const extractEvidenceFromStep = (step, runContext = {}) => {
  if (!step || typeof step !== "object") {
    return null;
  }

  // Only completed tool_execution steps yield evidence
  if (step.status !== "completed") {
    return null;
  }

  if (step.type !== "tool_execution") {
    return null;
  }

  if (!step.output || typeof step.output !== "object") {
    return null;
  }

  const toolId = step.input?.toolId;
  if (!toolId) {
    return null;
  }

  const isMock = process.env.MOCK_MODE !== "false";
  let evidenceType = null;
  let provider = null;
  let confidence = null;
  let data = null;

  switch (toolId) {
    case TOOL_IDS.TECH_IDEA_ANALYSIS: {
      evidenceType = "tech_assessment";
      provider = "internal_fixture";
      confidence = null; // Do not fabricate confidence
      data = {
        feasibility: step.output.feasibility,
        suggestedStack: Array.isArray(step.output.suggestedStack)
          ? [...step.output.suggestedStack]
          : [],
        marketFitScore: step.output.marketFitScore,
        risks: Array.isArray(step.output.risks)
          ? [...step.output.risks]
          : [],
      };
      break;
    }

    case TOOL_IDS.NEARBY_BUSINESS_SEARCH: {
      evidenceType = "competitor_discovery";
      provider = isMock ? "internal_fixture" : "rapidapi";
      confidence = null;
      data = {
        totalFound:
          typeof step.output.totalFound === "number"
            ? step.output.totalFound
            : step.output.businesses?.length || 0,
        searchRadius: step.output.searchRadius,
        businesses: Array.isArray(step.output.businesses)
          ? [...step.output.businesses]
          : [],
        density: step.output.density || null,
        averageRating: step.output.averageRating,
        totalReviews: step.output.totalReviews,
      };
      break;
    }

    case TOOL_IDS.BUSINESS_REVIEWS_SEARCH: {
      evidenceType = "customer_reviews";
      provider = isMock ? "internal_fixture" : "rapidapi";
      confidence = null;
      data = {
        businessId: step.output.businessId,
        businessName: step.output.businessName,
        totalReviews:
          typeof step.output.totalReviews === "number"
            ? step.output.totalReviews
            : step.output.reviews?.length || 0,
        reviews: Array.isArray(step.output.reviews)
          ? [...step.output.reviews]
          : [],
      };
      break;
    }

    case TOOL_IDS.REVIEW_SENTIMENT_ANALYZER: {
      evidenceType = "sentiment_analysis";
      provider = isMock ? "internal_fixture" : "gemini";
      confidence =
        typeof step.output.confidence === "number" ||
        (typeof step.output.confidence === "string" &&
          step.output.confidence.trim())
          ? step.output.confidence
          : null;

      const rawBusinessName =
        (typeof step.input?.params?.businessName === "string" &&
          step.input.params.businessName.trim()) ||
        (typeof step.input?.businessName === "string" &&
          step.input.businessName.trim()) ||
        (typeof step.output?.businessName === "string" &&
          step.output.businessName.trim()) ||
        null;
      const businessName = rawBusinessName ? rawBusinessName.trim() : null;

      data = {
        businessName,
        summary: step.output.summary,
        strengths: Array.isArray(step.output.strengths)
          ? [...step.output.strengths]
          : [],
        weaknesses: Array.isArray(step.output.weaknesses)
          ? [...step.output.weaknesses]
          : [],
        commonComplaints: Array.isArray(step.output.commonComplaints)
          ? [...step.output.commonComplaints]
          : [],
        customerLikes: Array.isArray(step.output.customerLikes)
          ? [...step.output.customerLikes]
          : [],
        opportunities: Array.isArray(step.output.opportunities)
          ? [...step.output.opportunities]
          : [],
        overallSentiment: step.output.overallSentiment,
        confidence: step.output.confidence,
        reviewsAnalyzed: step.output.reviewsAnalyzed,
      };
      break;
    }

    default:
      return null;
  }

  const userId = runContext.userId || step.userId || null;
  const runId = step.runId ? step.runId.toString() : null;
  const stepId = step._id ? step._id.toString() : null;
  const retrievedAt = step.completedAt
    ? new Date(step.completedAt)
    : new Date();

  return {
    runId,
    stepId,
    userId,
    toolId,
    evidenceType,
    data,
    provider,
    status: "valid",
    retrievedAt,
    confidence,
    metadata: {
      stepNumber: step.stepNumber || null,
      isMock,
      params: step.input?.params || null,
    },
  };
};

/**
 * Extracts and persists evidence for a step into the agent_evidence collection.
 *
 * @param {Object} params
 * @param {Object} params.step - The finalized step document.
 * @param {string} params.runId - Run ID.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<Object|null>} Serialized evidence document or null if no evidence produced.
 */
export const extractAndPersistStepEvidence = async ({
  step,
  runId,
  userId,
}) => {
  const extracted = extractEvidenceFromStep(step, { userId });
  if (!extracted) {
    return null;
  }

  return await createAgentEvidence({
    ...extracted,
    runId: runId || extracted.runId,
    userId: userId || extracted.userId,
    stepId: extracted.stepId,
  });
};

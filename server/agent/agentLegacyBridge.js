import { ObjectId } from "mongodb";
import { extractBusinessType } from "./businessTypeUtils.js";

/**
 * Maps an agent run document from `agent_runs` to a legacy-compatible `idea` structure.
 * 
 * CORE SCORE INTEGRITY POLICY:
 * - Legacy overallScore, opportunityScore, and competition.score are strictly set to `null`.
 * - Zero fabricated constants or arbitrary thresholds are used.
 * - Native Agent metrics (verdict, confidenceScore, marketFit, localEvidence) are preserved.
 * - All nested structures required by legacy pages (such as AnalysisResults.jsx) are safely
 *   initialized with default empty arrays/objects to prevent runtime crashes.
 *
 * @param {Object} run - Agent run document from MongoDB.
 * @param {Object} [options]
 * @param {boolean} [options.detailed=false] - Whether to incorporate detailed evidence from agent_evidence.
 * @param {Array<Object>} [options.evidenceList=[]] - Evidence documents from agent_evidence for this run.
 * @returns {Object|null} Mapped legacy idea document.
 */
export const mapAgentRunToLegacyIdea = (run, { detailed = false, evidenceList = [] } = {}) => {
  if (!run || typeof run !== "object") {
    return null;
  }

  const runIdStr = run._id ? run._id.toString() : "";
  const userIdStr = run.userId ? String(run.userId) : "";
  const safeEvidence = Array.isArray(evidenceList) ? evidenceList : [];

  // Determine whether this is a local business investigation or a technology project
  const nearbyEv = safeEvidence.find(
    (e) => e.evidenceType === "competitor_discovery" || e.toolId === "nearby_business_search"
  );
  const hasLocalEvidence = Boolean(run.finalOutput?.localEvidence) || Boolean(nearbyEv);
  const isLocal = Boolean(run.location) || hasLocalEvidence;

  const formatLocation = (loc) => {
    if (!loc) return null;
    if (typeof loc === "string") return loc;
    if (typeof loc === "object") {
      return loc.label || (loc.latitude != null && loc.longitude != null ? `${loc.latitude}, ${loc.longitude}` : null);
    }
    return String(loc);
  };

  // Resolve specific local businessType in exact fallback order:
  // a. run.finalOutput?.localEvidence?.businessType
  // b. nearbyEv?.metadata?.params?.businessType
  // c. nearbyEv?.data?.businessType
  // d. run.plan?.steps?.find(s => s.toolId === "nearby_business_search")?.params?.businessType
  // e. extractBusinessType(run.goal)
  let resolvedBusinessType = null;
  if (isLocal) {
    const candidates = [
      run.finalOutput?.localEvidence?.businessType,
      nearbyEv?.metadata?.params?.businessType,
      nearbyEv?.data?.businessType,
      run.plan?.steps?.find((s) => s.toolId === "nearby_business_search")?.params?.businessType,
      typeof run.goal === "string" ? extractBusinessType(run.goal) : null,
    ];

    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) {
        const trimmed = c.trim();
        const lower = trimmed.toLowerCase();
        if (lower !== "local business" && lower !== "business") {
          resolvedBusinessType = trimmed;
          break;
        }
      }
    }
  }

  const baseIdea = {
    _id: runIdStr,
    userId: userIdStr,
    title: typeof run.goal === "string" && run.goal.trim() ? run.goal.trim() : "Untitled Investigation",
    description: typeof run.goal === "string" ? run.goal.trim() : "",
    category: isLocal ? "Local Business" : "Technology",
    analysisMode: isLocal ? "local" : "tech",
    businessType: isLocal ? resolvedBusinessType : null,
    location: formatLocation(run.location),
    rawLocation: run.location || null,
    searchRadius: isLocal ? 3000 : null,
    createdAt: run.createdAt || new Date(),
    updatedAt: run.updatedAt || new Date(),
    source: "agent_studio",
    agentState: run.state || "draft",
    runId: runIdStr,
    isAgentRun: true,
  };

  // Incomplete runs (draft, planning, awaiting_approval, executing, etc.) have analysis = null
  if (run.state !== "completed" || !run.finalOutput) {
    return {
      ...baseIdea,
      analysis: null,
      competitors: [],
      competitorCount: 0,
    };
  }

  const finalOutput = run.finalOutput;
  const verdict = typeof finalOutput.verdict === "string" ? finalOutput.verdict : "INCONCLUSIVE";
  const confidenceScore = typeof finalOutput.confidenceScore === "number" ? finalOutput.confidenceScore : null;
  const summary = typeof finalOutput.summary === "string" ? finalOutput.summary : "";
  const keyRisks = Array.isArray(finalOutput.keyRisks) ? finalOutput.keyRisks : [];
  const recommendations = Array.isArray(finalOutput.recommendations) ? finalOutput.recommendations : [];
  const marketFit = finalOutput.marketFit && typeof finalOutput.marketFit === "object" ? finalOutput.marketFit : null;
  const feasibility = typeof finalOutput.feasibility === "string" ? finalOutput.feasibility : null;
  const suggestedStack = Array.isArray(finalOutput.suggestedStack) ? finalOutput.suggestedStack : [];
  const localEvidence = finalOutput.localEvidence && typeof finalOutput.localEvidence === "object" ? finalOutput.localEvidence : null;

  // Harvest evidence items if available
  const discoveredBusinesses = localEvidence?.discoveredBusinesses || nearbyEv?.data?.businesses || [];
  const competitorCount = localEvidence?.competitorCount ?? (discoveredBusinesses.length || 0);
  const averageRating = localEvidence?.averageCompetitorRating ?? null;
  const totalReviews = localEvidence?.totalCompetitorReviews ?? 0;
  const competitorDensity = localEvidence?.competitorDensity ?? null;
  const densityObj = typeof competitorDensity === "object" && competitorDensity !== null ? competitorDensity : null;
  const sentimentSummary = localEvidence?.sentimentSummary || "";
  const sentimentStrengths = Array.isArray(localEvidence?.sentimentStrengths) ? localEvidence.sentimentStrengths : [];
  const sentimentWeaknesses = Array.isArray(localEvidence?.sentimentWeaknesses) ? localEvidence.sentimentWeaknesses : [];
  const sentimentOpportunities = Array.isArray(localEvidence?.sentimentOpportunities) ? localEvidence.sentimentOpportunities : [];

  if (isLocal) {
    return {
      ...baseIdea,
      competitors: discoveredBusinesses,
      competitorCount,
      analysis: {
        // STRICT SCORE INTEGRITY: Legacy scores remain null
        overallScore: null,
        opportunityScore: null,
        overallVerdict: verdict,
        verdict,
        confidenceScore,
        marketSummary: summary,
        competitionSummary: sentimentSummary || (marketFit?.analysis) || "",

        // Competition Object
        competition: {
          score: null, // STRICTLY NULL - NOT FABRICATED
          level: typeof competitorDensity === "string" ? competitorDensity : null,
          totalCompetitors: competitorCount,
          within500m: typeof densityObj?.within500m === "number" ? densityObj.within500m : null,
          within1km: typeof densityObj?.within1km === "number" ? densityObj.within1km : null,
          within3km: typeof densityObj?.within3km === "number" ? densityObj.within3km : null,
          averageRating,
          totalReviews,
          competitors: discoveredBusinesses,
        },

        // Preserve raw competitor density and local evidence structure
        competitorDensity: densityObj,
        localEvidence: localEvidence || (competitorCount > 0 ? {
          discoveredBusinesses,
          competitorCount,
          averageCompetitorRating: averageRating,
          totalCompetitorReviews: totalReviews,
          competitorDensity: densityObj,
          sentimentSummary,
          sentimentStrengths,
          sentimentWeaknesses,
          sentimentOpportunities,
        } : null),

        // Customer Insights Structure
        customerInsights: {
          whatCustomersLike: sentimentStrengths,
          commonComplaints: sentimentWeaknesses,
          unmetNeeds: sentimentOpportunities,
        },

        competitorStrengths: sentimentStrengths,
        competitorWeaknesses: sentimentWeaknesses,
        businessOpportunities: sentimentOpportunities,
        differentiationStrategies: recommendations,
        risks: keyRisks,
        recommendations,
        recommendedNextSteps: [],
        analyzedAt: finalOutput.synthesizedAt || run.completedAt || run.updatedAt,
        isAgentResult: true,
      },
    };
  }

  // Technology Idea Mode
  return {
    ...baseIdea,
    competitors: [],
    competitorCount: 0,
    analysis: {
      // STRICT SCORE INTEGRITY: Legacy scores remain null
      overallScore: null,
      opportunityScore: null,
      verdict,
      confidenceScore,
      marketFit,
      feasibility,
      technicalFeasibility: feasibility,
      suggestedStack,
      recommendation: summary,

      // Scores object with null metrics to prevent legacy property read errors
      scores: {
        competition: null,
        demand: null,
        development: null,
        monetization: null,
        seo: null,
      },

      // Guaranteed initialized arrays for TechAnalysis component
      targetUsers: [],
      competitors: [],
      differentiation: [],
      requiredApis: suggestedStack,
      estimatedCost: "Derived from Agent Plan",
      strengths: [],
      weaknesses: [],
      marketRisks: keyRisks,
      monetizationStrategies: [],
      mvpFeatures: suggestedStack,
      roadmap: Array.isArray(run.plan?.steps)
        ? run.plan.steps.map((s, idx) => ({
            phase: `Step ${idx + 1}`,
            title: s.title || s.toolId || "Investigation Step",
            description: s.reasoning || "",
          }))
        : [],
      analyzedAt: finalOutput.synthesizedAt || run.completedAt || run.updatedAt,
      isAgentResult: true,
    },
  };
};

/**
 * Performs a strict tenant-bounded cascade deletion of an agent run and its related records.
 *
 * Rules:
 * - Deletes the agent run matching { _id: runId, userId }.
 * - Deletes agent_steps matching { runId }.
 * - Deletes agent_evidence matching { runId, userId }.
 * - Deletes agent_conversation_messages matching this run and its linked conversation.
 * - Deletes the linked conversation from agent_conversations (preventing ghost threads in sidebar).
 * - Never deletes from the legacy `ideas` collection.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.runId - Agent run ID to delete.
 * @param {string} params.userId - Authenticated user ID.
 * @param {Object} params.db - Connected MongoDB database instance.
 * @returns {Promise<{ success: boolean, deletedCount: number }>}
 */
export const cascadeDeleteAgentRun = async ({ runId, userId, db }) => {
  if (!ObjectId.isValid(runId) || !userId || !db) {
    throw new Error("Invalid parameters for cascadeDeleteAgentRun");
  }

  const runOid = new ObjectId(String(runId));
  const userIdStr = String(userId);

  // 1. Fetch the run first so we can identify its conversationId (if findOne is supported)
  let run = null;
  if (typeof db.collection("agent_runs").findOne === "function") {
    run = await db.collection("agent_runs").findOne({
      _id: runOid,
      userId: userIdStr,
    });
    if (!run) {
      return { success: false, deletedCount: 0 };
    }
  }

  // 2. Verify and delete the run itself
  const runResult = await db.collection("agent_runs").deleteOne({
    _id: runOid,
    userId: userIdStr,
  });

  if (runResult.deletedCount === 0) {
    return { success: false, deletedCount: 0 };
  }

  let linkedConvId = run?.conversationId && ObjectId.isValid(run.conversationId)
    ? new ObjectId(String(run.conversationId))
    : null;

  // Fallback: If run did not store conversationId, check agent_conversations by activeRunId
  if (!linkedConvId && typeof db.collection("agent_conversations").findOne === "function") {
    const conv = await db.collection("agent_conversations").findOne({
      activeRunId: runOid,
      userId: userIdStr,
    });
    if (conv?._id) {
      linkedConvId = new ObjectId(String(conv._id));
    }
  }

  const conversationFilter = linkedConvId
    ? {
        $or: [{ _id: linkedConvId }, { activeRunId: runOid }],
        userId: userIdStr,
      }
    : {
        activeRunId: runOid,
        userId: userIdStr,
      };

  const messageFilter = linkedConvId
    ? {
        $or: [{ runId: runOid }, { conversationId: linkedConvId }],
        userId: userIdStr,
      }
    : {
        runId: runOid,
        userId: userIdStr,
      };

  // 3. Cascade delete dependent collections in parallel with strict tenant boundaries
  await Promise.all([
    // Delete execution steps belonging to this run
    db.collection("agent_steps").deleteMany({ runId: runOid }),
    // Delete evidence gathered for this run
    db.collection("agent_evidence").deleteMany({ runId: runOid, userId: userIdStr }),
    // Delete all messages belonging to this run and/or its conversation
    db.collection("agent_conversation_messages").deleteMany(messageFilter),
    // Delete the linked conversation from agent_conversations
    db.collection("agent_conversations").deleteMany(conversationFilter),
  ]);

  return { success: true, deletedCount: 1 };
};


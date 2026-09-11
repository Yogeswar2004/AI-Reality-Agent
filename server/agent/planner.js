import { ObjectId } from "mongodb";
import { getAgentRunById } from "./agentRun.js";
import { getAgentStepsByRunId } from "./agentStep.js";
import { AGENT_STATES } from "./agentState.js";
import registry from "./toolRegistry.js";
import { TOOL_IDS } from "./toolConstants.js";
import { techIdeaAnalysisDefinition } from "./tools/techIdeaAnalysisAdapter.js";

class PlannerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "PlannerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const LOCAL_KEYWORDS = [
  "bakery",
  "cafe",
  "coffee shop",
  "coffee",
  "restaurant",
  "gym",
  "fitness",
  "salon",
  "spa",
  "barber",
  "barbershop",
  "boutique",
  "bookstore",
  "grocery store",
  "supermarket",
  "clinic",
  "dentist",
  "dental",
  "doctor",
  "pharmacy",
  "pizzeria",
  "pizza",
  "brewery",
  "bar",
  "pub",
  "florist",
  "dry cleaner",
  "laundry",
  "car wash",
  "auto repair",
  "mechanic",
  "repair shop",
  "plumber",
  "plumbing",
  "electrician",
  "storefront",
  "brick and mortar",
  "brick-and-mortar",
];

const TECH_KEYWORDS = [
  "platform",
  "software",
  "saas",
  "app",
  "application",
  "api",
  "automated",
  "automation",
  "algorithm",
  "ai",
  "ml",
  "machine learning",
  "cloud",
  "database",
  "portal",
  "extension",
  "plugin",
  "sdk",
  "dashboard",
  "micro-fulfillment",
  "network",
];

const DEFAULT_COORDINATES = Object.freeze({
  latitude: 39.7392,
  longitude: -104.9903,
});

const KNOWN_COORDINATES = Object.freeze({
  denver: { latitude: 39.7392, longitude: -104.9903 },
  seattle: { latitude: 47.6062, longitude: -122.3321 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  "new york": { latitude: 40.7128, longitude: -74.006 },
  nyc: { latitude: 40.7128, longitude: -74.006 },
  "san francisco": { latitude: 37.7749, longitude: -122.4194 },
  sf: { latitude: 37.7749, longitude: -122.4194 },
  chicago: { latitude: 41.8781, longitude: -87.6298 },
  boston: { latitude: 42.3601, longitude: -71.0589 },
  "los angeles": { latitude: 34.0522, longitude: -118.2437 },
  london: { latitude: 51.5074, longitude: -0.1278 },
});

const resolveCoordinates = (location) => {
  if (!location) return { ...DEFAULT_COORDINATES };

  if (typeof location === "object") {
    const lat = Number(location.latitude);
    const lng = Number(location.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  if (typeof location === "string") {
    const trimmed = location.trim();
    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    const lower = trimmed.toLowerCase();
    for (const [city, coords] of Object.entries(KNOWN_COORDINATES)) {
      if (lower.includes(city)) {
        return { ...coords };
      }
    }

    return { ...DEFAULT_COORDINATES };
  }

  return { ...DEFAULT_COORDINATES };
};

const isLocalBusinessGoal = ({ goal, location }) => {
  if (!location) {
    return false;
  }

  const cleanGoal = goal.toLowerCase();
  const hasLocalKeyword = LOCAL_KEYWORDS.some((kw) => cleanGoal.includes(kw));
  const hasTechKeyword = TECH_KEYWORDS.some((kw) => cleanGoal.includes(kw));

  const hasExplicitCoordinates =
    (typeof location === "object" && location !== null && Number.isFinite(location.latitude)) ||
    (typeof location === "string" && /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(location.trim()));

  if (hasExplicitCoordinates) {
    return !hasTechKeyword || hasLocalKeyword;
  }

  return hasLocalKeyword && !hasTechKeyword;
};

const extractBusinessType = (goal) => {
  const cleanGoal = goal.toLowerCase();
  const sortedKeywords = [...LOCAL_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const kw of sortedKeywords) {
    if (cleanGoal.includes(kw)) {
      if (kw === "brick and mortar" || kw === "brick-and-mortar" || kw === "storefront") {
        return "local store";
      }
      return kw;
    }
  }
  return "local business";
};

/**
 * Generate a deterministic plan object for a given goal and location.
 * Purely advisory and side-effect-free (does NOT mutate run state or persist steps).
 *
 * @param {Object} params
 * @param {string} params.goal - Goal description.
 * @param {string|null} [params.location=null] - Optional location string.
 * @returns {Object} Structured plan object.
 */
const generatePlan = ({ goal, location = null }) => {
  if (typeof goal !== "string" || !goal.trim()) {
    throw new PlannerError("Goal is required to generate a plan", "INVALID_GOAL", 400);
  }

  const cleanGoal = goal.trim();
  const cleanLocation = typeof location === "string" ? location.trim() || null : null;

  const availableTools = registry.listTools();
  const availableToolIds = new Set(availableTools.map((t) => t.id));

  const isLocal = isLocalBusinessGoal({ goal: cleanGoal, location: cleanLocation || location });

  const steps = [];

  if (isLocal && availableToolIds.has(TOOL_IDS.NEARBY_BUSINESS_SEARCH)) {
    const coords = resolveCoordinates(cleanLocation || location);
    const businessType = extractBusinessType(cleanGoal);

    // Step 1: Discover nearby competitors and density
    steps.push({
      stepIndex: 1,
      toolId: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
      toolName: "Nearby Business Search",
      description: `Discover competitors and analyze local density for ${businessType} in ${cleanLocation || "target area"}`,
      params: {
        businessType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius: 3000,
        limit: 5,
      },
      status: "pending",
    });

    // Step 2: Fetch reviews for identified primary competitor (evidence-derived placeId)
    if (availableToolIds.has(TOOL_IDS.BUSINESS_REVIEWS_SEARCH)) {
      steps.push({
        stepIndex: 2,
        toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
        toolName: "Business Reviews Search",
        description: "Fetch customer reviews for identified primary local competitor",
        params: {
          businessId: null,
          limit: 5,
        },
        dependsOnStep: 1,
        status: "pending",
      });
    }

    // Step 3: Analyze sentiment, customer complaints, and market gaps from reviews
    if (availableToolIds.has(TOOL_IDS.REVIEW_SENTIMENT_ANALYZER)) {
      steps.push({
        stepIndex: 3,
        toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
        toolName: "Review Sentiment Analyzer",
        description: "Analyze customer sentiment, recurring complaints, and competitor gaps from reviews",
        params: {
          businessName: null,
          businessType,
          reviews: null,
        },
        dependsOnStep: 2,
        status: "pending",
      });
    }

    const planSummary =
      cleanGoal.length > 80
        ? `Analyze local market viability and competitor sentiment for: "${cleanGoal.slice(0, 80)}..."`
        : `Analyze local market viability and competitor sentiment for: "${cleanGoal}"`;

    return {
      summary: planSummary,
      category: "local",
      targetSteps: steps.length,
      steps,
      requiresApproval: true,
      createdAt: new Date(),
    };
  }

  // Default: Tech / Digital idea plan
  if (availableToolIds.has(TOOL_IDS.TECH_IDEA_ANALYSIS) || availableToolIds.has(techIdeaAnalysisDefinition.id)) {
    const techToolId = availableToolIds.has(TOOL_IDS.TECH_IDEA_ANALYSIS)
      ? TOOL_IDS.TECH_IDEA_ANALYSIS
      : techIdeaAnalysisDefinition.id;

    steps.push({
      stepIndex: 1,
      toolId: techToolId,
      toolName: techIdeaAnalysisDefinition.name,
      description:
        "Analyze technical feasibility, suggested tech stack, and market fit",
      params: {
        goal: cleanGoal,
        location: cleanLocation,
      },
      status: "pending",
    });
  }

  const planSummary =
    cleanGoal.length > 80
      ? `Investigate technology idea viability for: "${cleanGoal.slice(0, 80)}..."`
      : `Investigate technology idea viability for: "${cleanGoal}"`;

  return {
    summary: planSummary,
    category: "tech",
    targetSteps: steps.length,
    steps,
    requiresApproval: true,
    createdAt: new Date(),
  };
};

/**
 * Evaluate the next step decision for an agent run (advisory only).
 * This function NEVER executes tools, calls toolExecutor, or mutates run state.
 *
 * @param {Object} params
 * @param {string} params.runId - Agent run ID.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<Object>} Structured decision recommendation.
 */
const evaluateNextStep = async ({ runId, userId }) => {
  if (!ObjectId.isValid(runId)) {
    throw new PlannerError("Invalid run ID", "INVALID_RUN_ID", 400);
  }

  const run = await getAgentRunById({ id: runId, userId });
  if (!run) {
    throw new PlannerError(
      "Agent run not found or access denied",
      "RUN_NOT_FOUND",
      404
    );
  }

  if (!run.plan) {
    throw new PlannerError(
      "No plan generated for this run yet",
      "PLAN_NOT_FOUND",
      400
    );
  }

  // 1. Check approval gate
  if (run.state === AGENT_STATES.AWAITING_APPROVAL) {
    return {
      action: "AWAIT_APPROVAL",
      message: "Plan requires user approval before execution can proceed",
      plan: run.plan,
    };
  }

  // 2. Check terminal states
  const terminalStates = new Set([
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ]);
  if (terminalStates.has(run.state)) {
    return {
      action: "TERMINAL",
      state: run.state,
      message: `Run is in terminal state '${run.state}'`,
    };
  }

  // 3. In EXECUTING state: evaluate progress against planned steps
  if (run.state === AGENT_STATES.EXECUTING) {
    const maxSteps = run.budget?.maxSteps || 8;
    if ((run.stepCount || 0) >= maxSteps) {
      return {
        action: "QUOTA_EXHAUSTED",
        message: "Budget limit reached for this run",
      };
    }

    const steps = await getAgentStepsByRunId({ runId, userId });
    const toolSteps = steps.filter((s) => s.type === "tool_execution");
    const failedSteps = toolSteps.filter((s) => s.status === "failed");
    const completedSteps = toolSteps.filter((s) => s.status === "completed");

    if (failedSteps.length > 0) {
      return {
        action: "FAIL",
        reason: "Previous tool step failed",
        failedStep: failedSteps[failedSteps.length - 1],
      };
    }

    const executedToolIds = new Set(
      completedSteps.map((s) => s.input?.toolId)
    );
    const nextPlannedStep = run.plan.steps.find(
      (s) => !executedToolIds.has(s.toolId)
    );

    if (!nextPlannedStep) {
      return {
        action: "TRANSITION_SYNTHESIZING",
        message: "All planned steps have completed successfully",
      };
    }

    // Apply external-call quota guard only when about to recommend an external tool execution
    const nextToolDef = registry.getTool(nextPlannedStep.toolId);
    const isExternalTool = Boolean(nextToolDef?.external);
    if (isExternalTool) {
      const maxExternalCalls = run.budget?.maxExternalCalls || 5;
      if ((run.externalCallCount || 0) >= maxExternalCalls) {
        return {
          action: "QUOTA_EXHAUSTED",
          message: "External call budget limit reached for this run",
        };
      }
    }

    // Evidence-derived parameter extraction for next step
    if (nextPlannedStep.toolId === TOOL_IDS.TECH_IDEA_ANALYSIS) {
      return {
        action: "EXECUTE_TOOL",
        toolId: nextPlannedStep.toolId,
        input: nextPlannedStep.params,
        reasoning: nextPlannedStep.description,
        stepIndex: nextPlannedStep.stepIndex,
      };
    }

    if (nextPlannedStep.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH) {
      return {
        action: "EXECUTE_TOOL",
        toolId: nextPlannedStep.toolId,
        input: nextPlannedStep.params,
        reasoning: nextPlannedStep.description,
        stepIndex: nextPlannedStep.stepIndex,
      };
    }

    if (nextPlannedStep.toolId === TOOL_IDS.BUSINESS_REVIEWS_SEARCH) {
      const searchStep = completedSteps.find(
        (s) => s.input?.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH
      );

      if (!searchStep || !searchStep.output) {
        return {
          action: "FAIL",
          reason:
            "Cannot execute business_reviews_search: Prerequisite nearby_business_search output is missing",
        };
      }

      const businesses = searchStep.output.businesses;
      if (!Array.isArray(businesses) || businesses.length === 0) {
        return {
          action: "TRANSITION_SYNTHESIZING",
          message:
            "Nearby business search returned zero competitors; skipping review search to avoid fabricating entities and transitioning to synthesis with partial evidence.",
        };
      }

      const primaryCompetitor = businesses[0];
      const businessId =
        typeof primaryCompetitor.placeId === "string"
          ? primaryCompetitor.placeId.trim()
          : "";

      if (!businessId) {
        return {
          action: "FAIL",
          reason: "Discovered competitor has missing or invalid placeId",
        };
      }

      const businessName =
        typeof primaryCompetitor.name === "string" && primaryCompetitor.name.trim()
          ? primaryCompetitor.name.trim()
          : undefined;

      const limit =
        typeof nextPlannedStep.params?.limit === "number"
          ? nextPlannedStep.params.limit
          : 5;

      const input = {
        businessId,
        limit,
      };
      if (businessName) {
        input.businessName = businessName;
      }

      return {
        action: "EXECUTE_TOOL",
        toolId: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
        input,
        reasoning: businessName
          ? `Fetch customer reviews for competitor '${businessName}' (${businessId}) discovered from nearby search`
          : `Fetch customer reviews for competitor (${businessId}) discovered from nearby search`,
        stepIndex: nextPlannedStep.stepIndex,
      };
    }

    if (nextPlannedStep.toolId === TOOL_IDS.REVIEW_SENTIMENT_ANALYZER) {
      const reviewsStep = completedSteps.find(
        (s) => s.input?.toolId === TOOL_IDS.BUSINESS_REVIEWS_SEARCH
      );

      if (!reviewsStep || !reviewsStep.output) {
        return {
          action: "FAIL",
          reason:
            "Cannot execute review_sentiment_analyzer: Prerequisite business_reviews_search output is missing",
        };
      }

      let businessName = null;
      if (
        typeof reviewsStep.output.businessName === "string" &&
        reviewsStep.output.businessName.trim()
      ) {
        businessName = reviewsStep.output.businessName.trim();
      } else if (
        typeof reviewsStep.input?.businessName === "string" &&
        reviewsStep.input.businessName.trim()
      ) {
        businessName = reviewsStep.input.businessName.trim();
      }

      if (!businessName) {
        return {
          action: "FAIL",
          reason:
            "Cannot execute review_sentiment_analyzer: Required business name evidence is missing from previous steps",
        };
      }

      const reviews = Array.isArray(reviewsStep.output.reviews)
        ? reviewsStep.output.reviews
        : [];

      const searchStep = completedSteps.find(
        (s) => s.input?.toolId === TOOL_IDS.NEARBY_BUSINESS_SEARCH
      );

      const businessType =
        typeof searchStep?.input?.businessType === "string" &&
        searchStep.input.businessType.trim()
          ? searchStep.input.businessType.trim()
          : (typeof nextPlannedStep.params?.businessType === "string"
              ? nextPlannedStep.params.businessType.trim()
              : "business");

      return {
        action: "EXECUTE_TOOL",
        toolId: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
        input: {
          businessName,
          businessType,
          reviews,
        },
        reasoning: `Analyze sentiment, complaints, and unmet needs from ${reviews.length} reviews for '${businessName}'`,
        stepIndex: nextPlannedStep.stepIndex,
      };
    }

    return {
      action: "EXECUTE_TOOL",
      toolId: nextPlannedStep.toolId,
      input: nextPlannedStep.params || {},
      reasoning: nextPlannedStep.description || "Execute planned tool step",
      stepIndex: nextPlannedStep.stepIndex,
    };
  }

  // 4. In SYNTHESIZING state: advisory recommendation to synthesize
  if (run.state === AGENT_STATES.SYNTHESIZING) {
    return {
      action: "SYNTHESIZE",
      message:
        "Run is in synthesizing state, ready for final recommendation generation",
    };
  }

  return {
    action: run.state.toUpperCase(),
    state: run.state,
    message: `Run is in state '${run.state}'`,
  };
};

export { PlannerError, evaluateNextStep, generatePlan };

import { ObjectId } from "mongodb";
import { getAgentRunById } from "./agentRun.js";
import { getAgentStepsByRunId } from "./agentStep.js";
import { AGENT_STATES } from "./agentState.js";
import registry from "./toolRegistry.js";
import { techIdeaAnalysisDefinition } from "./tools/techIdeaAnalysisAdapter.js";

class PlannerError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "PlannerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

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

  // Inspect available tools in the registry
  const availableTools = registry.listTools();
  const hasTechIdeaTool = availableTools.some(
    (tool) => tool.id === techIdeaAnalysisDefinition.id
  );

  // Deterministic rule-based plan construction
  const steps = [];
  if (hasTechIdeaTool) {
    steps.push({
      stepIndex: 1,
      toolId: techIdeaAnalysisDefinition.id,
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

    if (nextPlannedStep) {
      return {
        action: "EXECUTE_TOOL",
        toolId: nextPlannedStep.toolId,
        input: nextPlannedStep.params,
        reasoning: nextPlannedStep.description,
        stepIndex: nextPlannedStep.stepIndex,
      };
    }

    return {
      action: "TRANSITION_SYNTHESIZING",
      message: "All planned steps have completed successfully",
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

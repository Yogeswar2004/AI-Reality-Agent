import { ObjectId } from "mongodb";
import { claimAgentRunStep, AgentRunStateError } from "./agentRun.js";
import { createAgentStep, updateAgentStep } from "./agentStep.js";
import registry from "./toolRegistry.js";
import techIdeaAnalysisAdapter, {
  techIdeaAnalysisDefinition,
} from "./tools/techIdeaAnalysisAdapter.js";

// Ensure default prototype tool is registered in the registry singleton
if (!registry.getTool(techIdeaAnalysisDefinition.id)) {
  registry.registerTool(techIdeaAnalysisDefinition, techIdeaAnalysisAdapter);
} else if (!registry.getAdapter(techIdeaAnalysisDefinition.id)) {
  registry.registerAdapter(techIdeaAnalysisDefinition.id, techIdeaAnalysisAdapter);
}

class ToolExecutorError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = "ToolExecutorError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Execute a single tool step manually in a controlled, non-autonomous fashion.
 *
 * @param {Object} params
 * @param {string} params.runId - Target agent run ID.
 * @param {string} params.userId - Authenticated user ID.
 * @param {string} params.toolId - Tool identifier.
 * @param {Object} [params.input={}] - Tool input parameters.
 * @returns {Promise<Object>} Execution result envelope { success, step, run }.
 */
const executeToolStep = async ({ runId, userId, toolId, input = {} }) => {
  if (!ObjectId.isValid(runId)) {
    throw new ToolExecutorError("Invalid run ID", "INVALID_RUN_ID", 400);
  }

  if (typeof toolId !== "string" || !toolId.trim()) {
    throw new ToolExecutorError("toolId is required", "INVALID_TOOL_ID", 400);
  }

  const cleanToolId = toolId.trim();
  const definition = registry.getTool(cleanToolId);
  const adapter = registry.getAdapter(cleanToolId);

  if (!definition || !adapter) {
    throw new ToolExecutorError(
      `Tool '${cleanToolId}' is not registered or has no adapter`,
      "TOOL_NOT_FOUND",
      404
    );
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ToolExecutorError(
      "Tool input must be a JSON object",
      "INVALID_INPUT",
      400
    );
  }

  // Claim step attempt on the run (checks ownership, executing state, and budget limits)
  let updatedRun;
  try {
    updatedRun = await claimAgentRunStep({
      runId,
      userId,
      isExternal: Boolean(definition.external),
    });
  } catch (err) {
    if (err instanceof AgentRunStateError) {
      const statusCode = err.code === "BUDGET_EXCEEDED" ? 429 : 400;
      throw new ToolExecutorError(err.message, err.code, statusCode);
    }
    throw err;
  }

  if (!updatedRun) {
    throw new ToolExecutorError(
      "Agent run not found or access denied",
      "RUN_NOT_FOUND",
      404
    );
  }

  const stepNumber = updatedRun.stepCount;

  // 1. Persist initial step in 'pending' status
  const initialStep = await createAgentStep({
    runId,
    stepNumber,
    type: "tool_execution",
    input: {
      toolId: cleanToolId,
      params: input,
    },
    metadata: {
      toolName: definition.name,
      riskLevel: definition.riskLevel,
      external: definition.external,
    },
  });

  // 2. Mark step as 'running'
  const runningStep = await updateAgentStep({
    stepId: initialStep._id,
    runId,
    userId,
    updates: {
      status: "running",
      startedAt: new Date(),
    },
  });

  // 3. Execute adapter
  const result = await adapter.executeTool(input);

  // 4. Finalize step with completed or failed status
  const now = new Date();
  let finalizedStep;

  if (result.error) {
    finalizedStep = await updateAgentStep({
      stepId: initialStep._id,
      runId,
      userId,
      updates: {
        status: "failed",
        error: result.error,
        completedAt: now,
      },
    });
  } else {
    finalizedStep = await updateAgentStep({
      stepId: initialStep._id,
      runId,
      userId,
      updates: {
        status: "completed",
        output: result.output,
        completedAt: now,
      },
    });
  }

  return {
    success: !result.error,
    step: finalizedStep || runningStep,
    run: {
      _id: updatedRun._id,
      state: updatedRun.state,
      stepCount: updatedRun.stepCount,
      externalCallCount: updatedRun.externalCallCount,
      budget: updatedRun.budget,
    },
  };
};

export { ToolExecutorError, executeToolStep };

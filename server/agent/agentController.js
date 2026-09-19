import { ObjectId } from "mongodb";
import {
  AgentRunStateError,
  cancelAgentRun as cancelRunHelper,
  resumeAgentRun,
  claimAgentRunSynthesis,
  createAgentRun as createRun,
  getAgentRunById,
  recordAgentRunClarificationAnswer,
  saveAgentRunFinalOutput,
  setAgentRunClarification,
  stopAgentRun,
  updateAgentRunCurrentDecision,
  updateAgentRunPlan,
  updateAgentRunState as updateRunState,
  recordAgentRunReplan,
} from "./agentRun.js";
import {
  createAgentStep,
  getAgentStepsByRunId,
  updateAgentStep,
} from "./agentStep.js";
import { AGENT_STATES, getValidNextStates } from "./agentState.js";
import { ToolExecutorError, executeToolStep } from "./toolExecutor.js";
import { TOOL_IDS } from "./toolConstants.js";
import {
  PlannerError,
  evaluateNextStep,
  generatePlan,
  generatePlanWithFallback,
} from "./planner.js";
import {
  generateLLMReplan,
} from "./llmPlanner.js";
import {
  SynthesizerError,
  synthesizeFinalRecommendation,
} from "./synthesizer.js";
import {
  VALID_EVIDENCE_TYPES,
  getAgentEvidenceByRunId,
} from "./agentEvidence.js";
import { classifyProviderError } from "./providerErrors.js";
import {
  retrieveRelevantMemories,
  distillMemoriesFromCompletedRun,
  recordClarificationMemory,
  recordStopMemory,
} from "./agentMemory.js";
import {
  createConversation,
  getConversationById,
  listConversations,
  updateConversationActiveRun,
  updateConversationTitle,
} from "./agentConversation.js";
import {
  createConversationMessage,
  getMessagesByConversationId,
  formatConversationHistoryForPrompt,
} from "./agentConversationMessage.js";

const createAgentRun = async (req, res) => {
  try {
    const goal = typeof req.body.goal === "string"
      ? req.body.goal.trim()
      : "";

    let location = null;
    if (typeof req.body.location === "string") {
      location = req.body.location.trim() || null;
    } else if (typeof req.body.location === "object" && req.body.location !== null) {
      const lat = Number(req.body.location.latitude);
      const lng = Number(req.body.location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        location = {
          latitude: lat,
          longitude: lng,
          label: typeof req.body.location.label === "string" ? req.body.location.label.trim() : null,
        };
      }
    }

    if (!goal) {
      return res.status(400).json({
        success: false,
        message: "A goal is required",
      });
    }

    const conversationId = req.body.conversationId || null;

    const run = await createRun({
      userId: req.user.userId,
      goal,
      location,
      conversationId,
    });

    if (conversationId) {
      try {
        await updateConversationActiveRun({
          conversationId,
          userId: req.user.userId,
          activeRunId: run._id,
        });
      } catch (linkErr) {
        console.warn("Failed to link run to conversation:", linkErr?.message);
      }
    }

    return res.status(201).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    console.error("Create agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create agent run",
    });
  }
};

const getAgentRun = async (req, res) => {
  try {
    const run = await getAgentRunById({
      id: req.params.id,
      userId: req.user.userId,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    console.error("Get agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent run",
    });
  }
};

const updateAgentRunState = async (req, res) => {
  try {
    const nextState = typeof req.body.state === "string"
      ? req.body.state.trim()
      : "";

    if (!nextState) {
      return res.status(400).json({
        success: false,
        message: "A target state is required",
      });
    }

    const run = await updateRunState({
      runId: req.params.id,
      userId: req.user.userId,
      nextState,
      cancellationReason: req.body.cancellationReason,
      error: req.body.error,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update agent run state error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update agent run state",
    });
  }
};

const processAdvisoryDecision = async ({ runId, userId, run, decision }) => {
  if (!decision || typeof decision !== "object") {
    return { decision, run };
  }

  // Handle ASK_USER: transition EXECUTING -> AWAITING_CLARIFICATION & persist clarification
  if (decision.action === "ASK_USER") {
    if (run.state === AGENT_STATES.EXECUTING) {
      if (!run.clarification || run.clarification.answer !== null) {
        const updatedRun = await setAgentRunClarification({
          runId,
          userId,
          clarification: {
            question:
              typeof decision.question === "string"
                ? decision.question.trim()
                : "",
            options: Array.isArray(decision.options) ? decision.options : [],
            answer: null,
            askedAt: new Date(),
            answeredAt: null,
          },
          nextState: AGENT_STATES.AWAITING_CLARIFICATION,
        });

        if (updatedRun?.conversationId) {
          try {
            await createConversationMessage({
              conversationId: updatedRun.conversationId,
              userId,
              runId,
              sender: "agent",
              messageType: "clarification_question",
              content: decision.question.trim(),
              metadata: {
                options: Array.isArray(decision.options) ? decision.options : [],
              },
            });
          } catch (msgErr) {
            console.warn("Failed to create clarification_question message:", msgErr?.message);
          }
        }

        return { decision, run: updatedRun };
      }
    }
  }

  // Handle REPLAN: transition EXECUTING -> PLANNING -> replan -> AWAITING_APPROVAL
  if (decision.action === "REPLAN") {
    if (run.state === AGENT_STATES.EXECUTING) {
      const maxReplans = run.budget?.maxReplans ?? 1;
      if ((run.replanCount || 0) < maxReplans) {
        // 1. Transition EXECUTING -> PLANNING
        const planningRun = await updateRunState({
          runId,
          userId,
          nextState: AGENT_STATES.PLANNING,
        });

        // 2. Fetch accumulated steps and evidence
        const steps = await getAgentStepsByRunId({ runId, userId });
        const evidence = await getAgentEvidenceByRunId({ runId, userId });

        // 3. Fetch conversation history if linked
        let conversationMessages = [];
        if (planningRun.conversationId) {
          try {
            conversationMessages = await getMessagesByConversationId({
              conversationId: planningRun.conversationId,
              userId,
              limit: 10,
            });
          } catch (convErr) {
            console.warn("Failed to get messages for replan:", convErr?.message);
          }
        }

        // 4. Generate candidate replacement plan
        const newPlan = await generateLLMReplan({
          run: planningRun,
          steps,
          evidence,
          replanDecision: decision,
          conversationMessages,
        });

        // 5. Record replan: increments replanCount, updates plan, sets state to AWAITING_APPROVAL
        const updatedRun = await recordAgentRunReplan({
          runId,
          userId,
          newPlan,
          replanReason: decision.reason,
        });

        // 6. Emit replan_notice to linked conversation if present
        if (updatedRun?.conversationId) {
          try {
            await createConversationMessage({
              conversationId: updatedRun.conversationId,
              userId,
              runId,
              sender: "agent",
              messageType: "replan_notice",
              content: `Investigation pivoted: ${decision.reason}. Replacement plan prepared with ${newPlan.steps?.length || 0} steps; awaiting your approval.`,
              metadata: {
                replanReason: decision.reason,
                invalidatedAssumptions: decision.invalidatedAssumptions || [],
                suggestedFocus: decision.suggestedFocus || [],
                newPlanSummary: newPlan.summary,
              },
            });
          } catch (convMsgErr) {
            console.warn("Failed to create replan_notice message:", convMsgErr?.message);
          }
        }

        return { decision, run: updatedRun };
      }
    }
  }

  // Handle STOP: transition EXECUTING -> CANCELLED & persist stop metadata
  if (decision.action === "STOP") {
    if (run.state === AGENT_STATES.EXECUTING) {
      const stopMetadata = {
        type: "agent_stop",
        reason: decision.reason,
        summary: decision.summary || decision.reason,
      };
      const updatedRun = await stopAgentRun({
        runId,
        userId,
        stopMetadata,
      });

      // Distill controlled stop memory
      try {
        await recordStopMemory({
          run: updatedRun,
          decision,
        });
      } catch (memErr) {
        console.warn("Failed to record stop memory:", memErr?.message);
      }

      return { decision, run: updatedRun };
    }
  }

  // Handle QUOTA_EXHAUSTED: transition EXECUTING -> QUOTA_LIMITED & record error
  if (decision.action === "QUOTA_EXHAUSTED") {
    if (run.state === AGENT_STATES.EXECUTING) {
      const updatedRun = await updateRunState({
        runId,
        userId,
        nextState: AGENT_STATES.QUOTA_LIMITED,
        error: decision.message || "Quota limit reached for this run",
      });
      await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
      return { decision, run: updatedRun };
    }
  }

  return { decision, run };
};

const executeTool = async (req, res) => {
  const runId = req.params.id;
  const userId = req.user.userId;
  try {
    const {
      toolId,
      input = {},
      attempt = 1,
      retryOfStepId = null,
      logicalStepIndex = null,
    } = req.body;

    if (!toolId || typeof toolId !== "string") {
      return res.status(400).json({
        success: false,
        message: "toolId is required",
      });
    }

    const cleanToolId = toolId.trim();
    const toolInput = { ...(input || {}) };
    if (cleanToolId === TOOL_IDS.TECH_IDEA_ANALYSIS) {
      if (typeof toolInput.goal !== "string" || !toolInput.goal.trim()) {
        const run = await getAgentRunById({ id: runId, userId });
        if (run?.goal) {
          toolInput.goal = run.goal.trim();
        }
        if (run?.location && (toolInput.location === undefined || toolInput.location === null)) {
          toolInput.location =
            typeof run.location === "object"
              ? run.location.label || null
              : String(run.location);
        }
      }
    }

    const result = await executeToolStep({
      runId,
      userId,
      toolId: cleanToolId,
      input: toolInput,
      attempt,
      retryOfStepId,
      logicalStepIndex,
    });

    // Check if tool execution failed due to provider quota or model failure
    if (result.step?.status === "failed" && result.step.error) {
      const toolClassification = classifyProviderError(result.step.error);

      if (toolClassification.isQuota) {
        console.warn(
          `[Tool Execution] External provider quota exhausted: ${toolClassification.sanitizedMessage}. Transitioning run to QUOTA_LIMITED.`
        );
        let quotaRun = null;
        try {
          quotaRun = await updateRunState({
            runId,
            userId,
            nextState: AGENT_STATES.QUOTA_LIMITED,
            error: toolClassification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          console.warn("Failed to transition run to QUOTA_LIMITED:", stateErr?.message);
        }

        return res.status(200).json({
          ...result,
          run: quotaRun || result.run,
          nextDecision: null,
        });
      }

      if (toolClassification.isModelUnavailable) {
        console.warn(
          `[Tool Execution] Model unavailable in tool: ${toolClassification.sanitizedMessage}. Transitioning run to FAILED.`
        );
        let failedRun = null;
        try {
          failedRun = await updateRunState({
            runId,
            userId,
            nextState: AGENT_STATES.FAILED,
            error: toolClassification.sanitizedMessage,
          });
          await updateAgentRunCurrentDecision({
            runId,
            userId,
            currentDecision: null,
          });
        } catch (stateErr) {
          console.warn("Failed to transition run to FAILED:", stateErr?.message);
        }

        return res.status(200).json({
          ...result,
          run: failedRun || result.run,
          nextDecision: null,
        });
      }
    }

    let nextDecision = null;
    let updatedRunFromDecision = null;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
      if (nextDecision) {
        const currentRun = await getAgentRunById({ id: runId, userId });
        if (currentRun) {
          const processed = await processAdvisoryDecision({
            runId,
            userId,
            run: currentRun,
            decision: nextDecision,
          });
          nextDecision = processed.decision;
          if (processed.run) {
            updatedRunFromDecision = processed.run;
          }
        }
      }
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after tool execution:",
        evalErr?.message
      );
    }

    const isTerminal = nextDecision?.action === "TERMINAL";
    if (nextDecision && !isTerminal) {
      const persistedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: nextDecision,
      });
      if (persistedRun) {
        updatedRunFromDecision = persistedRun;
      }
    } else {
      await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
    }

    return res.status(200).json({
      ...result,
      ...(updatedRunFromDecision ? { run: updatedRunFromDecision } : {}),
      nextDecision,
    });
  } catch (error) {
    if (error instanceof ToolExecutorError) {
      if (error.code === "BUDGET_EXCEEDED") {
        try {
          await updateRunState({
            runId,
            userId,
            nextState: AGENT_STATES.QUOTA_LIMITED,
          });
        } catch (stateErr) {
          // Ignore if transition not permitted or already in terminal state
        }
      }
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Execute tool error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to execute tool",
    });
  }
};

const generateRunPlan = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const allowedPlanningStates = new Set([
      AGENT_STATES.DRAFT,
      AGENT_STATES.PLANNING,
    ]);
    if (!allowedPlanningStates.has(run.state)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot generate plan for run in state '${run.state}'`,
      });
    }

    // 1. If in DRAFT, transition to PLANNING
    if (run.state === AGENT_STATES.DRAFT) {
      await updateRunState({
        runId,
        userId,
        nextState: AGENT_STATES.PLANNING,
      });
    }

    // 2. Retrieve relevant historical memories and call advisory planner
    let memories = [];
    try {
      memories = await retrieveRelevantMemories({
        userId,
        goal: run.goal,
        location: run.location,
      });
    } catch (memErr) {
      console.warn(
        "Could not retrieve agent memories for plan generation:",
        memErr?.message
      );
    }

    const plan = await generatePlanWithFallback({
      goal: run.goal,
      location: run.location,
      budget: { ...run.budget, memories },
      runId,
      userId,
    });

    // 3. Persist plan on run document
    await updateAgentRunPlan({ runId, userId, plan });

    // 4. Record an auditable 'planning' step in agent_steps
    const existingSteps = await getAgentStepsByRunId({ runId, userId });
    const stepNumber = existingSteps.length + 1;

    const initialStep = await createAgentStep({
      runId,
      stepNumber,
      type: "planning",
      input: {
        goal: run.goal,
        location: run.location,
      },
      metadata: {
        targetSteps: plan.steps.length,
        requiresApproval: true,
      },
    });

    await updateAgentStep({
      stepId: initialStep._id,
      runId,
      userId,
      updates: {
        status: "completed",
        output: plan,
        completedAt: new Date(),
      },
    });

    // 5. Explicit approval boundary: transition to AWAITING_APPROVAL (never automatic EXECUTING)
    const updatedRun = await updateRunState({
      runId,
      userId,
      nextState: AGENT_STATES.AWAITING_APPROVAL,
    });

    if (updatedRun?.conversationId) {
      try {
        await createConversationMessage({
          conversationId: updatedRun.conversationId,
          userId,
          runId,
          sender: "agent",
          messageType: "plan_proposal",
          content: `Research plan created with ${plan.steps?.length || 0} steps. Summary: ${plan.summary}`,
          metadata: {
            planSummary: plan.summary,
            stepsCount: plan.steps?.length || 0,
            ventureType: plan.ventureType || plan.category,
          },
        });
      } catch (msgErr) {
        console.warn("Failed to create plan_proposal message:", msgErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      plan,
      run: updatedRun,
    });
  } catch (error) {
    if (error instanceof PlannerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Generate run plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate plan",
    });
  }
};

const getRunPlan = async (req, res) => {
  try {
    const run = await getAgentRunById({
      id: req.params.id,
      userId: req.user.userId,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        message: "Agent run not found",
      });
    }

    return res.status(200).json({
      success: true,
      plan: run.plan,
      runId: run._id,
      state: run.state,
    });
  } catch (error) {
    console.error("Get run plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
    });
  }
};

const getNextDecision = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    // If run is already in AWAITING_CLARIFICATION with an active pending clarification,
    // return existing pending clarification without duplicating records or resetting timestamps.
    if (run.state === AGENT_STATES.AWAITING_CLARIFICATION && run.clarification) {
      return res.status(200).json({
        success: true,
        decision: {
          action: "ASK_USER",
          question: run.clarification.question,
          options: run.clarification.options || [],
          reasoning: "Awaiting user response to clarifying question",
          source: "persisted_clarification",
        },
        run,
      });
    }

    const decision = await evaluateNextStep({
      runId,
      userId,
    });

    const processed = await processAdvisoryDecision({
      runId,
      userId,
      run,
      decision,
    });

    const isTerminal = processed.decision?.action === "TERMINAL";
    if (processed.decision && !isTerminal) {
      const persistedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: processed.decision,
      });
      if (persistedRun) {
        processed.run = persistedRun;
      }
    } else {
      const clearedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
      if (clearedRun) {
        processed.run = clearedRun;
      }
    }

    return res.status(200).json({
      success: true,
      decision: processed.decision,
      ...(processed.run ? { run: processed.run } : {}),
    });
  } catch (error) {
    if (error instanceof PlannerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Get next decision error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to evaluate next decision",
    });
  }
};

const submitClarificationAnswer = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const { answer } = req.body;
    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(400).json({
        success: false,
        code: "BLANK_ANSWER",
        message: "Answer must not be empty",
      });
    }

    const updatedRun = await recordAgentRunClarificationAnswer({
      runId,
      userId,
      answer: answer.trim(),
    });

    if (!updatedRun) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    // Distill clarification memory (user_preference)
    try {
      await recordClarificationMemory({
        run: updatedRun,
        question: updatedRun.clarification?.question,
        answer: answer.trim(),
      });
    } catch (memErr) {
      console.warn("Failed to record clarification memory:", memErr?.message);
    }

    // Emit clarification_answer message to linked conversation
    if (updatedRun?.conversationId) {
      try {
        await createConversationMessage({
          conversationId: updatedRun.conversationId,
          userId,
          runId,
          sender: "user",
          messageType: "clarification_answer",
          content: answer.trim(),
          metadata: {
            question: updatedRun.clarification?.question,
          },
        });
      } catch (convMsgErr) {
        console.warn("Failed to create clarification_answer message:", convMsgErr?.message);
      }
    }

    let nextDecision = null;
    let updatedRunFromDecision = updatedRun;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
      if (nextDecision) {
        const processed = await processAdvisoryDecision({
          runId,
          userId,
          run: updatedRun,
          decision: nextDecision,
        });
        nextDecision = processed.decision;
        if (processed.run) {
          updatedRunFromDecision = processed.run;
        }
      }
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after clarification answer:",
        evalErr?.message
      );
    }

    const isTerminal = nextDecision?.action === "TERMINAL";
    if (nextDecision && !isTerminal) {
      const persistedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: nextDecision,
      });
      if (persistedRun) {
        updatedRunFromDecision = persistedRun;
      }
    } else {
      await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
    }

    return res.status(200).json({
      success: true,
      run: updatedRunFromDecision,
      nextDecision,
      validNextStates: getValidNextStates(updatedRunFromDecision.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code || "STATE_ERROR",
        message: error.message,
      });
    }

    console.error("Submit clarification answer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record clarification answer",
    });
  }
};

const approveRunPlan = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    if (run.state !== AGENT_STATES.AWAITING_APPROVAL) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot approve plan when run is in state '${run.state}' (must be '${AGENT_STATES.AWAITING_APPROVAL}')`,
      });
    }

    const updatedRun = await updateRunState({
      runId,
      userId,
      nextState: AGENT_STATES.EXECUTING,
    });

    let nextDecision = null;
    let updatedRunFromDecision = updatedRun;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
      if (nextDecision) {
        const processed = await processAdvisoryDecision({
          runId,
          userId,
          run: updatedRun,
          decision: nextDecision,
        });
        nextDecision = processed.decision;
        if (processed.run) {
          updatedRunFromDecision = processed.run;
        }
      }
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after plan approval:",
        evalErr?.message
      );
    }

    const isTerminal = nextDecision?.action === "TERMINAL";
    if (nextDecision && !isTerminal) {
      const persistedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: nextDecision,
      });
      if (persistedRun) {
        updatedRunFromDecision = persistedRun;
      }
    } else {
      await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
    }

    return res.status(200).json({
      success: true,
      run: updatedRunFromDecision,
      nextDecision,
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Approve plan error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve plan",
    });
  }
};

const synthesizeRunOutput = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const allowedStates = new Set([
      AGENT_STATES.EXECUTING,
      AGENT_STATES.SYNTHESIZING,
    ]);
    if (!allowedStates.has(run.state)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot synthesize run in state '${run.state}' (must be '${AGENT_STATES.EXECUTING}' or '${AGENT_STATES.SYNTHESIZING}')`,
      });
    }

    // 1. Claim synthesis quota & transition state to SYNTHESIZING
    const claimedRun = await claimAgentRunSynthesis({ runId, userId });

    // 2. Fetch all steps and evidence for synthesis input and compute collision-safe stepNumber
    const existingSteps = await getAgentStepsByRunId({ runId, userId });
    const existingEvidence = await getAgentEvidenceByRunId({ runId, userId });
    const maxNonSynthStep = existingSteps
      .filter((s) => s.type !== "synthesis")
      .reduce((max, s) => Math.max(max, s.stepNumber || 0), 0);
    const maxExistingStep = existingSteps.reduce(
      (max, s) => Math.max(max, s.stepNumber || 0),
      0
    );
    const stepNumber = Math.max(
      maxNonSynthStep + (claimedRun.synthesisCallCount || 1),
      maxExistingStep + 1
    );

    // 3. Record auditable 'synthesis' step
    const synthStep = await createAgentStep({
      runId,
      stepNumber,
      type: "synthesis",
      input: {
        trigger: "explicit_synthesis_request",
      },
      metadata: {
        synthesisAttempt: claimedRun.synthesisCallCount,
      },
    });

    await updateAgentStep({
      stepId: synthStep._id,
      runId,
      userId,
      updates: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // 4. Run pure, deterministic synthesizer
    let finalOutput;
    try {
      finalOutput = synthesizeFinalRecommendation({
        run: claimedRun,
        steps: existingSteps,
        evidence: existingEvidence,
      });
    } catch (synthErr) {
      await updateAgentStep({
        stepId: synthStep._id,
        runId,
        userId,
        updates: {
          status: "failed",
          error: synthErr.message,
          completedAt: new Date(),
        },
      });

      await saveAgentRunFinalOutput({
        runId,
        userId,
        finalOutput: null,
        nextState: AGENT_STATES.FAILED,
        error: synthErr.message,
      });

      throw synthErr;
    }

    // 5. Finalize synthesis step as completed
    await updateAgentStep({
      stepId: synthStep._id,
      runId,
      userId,
      updates: {
        status: "completed",
        output: finalOutput,
        completedAt: new Date(),
      },
    });

    // 6. Transition run to COMPLETED and persist finalOutput
    const completedRun = await saveAgentRunFinalOutput({
      runId,
      userId,
      finalOutput,
      nextState: AGENT_STATES.COMPLETED,
    });

    // 7. Distill curated persistent memories from completed run
    try {
      await distillMemoriesFromCompletedRun({
        run: completedRun,
        finalOutput,
        steps: existingSteps,
        evidence: existingEvidence,
      });
    } catch (memErr) {
      console.warn(
        "Failed to distill memories from completed run:",
        memErr?.message
      );
    }

    // Emit final_verdict message to linked conversation
    if (completedRun?.conversationId) {
      try {
        await createConversationMessage({
          conversationId: completedRun.conversationId,
          userId,
          runId,
          sender: "agent",
          messageType: "final_verdict",
          content: `Final verdict generated: ${finalOutput.verdict || finalOutput.summary || "Investigation complete"}. Viability score: ${finalOutput.viabilityScore ?? "N/A"}.`,
          metadata: {
            verdict: finalOutput.verdict,
            viabilityScore: finalOutput.viabilityScore,
            summary: finalOutput.summary,
          },
        });
      } catch (convMsgErr) {
        console.warn("Failed to create final_verdict message:", convMsgErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      finalOutput,
      run: completedRun,
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      const statusCode = error.code === "BUDGET_EXCEEDED" ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    if (error instanceof SynthesizerError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Synthesize run output error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synthesize final recommendation",
    });
  }
};

const getRunFinalOutput = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      finalOutput: run.finalOutput,
      state: run.state,
      runId: run._id,
    });
  } catch (error) {
    console.error("Get run final output error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch final output",
    });
  }
};

const cancelAgentRun = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await cancelRunHelper({
      runId,
      userId,
      reason,
    });

    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      run,
      validNextStates: getValidNextStates(run.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    console.error("Cancel agent run error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel agent run",
    });
  }
};

const resumeRunHandler = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const resumableStates = new Set([
      AGENT_STATES.CANCELLED,
      AGENT_STATES.FAILED,
      AGENT_STATES.QUOTA_LIMITED,
    ]);

    if (!resumableStates.has(run.state)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot resume run in state '${run.state}' (must be cancelled, failed, or quota_limited)`,
      });
    }

    const resumedRun = await resumeAgentRun({ runId, userId });

    let nextDecision = null;
    let updatedRun = resumedRun;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
      if (nextDecision) {
        const persistedRun = await updateAgentRunCurrentDecision({
          runId,
          userId,
          currentDecision: nextDecision.action === "TERMINAL" ? null : nextDecision,
        });
        if (persistedRun) {
          updatedRun = persistedRun;
        }
      }
    } catch (evalErr) {
      console.warn("Failed to evaluate next decision on resume:", evalErr?.message);
    }

    if (updatedRun?.conversationId) {
      try {
        await createConversationMessage({
          conversationId: updatedRun.conversationId,
          userId,
          runId,
          sender: "agent",
          messageType: "status_update",
          content: "Investigation resumed from checkpoint.",
        });
      } catch (msgErr) {
        // ignore
      }
    }

    return res.status(200).json({
      success: true,
      run: updatedRun,
      nextDecision,
      validNextStates: getValidNextStates(updatedRun.state),
    });
  } catch (error) {
    if (error instanceof AgentRunStateError) {
      return res.status(400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    console.error("Resume run error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resume run",
    });
  }
};

const retryStepHandler = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const resumableStates = new Set([
      AGENT_STATES.CANCELLED,
      AGENT_STATES.FAILED,
      AGENT_STATES.QUOTA_LIMITED,
    ]);
    if (resumableStates.has(run.state)) {
      await resumeAgentRun({ runId, userId });
    } else if (run.state !== AGENT_STATES.EXECUTING) {
      return res.status(400).json({
        success: false,
        code: "INVALID_STATE",
        message: `Cannot retry step when run is in state '${run.state}'`,
      });
    }

    const steps = await getAgentStepsByRunId({ runId, userId });
    const evidenceList = await getAgentEvidenceByRunId({ runId, userId });

    const completedToolIds = new Set([
      ...steps
        .filter((s) => s.type === "tool_execution" && s.status === "completed")
        .map((s) => s.input?.toolId)
        .filter(Boolean),
      ...evidenceList.map((e) => e.toolId).filter(Boolean),
    ]);

    const failedSteps = steps.filter(
      (s) => s.type === "tool_execution" && s.status === "failed"
    );

    // Find the latest failed step that remains UNRESOLVED (not yet completed)
    const lastUnresolvedFailedStep = [...failedSteps].reverse().find(
      (fs) => fs.input?.toolId && !completedToolIds.has(fs.input.toolId)
    );

    if (!lastUnresolvedFailedStep) {
      return res.status(400).json({
        success: false,
        code: "NO_FAILED_STEP",
        message: "No unresolved failed step found to retry for this run",
      });
    }

    const lastFailedStep = lastUnresolvedFailedStep;
    const toolId = lastFailedStep.input?.toolId;
    const input = req.body?.input || lastFailedStep.input?.params || (lastFailedStep.input ? { ...lastFailedStep.input } : {});
    if (input.toolId) delete input.toolId;

    if (toolId === TOOL_IDS.TECH_IDEA_ANALYSIS) {
      if (typeof input.goal !== "string" || !input.goal.trim()) {
        if (run?.goal) {
          input.goal = run.goal.trim();
        }
      }
      if (run?.location && (input.location === undefined || input.location === null)) {
        input.location =
          typeof run.location === "object"
            ? run.location.label || null
            : String(run.location);
      }
    }

    const retryOfStepId = lastFailedStep._id.toString();
    const attempt = (lastFailedStep.attempt || 1) + 1;
    const logicalStepIndex =
      lastFailedStep.logicalStepIndex || lastFailedStep.stepNumber;

    const result = await executeToolStep({
      runId,
      userId,
      toolId,
      input,
      retryOfStepId,
      attempt,
      logicalStepIndex,
    });

    if (result.step?.status === "failed" && result.step.error) {
      const toolClassification = classifyProviderError(result.step.error);
      if (toolClassification.isQuota) {
        await updateRunState({
          runId,
          userId,
          nextState: AGENT_STATES.QUOTA_LIMITED,
          error: toolClassification.sanitizedMessage,
        });
      } else if (toolClassification.isModelUnavailable) {
        await updateRunState({
          runId,
          userId,
          nextState: AGENT_STATES.FAILED,
          error: toolClassification.sanitizedMessage,
        });
      }
    }

    let nextDecision = null;
    let updatedRunFromDecision = null;
    try {
      nextDecision = await evaluateNextStep({ runId, userId });
      if (nextDecision) {
        const currentRun = await getAgentRunById({ id: runId, userId });
        if (currentRun) {
          const processed = await processAdvisoryDecision({
            runId,
            userId,
            run: currentRun,
            decision: nextDecision,
          });
          nextDecision = processed.decision;
          if (processed.run) {
            updatedRunFromDecision = processed.run;
          }
        }
      }
    } catch (evalErr) {
      console.warn(
        "Could not evaluate next decision after retry:",
        evalErr?.message
      );
    }

    const isTerminal = nextDecision?.action === "TERMINAL";
    if (nextDecision && !isTerminal) {
      const persistedRun = await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: nextDecision,
      });
      if (persistedRun) {
        updatedRunFromDecision = persistedRun;
      }
    } else {
      await updateAgentRunCurrentDecision({
        runId,
        userId,
        currentDecision: null,
      });
    }

    return res.status(200).json({
      ...result,
      ...(updatedRunFromDecision ? { run: updatedRunFromDecision } : {}),
      nextDecision,
    });
  } catch (error) {
    if (error instanceof ToolExecutorError) {
      return res.status(error.statusCode || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    console.error("Retry step error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retry step",
    });
  }
};

const getAgentRunStatus = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const steps = await getAgentStepsByRunId({ runId, userId });

    let nextDecision = null;
    if (run.state === AGENT_STATES.AWAITING_CLARIFICATION && run.clarification) {
      nextDecision = {
        action: "ASK_USER",
        question: run.clarification.question,
        options: run.clarification.options || [],
        reasoning:
          run.currentDecision?.reasoning ||
          "Awaiting user response to clarifying question",
        source: run.currentDecision?.source || "persisted_clarification",
      };
    } else if (
      run.state === AGENT_STATES.CANCELLED &&
      run.cancellationReason?.type === "agent_stop"
    ) {
      nextDecision = {
        action: "STOP",
        reason:
          run.cancellationReason.reason ||
          "Agent concluded research goals satisfied",
        summary: run.cancellationReason.summary || null,
        source: "persisted_stop",
      };
    } else if (
      run.state === AGENT_STATES.EXECUTING ||
      run.state === AGENT_STATES.SYNTHESIZING
    ) {
      nextDecision = run.currentDecision || null;
    }

    return res.status(200).json({
      success: true,
      runId: run._id,
      _id: run._id,
      goal: run.goal,
      location: run.location,
      state: run.state,
      stepCount: run.stepCount,
      externalCallCount: run.externalCallCount,
      synthesisCallCount: run.synthesisCallCount,
      budget: run.budget,
      plan: run.plan,
      hasFinalOutput: Boolean(run.finalOutput),
      finalOutput: run.finalOutput,
      stepSummary: {
        total: steps.length,
        completed: steps.filter((s) => s.status === "completed").length,
        failed: steps.filter((s) => s.status === "failed").length,
        running: steps.filter((s) => s.status === "running").length,
      },
      nextDecision,
      currentDecision: run.currentDecision || null,
      validNextStates: getValidNextStates(run.state),
      clarification: run.clarification || null,
      completedAt: run.completedAt,
      cancellationReason: run.cancellationReason,
      error: run.error,
    });
  } catch (error) {
    console.error("Get agent run status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch agent run status",
    });
  }
};

const getRunEvidence = async (req, res) => {
  try {
    const runId = req.params.id;
    const userId = req.user.userId;

    if (!ObjectId.isValid(runId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RUN_ID",
        message: "Invalid run ID",
      });
    }

    const run = await getAgentRunById({ id: runId, userId });
    if (!run) {
      return res.status(404).json({
        success: false,
        code: "RUN_NOT_FOUND",
        message: "Agent run not found or access denied",
      });
    }

    const evidenceType = req.query?.evidenceType || null;
    if (evidenceType && !VALID_EVIDENCE_TYPES.includes(evidenceType)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EVIDENCE_TYPE",
        message: `Invalid evidence type: ${evidenceType}`,
      });
    }

    const evidence = await getAgentEvidenceByRunId({
      runId,
      userId,
      evidenceType,
    });

    return res.status(200).json({
      success: true,
      runId: run._id,
      evidence,
    });
  } catch (error) {
    console.error("Get run evidence error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch run evidence",
    });
  }
};

const createConversationHandler = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, goal, location } = req.body;

    const conversation = await createConversation({
      userId,
      title: typeof title === "string" ? title.trim() : "New Investigation",
    });

    let run = null;
    let initialMessage = null;

    if (typeof goal === "string" && goal.trim()) {
      initialMessage = await createConversationMessage({
        conversationId: conversation._id,
        userId,
        sender: "user",
        messageType: "text",
        content: goal.trim(),
      });

      let cleanLocation = null;
      if (typeof location === "string") {
        cleanLocation = location.trim() || null;
      } else if (typeof location === "object" && location !== null) {
        const lat = Number(location.latitude);
        const lng = Number(location.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          cleanLocation = {
            latitude: lat,
            longitude: lng,
            label: typeof location.label === "string" ? location.label.trim() : null,
          };
        }
      }

      run = await createRun({
        userId,
        goal: goal.trim(),
        location: cleanLocation,
        conversationId: conversation._id,
      });

      await updateConversationActiveRun({
        conversationId: conversation._id,
        userId,
        activeRunId: run._id,
      });
      conversation.activeRunId = run._id;
    }

    return res.status(201).json({
      success: true,
      conversation,
      ...(run ? { run } : {}),
      ...(initialMessage ? { message: initialMessage } : {}),
    });
  } catch (error) {
    console.error("Create conversation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create conversation",
    });
  }
};

const listConversationsHandler = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 20;

    const conversations = await listConversations({ userId, limit });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list conversations",
    });
  }
};

const getConversationHandler = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationId = req.params.id;

    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CONVERSATION_ID",
        message: "Invalid conversation ID",
      });
    }

    const conversation = await getConversationById({
      id: conversationId,
      userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    const limit = parseInt(req.query.limit, 10) || 50;
    const messages = await getMessagesByConversationId({
      conversationId,
      userId,
      limit,
    });

    let activeRun = null;
    if (conversation.activeRunId) {
      activeRun = await getAgentRunById({
        id: conversation.activeRunId,
        userId,
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
      messages,
      ...(activeRun ? { activeRun } : {}),
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversation",
    });
  }
};

const postConversationMessageHandler = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversationId = req.params.id;

    if (!ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CONVERSATION_ID",
        message: "Invalid conversation ID",
      });
    }

    const conversation = await getConversationById({
      id: conversationId,
      userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    const {
      content,
      sender = "user",
      messageType = "text",
      metadata = null,
      location = null,
    } = req.body;

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CONTENT",
        message: "Message content is required",
      });
    }

    let activeRun = null;
    if (conversation.activeRunId) {
      activeRun = await getAgentRunById({
        id: conversation.activeRunId,
        userId,
      });
    }

    // Save message
    const message = await createConversationMessage({
      conversationId,
      userId,
      runId: activeRun?._id || null,
      sender,
      messageType,
      content: content.trim(),
      metadata,
    });

    // Handle clarification answer if active run awaiting clarification
    if (
      sender === "user" &&
      activeRun &&
      activeRun.state === AGENT_STATES.AWAITING_CLARIFICATION &&
      activeRun.clarification &&
      activeRun.clarification.answer === null
    ) {
      try {
        const updatedRun = await recordAgentRunClarificationAnswer({
          runId: activeRun._id,
          userId,
          answer: content.trim(),
        });

        try {
          await recordClarificationMemory({
            run: updatedRun,
            question: updatedRun.clarification?.question,
            answer: content.trim(),
          });
        } catch (memErr) {
          console.warn("Failed to record clarification memory:", memErr?.message);
        }

        activeRun = updatedRun;
      } catch (clarifyErr) {
        console.warn("Clarification answer recording notice:", clarifyErr.message);
      }
    } else if (
      sender === "user" &&
      (!activeRun || [AGENT_STATES.COMPLETED, AGENT_STATES.CANCELLED, AGENT_STATES.FAILED].includes(activeRun.state))
    ) {
      // User started a new goal from conversational message
      try {
        const newRun = await createRun({
          userId,
          goal: content.trim(),
          location: typeof location === "string" ? location.trim() || null : null,
          conversationId,
        });

        await updateConversationActiveRun({
          conversationId,
          userId,
          activeRunId: newRun._id,
        });
        activeRun = newRun;
      } catch (runErr) {
        console.warn("Failed to auto-create run from message:", runErr?.message);
      }
    }

    return res.status(201).json({
      success: true,
      message,
      ...(activeRun ? { run: activeRun } : {}),
    });
  } catch (error) {
    console.error("Post conversation message error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send message",
    });
  }
};

export {
  approveRunPlan,
  cancelAgentRun,
  resumeRunHandler,
  retryStepHandler,
  createAgentRun,
  executeTool,
  generateRunPlan,
  getAgentRun,
  getAgentRunStatus,
  getNextDecision,
  getRunEvidence,
  getRunFinalOutput,
  getRunPlan,
  processAdvisoryDecision,
  submitClarificationAnswer,
  synthesizeRunOutput,
  updateAgentRunState,
  createConversationHandler,
  listConversationsHandler,
  getConversationHandler,
  postConversationMessageHandler,
};

import { useEffect, useState, useCallback, useRef } from "react";
import api from "../api/api";
import { useAuth } from "./useAuth";
import { AgentContext } from "./agentContextInstance";

export function AgentProvider({ children }) {
  const { isAuthenticated } = useAuth();

  // Conversation State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationId, setConversationId] = useState(() =>
    localStorage.getItem("active_agent_conversation_id")
  );
  const [messages, setMessages] = useState([]);

  // Run State
  const [run, setRun] = useState(null);
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [finalOutput, setFinalOutput] = useState(null);

  // Status & Telemetry
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");

  // Inspector & Layout State
  const [activeTab, setActiveTab] = useState("live"); // 'live' | 'evidence' | 'activity' | 'verdict'
  const [mobileTab, setMobileTab] = useState("chat"); // 'chat' | 'inspector' | 'history'
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Polling ref to prevent concurrent / duplicate poll requests
  const pollingRef = useRef(null);

  // =========================================================================
  // 1. DATA FETCHERS
  // =========================================================================

  // Fetch conversations list
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get("/agent/conversations");
      if (res.data?.conversations) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.warn("Could not load conversations:", err?.message);
    }
  }, [isAuthenticated]);

  // Fetch verified evidence for a run
  const fetchEvidence = useCallback(async (runId) => {
    if (!runId) return;
    try {
      const res = await api.get(`/agent/runs/${runId}/evidence`);
      if (res.data?.evidence) {
        setEvidence(res.data.evidence);
      }
    } catch (err) {
      console.warn("Could not fetch evidence:", err?.message);
    }
  }, []);

  // Fetch executed steps for a run
  const fetchSteps = useCallback(async (runId) => {
    if (!runId) return;
    try {
      const res = await api.get(`/agent/runs/${runId}/steps`);
      if (res.data?.steps) {
        setSteps(res.data.steps);
      }
    } catch (err) {
      console.warn("Could not fetch steps:", err?.message);
    }
  }, []);

  // Refresh status from backend (read-only)
  const refreshRunStatus = useCallback(
    async (runId) => {
      if (!runId) return;
      try {
        const res = await api.get(`/agent/runs/${runId}/status`);
        if (res.data) {
          const data = res.data;
          setRun((prev) => ({
            ...prev,
            _id: data._id || data.runId || prev?._id,
            goal: data.goal || prev?.goal,
            location: data.location !== undefined ? data.location : prev?.location,
            state: data.state,
            stepCount: data.stepCount,
            externalCallCount: data.externalCallCount,
            replanCount: data.replanCount,
            budget: data.budget,
            plan: data.plan || prev?.plan,
            completedAt: data.completedAt,
            cancellationReason: data.cancellationReason,
            error: data.error,
            clarification: data.clarification !== undefined ? data.clarification : prev?.clarification,
            currentDecision: data.currentDecision !== undefined ? data.currentDecision : prev?.currentDecision,
            finalOutput: data.finalOutput || prev?.finalOutput,
          }));

          if (data.plan) setPlan(data.plan);
          if (data.finalOutput) {
            setFinalOutput(data.finalOutput);
            setActiveTab("verdict");
          }
        }
      } catch (err) {
        console.warn("Could not refresh run status:", err?.message);
      }
    },
    []
  );

  // Select a conversation by ID
  const selectConversation = useCallback(
    async (id) => {
      if (!id) return;
      setError("");
      setLoadingAction("loading_conversation");

      try {
        const res = await api.get(`/agent/conversations/${id}`);
        const { conversation, messages: convMessages, activeRun } = res.data;

        setConversationId(id);
        setActiveConversation(conversation);
        setMessages(convMessages || []);
        localStorage.setItem("active_agent_conversation_id", id);

        if (activeRun) {
          setRun(activeRun);
          localStorage.setItem("active_agent_run_id", activeRun._id);
          if (activeRun.plan) setPlan(activeRun.plan);
          if (activeRun.finalOutput) setFinalOutput(activeRun.finalOutput);

          await Promise.all([
            fetchSteps(activeRun._id),
            fetchEvidence(activeRun._id),
            refreshRunStatus(activeRun._id),
          ]);
        } else {
          setRun(null);
          setPlan(null);
          setSteps([]);
          setEvidence([]);
          setFinalOutput(null);
          localStorage.removeItem("active_agent_run_id");
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load conversation");
      } finally {
        setLoadingAction("");
      }
    },
    [fetchSteps, fetchEvidence, refreshRunStatus]
  );

  // =========================================================================
  // 2. LIFECYCLE RESTORATION & SYNC
  // =========================================================================

  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      api
        .get("/agent/conversations")
        .then((res) => {
          if (active && res.data?.conversations) {
            setConversations(res.data.conversations);
          }
        })
        .catch((err) => console.warn("Could not load conversations:", err?.message));

      const savedConvId = localStorage.getItem("active_agent_conversation_id");
      if (savedConvId) {
        api
          .get(`/agent/conversations/${savedConvId}`)
          .then((res) => {
            if (!active) return;
            const { conversation, messages: convMessages, activeRun } = res.data;
            setConversationId(savedConvId);
            setActiveConversation(conversation);
            setMessages(convMessages || []);
            if (activeRun) {
              setRun(activeRun);
              if (activeRun.plan) setPlan(activeRun.plan);
              if (activeRun.finalOutput) setFinalOutput(activeRun.finalOutput);
              fetchSteps(activeRun._id);
              fetchEvidence(activeRun._id);
              refreshRunStatus(activeRun._id);
            }
          })
          .catch((err) => {
            console.warn("Could not restore active conversation:", err?.message);
            localStorage.removeItem("active_agent_conversation_id");
          });
      }
    }
    return () => {
      active = false;
    };
  }, [isAuthenticated, fetchSteps, fetchEvidence, refreshRunStatus]);

  // Non-aggressive polling during active non-terminal states
  useEffect(() => {
    if (!run?._id) return;

    const terminalStates = ["completed", "failed", "cancelled", "quota_limited"];
    const isTerminal = terminalStates.includes(run.state);

    if (isTerminal) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Refresh every 3.5s during executing / synthesizing
    pollingRef.current = setInterval(() => {
      refreshRunStatus(run._id);
      fetchSteps(run._id);
      fetchEvidence(run._id);
    }, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [run?._id, run?.state, refreshRunStatus, fetchSteps, fetchEvidence]);

  // =========================================================================
  // 3. ACTIONS
  // =========================================================================

  // Start a new investigation
  const startNewInvestigation = async ({ goal, location }) => {
    if (!goal || !goal.trim()) {
      setError("Please describe the venture or idea to investigate.");
      return;
    }

    setError("");
    setLoadingAction("initializing");

    try {
      // 1. Create conversation thread
      const convRes = await api.post("/agent/conversations", {
        title: goal.trim().slice(0, 55),
        goal: goal.trim(),
        location: location?.trim() || null,
      });

      const { conversation: newConv, run: newRun, message: initialMsg } = convRes.data;

      setConversationId(newConv._id);
      setActiveConversation(newConv);
      localStorage.setItem("active_agent_conversation_id", newConv._id);

      if (initialMsg) {
        setMessages([initialMsg]);
      }

      setRun(newRun);
      localStorage.setItem("active_agent_run_id", newRun._id);
      setSteps([]);
      setEvidence([]);
      setFinalOutput(null);

      await loadConversations();

      // 2. Generate plan immediately (DRAFT -> PLANNING -> AWAITING_APPROVAL)
      setLoadingAction("planning");
      const planRes = await api.post(`/agent/runs/${newRun._id}/plan`);
      const updatedPlan = planRes.data.plan;
      const updatedRun = planRes.data.run;

      setPlan(updatedPlan);
      setRun(updatedRun);

      await Promise.all([
        fetchSteps(newRun._id),
        selectConversation(newConv._id),
      ]);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to initialize investigation plan."
      );
    } finally {
      setLoadingAction("");
    }
  };

  // Send a conversation message
  const sendMessage = async (content) => {
    if (!content || !content.trim() || !conversationId) return;

    const text = content.trim();
    setError("");
    setLoadingAction("sending_message");

    try {
      const res = await api.post(`/agent/conversations/${conversationId}/messages`, {
        content: text,
      });

      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
      }

      if (res.data?.run) {
        setRun(res.data.run);
      }

      if (run?._id) {
        await Promise.all([
          refreshRunStatus(run._id),
          fetchSteps(run._id),
          fetchEvidence(run._id),
        ]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send message.");
    } finally {
      setLoadingAction("");
    }
  };

  // Human-in-the-loop plan approval
  const approvePlan = async () => {
    if (!run?._id) return;
    setError("");
    setLoadingAction("approving");

    try {
      const res = await api.post(`/agent/runs/${run._id}/approve-plan`);
      const { run: updatedRun } = res.data;

      setRun(updatedRun);
      setActiveTab("live");

      await Promise.all([
        refreshRunStatus(run._id),
        fetchSteps(run._id),
        selectConversation(conversationId),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to authorize research plan.");
    } finally {
      setLoadingAction("");
    }
  };

  // Execute single tool step
  const executeNextStep = async () => {
    const nextDecision = run?.currentDecision;
    if (!run?._id || !nextDecision || nextDecision.action !== "EXECUTE_TOOL") return;

    setError("");
    setLoadingAction("executing_step");

    try {
      const res = await api.post(`/agent/runs/${run._id}/execute-tool`, {
        toolId: nextDecision.toolId,
        input: nextDecision.input || {},
      });

      if (res.data?.run) {
        setRun((prev) => ({ ...prev, ...res.data.run }));
      }

      await Promise.all([
        refreshRunStatus(run._id),
        fetchSteps(run._id),
        fetchEvidence(run._id),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Tool execution encountered an error.");
      if (run?._id) {
        await refreshRunStatus(run._id);
        await fetchSteps(run._id);
      }
    } finally {
      setLoadingAction("");
    }
  };

  // Submit answer to clarification prompt
  const submitClarification = async (answer) => {
    if (!run?._id || !answer || !answer.trim()) return;

    setError("");
    setLoadingAction("submitting_clarification");

    try {
      const res = await api.post(`/agent/runs/${run._id}/clarification`, {
        answer: answer.trim(),
      });

      if (res.data?.run) {
        setRun((prev) => ({ ...prev, ...res.data.run }));
      }

      await Promise.all([
        refreshRunStatus(run._id),
        fetchSteps(run._id),
        selectConversation(conversationId),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit clarification.");
    } finally {
      setLoadingAction("");
    }
  };

  // Synthesize final recommendation
  const synthesizeVerdict = async () => {
    if (!run?._id) return;

    setError("");
    setLoadingAction("synthesizing");

    try {
      const res = await api.post(`/agent/runs/${run._id}/synthesize`);
      const { finalOutput: output, run: updatedRun } = res.data;

      if (output) {
        setFinalOutput(output);
        setActiveTab("verdict");
      }
      if (updatedRun) {
        setRun(updatedRun);
      }

      await Promise.all([
        fetchSteps(run._id),
        fetchEvidence(run._id),
        selectConversation(conversationId),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to synthesize final recommendation.");
    } finally {
      setLoadingAction("");
    }
  };

  // Cancel run
  const cancelActiveRun = async (reason = "Cancelled by user") => {
    if (!run?._id) return;

    setError("");
    setLoadingAction("cancelling");

    try {
      const res = await api.post(`/agent/runs/${run._id}/cancel`, { reason });
      setRun(res.data.run);

      await Promise.all([
        refreshRunStatus(run._id),
        fetchSteps(run._id),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel run.");
    } finally {
      setLoadingAction("");
    }
  };

  // Reset workspace to launch fresh investigation
  const resetWorkspace = () => {
    localStorage.removeItem("active_agent_run_id");
    localStorage.removeItem("active_agent_conversation_id");
    setRun(null);
    setPlan(null);
    setSteps([]);
    setEvidence([]);
    setFinalOutput(null);
    setConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setError("");
  };

  const value = {
    // State
    conversations,
    activeConversation,
    conversationId,
    messages,
    run,
    plan,
    steps,
    evidence,
    finalOutput,
    loadingAction,
    error,
    activeTab,
    mobileTab,
    drawerOpen,

    // Setters
    setActiveTab,
    setMobileTab,
    setDrawerOpen,
    clearError: () => setError(""),

    // Methods
    loadConversations,
    selectConversation,
    startNewInvestigation,
    sendMessage,
    approvePlan,
    executeNextStep,
    submitClarification,
    synthesizeVerdict,
    cancelActiveRun,
    refreshRunStatus,
    fetchEvidence,
    fetchSteps,
    resetWorkspace,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export default AgentProvider;

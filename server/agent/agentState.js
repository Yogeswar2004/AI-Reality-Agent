const AGENT_STATES = Object.freeze({
  DRAFT: "draft",
  AWAITING_CLARIFICATION: "awaiting_clarification",
  PLANNING: "planning",
  AWAITING_APPROVAL: "awaiting_approval",
  EXECUTING: "executing",
  SYNTHESIZING: "synthesizing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  QUOTA_LIMITED: "quota_limited",
});

const validStates = new Set(Object.values(AGENT_STATES));

const VALID_TRANSITIONS = Object.freeze({
  [AGENT_STATES.DRAFT]: [
    AGENT_STATES.AWAITING_CLARIFICATION,
    AGENT_STATES.PLANNING,
    AGENT_STATES.CANCELLED,
  ],
  [AGENT_STATES.AWAITING_CLARIFICATION]: [
    AGENT_STATES.PLANNING,
    AGENT_STATES.CANCELLED,
  ],
  [AGENT_STATES.PLANNING]: [
    AGENT_STATES.AWAITING_APPROVAL,
    AGENT_STATES.EXECUTING,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ],
  [AGENT_STATES.AWAITING_APPROVAL]: [
    AGENT_STATES.EXECUTING,
    AGENT_STATES.CANCELLED,
  ],
  [AGENT_STATES.EXECUTING]: [
    AGENT_STATES.SYNTHESIZING,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ],
  [AGENT_STATES.SYNTHESIZING]: [
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.QUOTA_LIMITED,
  ],
  [AGENT_STATES.COMPLETED]: [],
  [AGENT_STATES.FAILED]: [],
  [AGENT_STATES.CANCELLED]: [],
  [AGENT_STATES.QUOTA_LIMITED]: [],
});

const isValidAgentState = (state) => validStates.has(state);

const isValidTransition = (fromState, toState) => {
  if (!isValidAgentState(fromState) || !isValidAgentState(toState)) {
    return false;
  }

  return VALID_TRANSITIONS[fromState].includes(toState);
};

const getValidNextStates = (state) => {
  if (!isValidAgentState(state)) {
    return [];
  }

  return [...VALID_TRANSITIONS[state]];
};

export {
  AGENT_STATES,
  VALID_TRANSITIONS,
  getValidNextStates,
  isValidAgentState,
  isValidTransition,
};

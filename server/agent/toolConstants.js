/**
 * Tool registry constants for Phase 3.
 */

// Tool IDs (stable strings)
export const TOOL_IDS = Object.freeze({
  TECH_IDEA_ANALYSIS: "tech_idea_analysis",
  // Future tools can be added here
});

// Access types
export const TOOL_ACCESS = Object.freeze({
  READ_ONLY: "read-only",
  WRITE: "write",
});

// Risk levels
export const TOOL_RISK = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
});

// Default quota cost units (abstract)
export const DEFAULT_QUOTA_COST = 1;

// Mock mode flag for Phase 3 (all tools are mock in this phase)
export const MOCK_ENABLED = true;
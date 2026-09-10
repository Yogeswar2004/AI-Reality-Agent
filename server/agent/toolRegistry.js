import { TOOL_IDS, TOOL_ACCESS, TOOL_RISK, DEFAULT_QUOTA_COST, MOCK_ENABLED } from "./toolConstants.js";

/**
 * In-memory tool registry (singleton).
 */
class ToolRegistry {
  constructor() {
    this._tools = new Map();
  }

  /**
   * Register a tool definition.
   * @param {Object} definition - The tool definition.
   * @throws {Error} If definition is invalid or ID already exists.
   */
  registerTool(definition) {
    this._validateDefinition(definition);
    const { id } = definition;
    if (this._tools.has(id)) {
      throw new Error(`Tool with ID '${id}' already registered`);
    }
    this._tools.set(id, definition);
  }

  /**
   * Get a tool definition by ID.
   * @param {string} id - The tool ID.
   * @returns {Object|null} The tool definition or null if not found.
   */
  getTool(id) {
    return this._tools.get(id) || null;
  }

  /**
   * List all tool definitions.
   * @returns {Array<Object>} Array of tool definitions.
   */
  listTools() {
    return Array.from(this._tools.values());
  }

  /**
   * Validate a tool definition.
   * @private
   * @param {Object} definition - The tool definition to validate.
   * @throws {Error} If definition is invalid.
   */
  _validateDefinition(definition) {
    if (typeof definition !== "object" || definition === null) {
      throw new Error("Tool definition must be an object");
    }

    const { id, name, description, version, inputSchema, outputSchema, access, riskLevel, quotaCost, mockEnabled, external } = definition;

    // Required fields
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("Tool definition must have a non-empty string 'id'");
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("Tool definition must have a non-empty string 'name'");
    }
    if (typeof description !== "string" || description.trim() === "") {
      throw new Error("Tool definition must have a non-empty string 'description'");
    }
    if (typeof version !== "string" || version.trim() === "") {
      throw new Error("Tool definition must have a non-empty string 'version'");
    }
    if (typeof inputSchema !== "object" || inputSchema === null) {
      throw new Error("Tool definition must have an 'inputSchema' object");
    }
    if (typeof outputSchema !== "object" || outputSchema === null) {
      throw new Error("Tool definition must have an 'outputSchema' object");
    }
    if (!Object.values(TOOL_ACCESS).includes(access)) {
      throw new Error(`Tool definition must have a valid 'access' (one of ${Object.values(TOOL_ACCESS).join(", ")})`);
    }
    if (!Object.values(TOOL_RISK).includes(riskLevel)) {
      throw new Error(`Tool definition must have a valid 'riskLevel' (one of ${Object.values(TOOL_RISK).join(", ")})`);
    }
    if (typeof quotaCost !== "number" || quotaCost < 0) {
      throw new Error("Tool definition must have a non-negative number 'quotaCost'");
    }
    if (typeof mockEnabled !== "boolean") {
      throw new Error("Tool definition must have a boolean 'mockEnabled'");
    }
    if (typeof external !== "boolean") {
      throw new Error("Tool definition must have a boolean 'external'");
    }

    // Additional validation: id should match one of the constants (optional, but we can warn)
    // We'll not enforce to allow future tools, but we can check if it's in TOOL_IDS for known ones.
    // For Phase 3, we only have one tool, but we'll keep it open.
  }
}

// Create a singleton instance
const registry = new ToolRegistry();

export { registry as ToolRegistry };
// Also export the class if needed for testing, but we'll just export the instance.
export default registry;
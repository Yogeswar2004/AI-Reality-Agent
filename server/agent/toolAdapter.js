/**
 * Base tool adapter interface for Phase 3.
 */

export class BaseToolAdapter {
  /**
   * @param {Object} definition - The tool definition from the registry.
   */
  constructor(definition) {
    this.definition = definition;
  }

  /**
   * Validate the input against the tool's inputSchema.
   * Subclasses must implement this method.
   * @param {any} input - The raw input.
   * @throws {Error} If input is invalid.
   */
  validateInput(input) {
    throw new Error("validateInput must be implemented by subclass");
  }

  /**
   * Execute the tool's logic with the given input.
   * Subclasses must implement this method.
   * @param {any} input - The validated input.
   * @returns {any} The raw output.
   * @throws {Error} If execution fails.
   */
  _execute(input) {
    throw new Error("_execute must be implemented by subclass");
  }

  /**
   * Validate the output against the tool's outputSchema.
   * Subclasses must implement this method.
   * @param {any} output - The raw output.
   * @throws {Error} If output is invalid.
   */
  validateOutput(output) {
    throw new Error("validateOutput must be implemented by subclass");
  }

  /**
   * Execute the tool with input validation and output validation.
   * @param {any} rawInput - The raw input from the caller.
   * @returns {Promise<{output?: any, error?: {message:string, code:string, details?:any}}>}
   */
  async executeTool(rawInput) {
    try {
      // Step 1: Validate input
      this.validateInput(rawInput);

      // Step 2: Execute (this._execute is synchronous in Phase 3, but we wrap in Promise for consistency)
      const rawOutput = await this._execute(rawInput);

      // Step 3: Validate output
      this.validateOutput(rawOutput);

      // Step 4: Return success
      return { output: rawOutput, error: null };
    } catch (err) {
      // Step 5: Return structured error
      // Ensure we don't leak secrets in err.message or err.details
      const safeError = {
        message: err.message || "Unknown error",
        code: err.code || "EXECUTION_ERROR",
        details: err.details ? this._sanitizeDetails(err.details) : undefined,
      };
      return { output: null, error: safeError };
    }
  }

  /**
   * Sanitize details to remove any potential secrets.
   * @private
   * @param {any} details - The original details object.
   * @returns {any} Sanitized details.
   */
  _sanitizeDetails(details) {
    if (typeof details !== "object" || details === null) {
      return details;
    }
    // Create a copy and remove any keys that look like secrets
    const sanitized = Array.isArray(details) ? [...details] : { ...details };
    if (Array.isArray(sanitized)) {
      return sanitized.map(item => this._sanitizeDetails(item));
    }
    const secretKeys = /key|token|secret|password|credential|api|auth/i;
    for (const [key, value] of Object.entries(sanitized)) {
      if (secretKeys.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this._sanitizeDetails(value);
      }
    }
    return sanitized;
  }
}

export default BaseToolAdapter;
/**
 * Provider failure classification and error sanitization utility.
 * Distinguishes temporary provider issues (timeouts, 5xx) from quota exhaustion (429)
 * and unrecoverable model failures (404/not found), redacting secrets and keys.
 */

export const PROVIDER_ERROR_TYPES = Object.freeze({
  QUOTA_EXHAUSTED: "quota_exhausted",
  RATE_LIMITED: "rate_limited",
  MODEL_UNAVAILABLE: "model_unavailable",
  TIMEOUT: "timeout",
  SERVER_ERROR: "server_error",
  UNKNOWN: "unknown",
});

/**
 * Sanitize error messages to ensure API keys, authorization tokens,
 * passwords, and noisy file system paths are never leaked into logs or DB.
 *
 * @param {any} rawMessage - The raw error or string.
 * @param {number} [maxLength=250] - Maximum allowed length.
 * @returns {string} Sanitized string.
 */
export const sanitizeErrorMessage = (rawMessage, maxLength = 250) => {
  if (!rawMessage) return "Unknown provider error";

  let str = "";
  if (typeof rawMessage === "string") {
    str = rawMessage;
  } else if (rawMessage instanceof Error) {
    str = rawMessage.message || rawMessage.toString();
  } else if (typeof rawMessage === "object") {
    str = rawMessage.message || JSON.stringify(rawMessage);
  } else {
    str = String(rawMessage);
  }

  // Remove API keys, Bearer tokens, passwords, query param keys
  str = str
    .replace(/(?:key|token|secret|password|bearer|AIzaSy)[\s:=]+[^\s&,"']+/gi, "[REDACTED]")
    .replace(/x-rapidapi-key[\s:=]+[^\s&,"']+/gi, "x-rapidapi-key: [REDACTED]")
    .replace(/\?key=[^\s&,"']+/gi, "?key=[REDACTED]")
    .replace(/&key=[^\s&,"']+/gi, "&key=[REDACTED]")
    .replace(/AIzaSy[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/[A-Za-z0-9_-]{35,}/g, (match) => {
      if (/^[a-zA-Z0-9_-]{35,}$/.test(match)) {
        return "[REDACTED]";
      }
      return match;
    });

  // Remove local windows/unix paths
  str = str.replace(/[a-zA-Z]:\\[^\s\n"']+/g, "[PATH]");
  str = str.replace(/\/(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+/g, "[PATH]");

  // Collapse multiple whitespaces / newlines to single space
  str = str.replace(/\s+/g, " ").trim();

  if (str.length > maxLength) {
    return `${str.slice(0, maxLength - 3).trim()}...`;
  }

  return str;
};

/**
 * Classify a provider error (Gemini, RapidAPI, or generic HTTP/SDK error).
 *
 * @param {any} err - The error object, string, or response.
 * @returns {Object} Classification result: { type, isQuota, isModelUnavailable, isTimeout, isServerError, isTemporary, sanitizedMessage, rawMessage, status }
 */
export const classifyProviderError = (err) => {
  if (!err) {
    return {
      type: PROVIDER_ERROR_TYPES.UNKNOWN,
      isQuota: false,
      isModelUnavailable: false,
      isTimeout: false,
      isServerError: false,
      isTemporary: false,
      sanitizedMessage: "Unknown provider error",
      rawMessage: "",
      status: null,
    };
  }

  const rawMessage =
    typeof err === "string"
      ? err
      : err?.message || err?.error?.message || err?.response?.data?.message || "";

  const name = err?.name || "";
  const code = String(err?.code || err?.error?.status || err?.status || "").toUpperCase();
  const rawStatus =
    err?.status ??
    err?.statusCode ??
    err?.response?.status ??
    err?.error?.code ??
    null;

  const numericStatus = Number.isFinite(Number(rawStatus)) ? Number(rawStatus) : null;
  const lowerMsg = (rawMessage + " " + name + " " + code).toLowerCase();

  // 1. Identify per-minute rate limiting signals (RPM / TPM / short-window rate limits)
  const isPerMinuteLimit =
    lowerMsg.includes("generaterequestsperminute") ||
    lowerMsg.includes("requests per minute") ||
    lowerMsg.includes("tokens per minute") ||
    lowerMsg.includes(" per minute") ||
    lowerMsg.includes("rpm") ||
    lowerMsg.includes("tpm");

  // 2. Identify true quota exhaustion signals (daily/monthly/tier/account limits)
  const hasTrueQuotaSignal =
    !isPerMinuteLimit &&
    (code === "QUOTA_EXHAUSTED" ||
      code === "SEARCH_QUOTA_EXCEEDED" ||
      code === "REVIEW_QUOTA_EXCEEDED" ||
      lowerMsg.includes("monthly quota") ||
      lowerMsg.includes("daily quota") ||
      lowerMsg.includes("free tier") ||
      lowerMsg.includes("generaterequestsperday") ||
      lowerMsg.includes("requests per day") ||
      lowerMsg.includes("spend-based") ||
      lowerMsg.includes("billing account") ||
      lowerMsg.includes("billable quota") ||
      lowerMsg.includes("check quota") ||
      lowerMsg.includes("exceeded your current quota") ||
      lowerMsg.includes("exceeded the quota") ||
      lowerMsg.includes("exceeded your quota") ||
      lowerMsg.includes("quota exhausted") ||
      lowerMsg.includes("quota_exhausted") ||
      (lowerMsg.includes("quota exceeded") && !lowerMsg.includes("per minute")) ||
      (lowerMsg.includes("quota_exceeded") && !lowerMsg.includes("per minute")) ||
      (lowerMsg.includes("resource has been exhausted") && !lowerMsg.includes("per minute")) ||
      (code === "RESOURCE_EXHAUSTED" && !lowerMsg.includes("per minute")));

  const isQuota = hasTrueQuotaSignal;

  // 3. Identify temporary rate limiting / Too Many Requests
  const isRateLimited =
    !isQuota &&
    (numericStatus === 429 ||
      code === "RATE_LIMIT_EXCEEDED" ||
      code === "RATE_LIMITED" ||
      code === "TOO_MANY_REQUESTS" ||
      isPerMinuteLimit ||
      lowerMsg.includes("too many requests") ||
      lowerMsg.includes("rate limit") ||
      lowerMsg.includes("rate_limit") ||
      lowerMsg.includes("slow down") ||
      lowerMsg.includes("retry after") ||
      lowerMsg.includes("try again in") ||
      lowerMsg.includes("concurrency limit"));

  // 4. Model Unavailable detection (Gemini model not found, discontinued, unsupported)
  const isModelUnavailable =
    !isQuota &&
    !isRateLimited &&
    (numericStatus === 404 ||
      code === "NOT_FOUND" ||
      lowerMsg.includes("not_found") ||
      lowerMsg.includes("is not found for api version") ||
      lowerMsg.includes("model not found") ||
      lowerMsg.includes("is not supported for this method") ||
      lowerMsg.includes("is no longer available") ||
      lowerMsg.includes("model unavailable") ||
      lowerMsg.includes("unsupported model"));

  // 5. Timeout detection (Gemini 30s abort, network socket timeout)
  const isTimeout =
    !isQuota &&
    !isRateLimited &&
    !isModelUnavailable &&
    (name === "AbortError" ||
      name === "TimeoutError" ||
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED" ||
      code === "ESOCKETTIMEDOUT" ||
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "DEADLINE_EXCEEDED" ||
      numericStatus === 408 ||
      numericStatus === 504 ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("timed out") ||
      lowerMsg.includes("operation was aborted") ||
      lowerMsg.includes("operation aborted") ||
      lowerMsg.includes("deadline exceeded") ||
      lowerMsg.includes("deadline_exceeded"));

  // 6. Server Error / 5xx detection
  const isServerError =
    !isQuota &&
    !isRateLimited &&
    !isModelUnavailable &&
    !isTimeout &&
    ((numericStatus !== null && numericStatus >= 500 && numericStatus <= 599) ||
      code === "UNAVAILABLE" ||
      code === "INTERNAL" ||
      code === "BAD_GATEWAY" ||
      code === "SERVICE_UNAVAILABLE" ||
      lowerMsg.includes("internal server error") ||
      lowerMsg.includes("bad gateway") ||
      lowerMsg.includes("service unavailable") ||
      lowerMsg.includes("service is currently unavailable") ||
      lowerMsg.includes("high demand") ||
      lowerMsg.includes("overloaded"));

  let type = PROVIDER_ERROR_TYPES.UNKNOWN;
  if (isQuota) {
    type = PROVIDER_ERROR_TYPES.QUOTA_EXHAUSTED;
  } else if (isRateLimited) {
    type = PROVIDER_ERROR_TYPES.RATE_LIMITED;
  } else if (isModelUnavailable) {
    type = PROVIDER_ERROR_TYPES.MODEL_UNAVAILABLE;
  } else if (isTimeout) {
    type = PROVIDER_ERROR_TYPES.TIMEOUT;
  } else if (isServerError) {
    type = PROVIDER_ERROR_TYPES.SERVER_ERROR;
  }

  const isTemporary = isTimeout || isServerError || isRateLimited;

  return {
    type,
    isQuota,
    isRateLimited,
    isModelUnavailable,
    isTimeout,
    isServerError,
    isTemporary,
    sanitizedMessage: sanitizeErrorMessage(rawMessage || type),
    rawMessage,
    status: numericStatus,
  };
};

export default {
  PROVIDER_ERROR_TYPES,
  classifyProviderError,
  sanitizeErrorMessage,
};

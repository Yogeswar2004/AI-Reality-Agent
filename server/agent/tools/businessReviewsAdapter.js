import BaseToolAdapter from "../toolAdapter.js";
import {
  TOOL_IDS,
  TOOL_ACCESS,
  TOOL_RISK,
  DEFAULT_QUOTA_COST,
  MOCK_ENABLED,
} from "../toolConstants.js";
import { TOOL_FIXTURES } from "../toolFixtures.js";
import getBusinessReviews from "../../utils/businessReviews.js";

/**
 * Adapter for the business_reviews_search tool.
 */
class BusinessReviewsAdapter extends BaseToolAdapter {
  constructor(definition) {
    super(definition);
    if (definition.id !== TOOL_IDS.BUSINESS_REVIEWS_SEARCH) {
      throw new Error("Incorrect tool ID for BusinessReviewsAdapter");
    }
  }

  /**
   * Validate input for business_reviews_search.
   * Expects: { businessId: string, businessName?: string, limit?: number }
   * @param {any} input
   * @throws {Error}
   */
  validateInput(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new Error("Input must be an object");
    }

    const { businessId, businessName, limit } = input;

    if (typeof businessId !== "string" || !businessId.trim()) {
      throw new Error("Input must have a non-empty string 'businessId'");
    }
    if (businessId.trim().length > 120) {
      throw new Error("'businessId' must not exceed 120 characters");
    }

    if (businessName !== undefined && businessName !== null) {
      if (typeof businessName !== "string") {
        throw new Error("'businessName' must be a string");
      }
      if (businessName.trim().length > 100) {
        throw new Error("'businessName' must not exceed 100 characters");
      }
    }

    if (limit !== undefined && limit !== null) {
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20) {
        throw new Error("'limit' must be an integer between 1 and 20");
      }
    }

    const allowedKeys = ["businessId", "businessName", "limit"];
    const extraKeys = Object.keys(input).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      throw new Error(`Input contains unexpected property(ies): ${extraKeys.join(", ")}`);
    }
  }

  /**
   * Execute the tool logic.
   * @param {Object} input
   * @returns {Promise<Object>}
   */
  async _execute(input) {
    if (process.env.MOCK_MODE === "true") {
      const fixture = TOOL_FIXTURES.business_reviews_search;
      return {
        businessId: input.businessId.trim(),
        businessName: input.businessName ? input.businessName.trim() : fixture.businessName,
        totalReviews: fixture.reviews.length,
        reviews: fixture.reviews.map((r) => ({ ...r })),
      };
    }

    const limit = typeof input.limit === "number" ? input.limit : 5;
    const rawReviews = await getBusinessReviews({
      businessId: input.businessId.trim(),
      limit,
    });

    const reviews = (Array.isArray(rawReviews) ? rawReviews : []).map((r) => ({
      reviewerName: r.reviewerName || "Anonymous",
      rating: typeof r.rating === "number" ? r.rating : 0,
      text: r.text || "",
      date: r.date || null,
    }));

    return {
      businessId: input.businessId.trim(),
      businessName: input.businessName ? input.businessName.trim() : "Unknown Business",
      totalReviews: reviews.length,
      reviews,
    };
  }

  /**
   * Validate output for business_reviews_search.
   * @param {any} output
   * @throws {Error}
   */
  validateOutput(output) {
    if (typeof output !== "object" || output === null) {
      throw new Error("Output must be an object");
    }

    const { businessId, businessName, totalReviews, reviews } = output;

    if (typeof businessId !== "string" || !businessId.trim()) {
      throw new Error("Output must have a non-empty string 'businessId'");
    }
    if (businessName !== undefined && typeof businessName !== "string") {
      throw new Error("Output 'businessName' must be a string if present");
    }
    if (typeof totalReviews !== "number" || totalReviews < 0) {
      throw new Error("Output must have a non-negative number 'totalReviews'");
    }
    if (!Array.isArray(reviews)) {
      throw new Error("Output must have a 'reviews' array");
    }

    for (const r of reviews) {
      if (typeof r !== "object" || r === null) {
        throw new Error("Each review in 'reviews' must be an object");
      }
      if (typeof r.reviewerName !== "string") {
        throw new Error("Each review must have a string 'reviewerName'");
      }
      if (typeof r.rating !== "number") {
        throw new Error("Each review must have a numeric 'rating'");
      }
      if (typeof r.text !== "string") {
        throw new Error("Each review must have a string 'text'");
      }
    }
  }
}

const definition = {
  id: TOOL_IDS.BUSINESS_REVIEWS_SEARCH,
  name: "Business Reviews Search",
  description: "Fetches recent customer reviews for a business by ID using RapidAPI.",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    properties: {
      businessId: { type: "string", minLength: 1, maxLength: 120 },
      businessName: { type: "string", maxLength: 100 },
      limit: { type: "integer", minimum: 1, maximum: 20 },
    },
    required: ["businessId"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      businessId: { type: "string" },
      businessName: { type: "string" },
      totalReviews: { type: "number" },
      reviews: { type: "array" },
    },
    required: ["businessId", "totalReviews", "reviews"],
    additionalProperties: true,
  },
  access: TOOL_ACCESS.READ_ONLY,
  external: true,
  quotaCost: DEFAULT_QUOTA_COST,
  riskLevel: TOOL_RISK.LOW,
  mockEnabled: MOCK_ENABLED,
};

const adapterInstance = new BusinessReviewsAdapter(definition);

export {
  adapterInstance as BusinessReviewsAdapter,
  definition as businessReviewsDefinition,
};
export default adapterInstance;

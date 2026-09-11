import BaseToolAdapter from "../toolAdapter.js";
import {
  TOOL_IDS,
  TOOL_ACCESS,
  TOOL_RISK,
  DEFAULT_QUOTA_COST,
  MOCK_ENABLED,
} from "../toolConstants.js";
import { TOOL_FIXTURES } from "../toolFixtures.js";
import analyzeReviews from "../../utils/reviewAnalyzer.js";

/**
 * Adapter for the review_sentiment_analyzer tool.
 */
class ReviewSentimentAdapter extends BaseToolAdapter {
  constructor(definition) {
    super(definition);
    if (definition.id !== TOOL_IDS.REVIEW_SENTIMENT_ANALYZER) {
      throw new Error("Incorrect tool ID for ReviewSentimentAdapter");
    }
  }

  /**
   * Validate input for review_sentiment_analyzer.
   * Expects: { businessName: string, businessType: string, reviews: Array<Object> }
   * @param {any} input
   * @throws {Error}
   */
  validateInput(input) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new Error("Input must be an object");
    }

    const { businessName, businessType, reviews } = input;

    if (typeof businessName !== "string" || !businessName.trim()) {
      throw new Error("Input must have a non-empty string 'businessName'");
    }
    if (businessName.trim().length > 100) {
      throw new Error("'businessName' must not exceed 100 characters");
    }

    if (typeof businessType !== "string" || !businessType.trim()) {
      throw new Error("Input must have a non-empty string 'businessType'");
    }
    if (businessType.trim().length > 100) {
      throw new Error("'businessType' must not exceed 100 characters");
    }

    if (!Array.isArray(reviews)) {
      throw new Error("Input must have a 'reviews' array");
    }
    if (reviews.length > 50) {
      throw new Error("'reviews' array must not exceed 50 items");
    }

    for (const r of reviews) {
      if (typeof r !== "object" || r === null) {
        throw new Error("Each review in 'reviews' must be an object");
      }
    }

    const allowedKeys = ["businessName", "businessType", "reviews"];
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
      if (input.reviews.length === 0) {
        return {
          summary: "No customer reviews were available for analysis.",
          strengths: [],
          weaknesses: [],
          commonComplaints: [],
          customerLikes: [],
          opportunities: [],
          overallSentiment: "Insufficient data",
          confidence: "Low",
          reviewsAnalyzed: 0,
        };
      }

      const fixture = TOOL_FIXTURES.review_sentiment_analyzer;
      return {
        ...fixture,
        strengths: [...fixture.strengths],
        weaknesses: [...fixture.weaknesses],
        commonComplaints: [...fixture.commonComplaints],
        customerLikes: [...fixture.customerLikes],
        opportunities: [...fixture.opportunities],
        reviewsAnalyzed: Math.min(input.reviews.length, fixture.reviewsAnalyzed),
      };
    }

    const analysis = await analyzeReviews({
      businessName: input.businessName.trim(),
      businessType: input.businessType.trim(),
      reviews: input.reviews,
    });

    return {
      summary: typeof analysis.summary === "string" ? analysis.summary : "",
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      commonComplaints: Array.isArray(analysis.commonComplaints) ? analysis.commonComplaints : [],
      customerLikes: Array.isArray(analysis.customerLikes) ? analysis.customerLikes : [],
      opportunities: Array.isArray(analysis.opportunities) ? analysis.opportunities : [],
      overallSentiment: typeof analysis.overallSentiment === "string" ? analysis.overallSentiment : "Insufficient data",
      confidence: typeof analysis.confidence === "string" ? analysis.confidence : "Low",
      reviewsAnalyzed: typeof analysis.reviewsAnalyzed === "number" ? analysis.reviewsAnalyzed : input.reviews.length,
    };
  }

  /**
   * Validate output for review_sentiment_analyzer.
   * @param {any} output
   * @throws {Error}
   */
  validateOutput(output) {
    if (typeof output !== "object" || output === null) {
      throw new Error("Output must be an object");
    }

    const {
      summary,
      strengths,
      weaknesses,
      commonComplaints,
      customerLikes,
      opportunities,
      overallSentiment,
      confidence,
      reviewsAnalyzed,
    } = output;

    if (typeof summary !== "string") {
      throw new Error("Output must have a string 'summary'");
    }
    if (!Array.isArray(strengths)) {
      throw new Error("Output must have a 'strengths' array");
    }
    if (!Array.isArray(weaknesses)) {
      throw new Error("Output must have a 'weaknesses' array");
    }
    if (!Array.isArray(commonComplaints)) {
      throw new Error("Output must have a 'commonComplaints' array");
    }
    if (!Array.isArray(customerLikes)) {
      throw new Error("Output must have a 'customerLikes' array");
    }
    if (!Array.isArray(opportunities)) {
      throw new Error("Output must have an 'opportunities' array");
    }
    if (typeof overallSentiment !== "string") {
      throw new Error("Output must have a string 'overallSentiment'");
    }
    if (typeof confidence !== "string") {
      throw new Error("Output must have a string 'confidence'");
    }
    if (typeof reviewsAnalyzed !== "number" || reviewsAnalyzed < 0) {
      throw new Error("Output must have a non-negative number 'reviewsAnalyzed'");
    }
  }
}

const definition = {
  id: TOOL_IDS.REVIEW_SENTIMENT_ANALYZER,
  name: "Review Sentiment Analyzer",
  description: "Analyzes recurring customer sentiments, strengths, complaints, and competitor opportunities from reviews using Gemini.",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    properties: {
      businessName: { type: "string", minLength: 1, maxLength: 100 },
      businessType: { type: "string", minLength: 1, maxLength: 100 },
      reviews: { type: "array" },
    },
    required: ["businessName", "businessType", "reviews"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      strengths: { type: "array" },
      weaknesses: { type: "array" },
      commonComplaints: { type: "array" },
      customerLikes: { type: "array" },
      opportunities: { type: "array" },
      overallSentiment: { type: "string" },
      confidence: { type: "string" },
      reviewsAnalyzed: { type: "number" },
    },
    required: [
      "summary",
      "strengths",
      "weaknesses",
      "commonComplaints",
      "customerLikes",
      "opportunities",
      "overallSentiment",
      "confidence",
      "reviewsAnalyzed",
    ],
    additionalProperties: true,
  },
  access: TOOL_ACCESS.READ_ONLY,
  external: true,
  quotaCost: DEFAULT_QUOTA_COST,
  riskLevel: TOOL_RISK.LOW,
  mockEnabled: MOCK_ENABLED,
};

const adapterInstance = new ReviewSentimentAdapter(definition);

export {
  adapterInstance as ReviewSentimentAdapter,
  definition as reviewSentimentDefinition,
};
export default adapterInstance;

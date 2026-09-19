import gemini from "../config/gemini.js";
import { classifyProviderError } from "../agent/providerErrors.js";
import { resolveModel, getFallbackModel } from "../agent/modelResolver.js";

const sleep = (ms) =>
new Promise((resolve) =>
setTimeout(resolve, ms)
);

const getMockReviewAnalysis = (reviews) => ({
summary:
  "Mock test data: customers value helpful service and quality, while wait times and communication are recurring improvement areas.",
strengths: [
  "Mock test data: helpful staff",
  "Mock test data: reliable service quality",
],
weaknesses: [
  "Mock test data: inconsistent waiting times",
  "Mock test data: booking communication could improve",
],
commonComplaints: [
  "Mock test data: longer-than-expected waits",
  "Mock test data: limited booking updates",
],
customerLikes: [
  "Mock test data: friendly service",
  "Mock test data: clean environment",
],
opportunities: [
  "Mock test data: provide accurate wait-time updates",
  "Mock test data: make booking communication proactive",
],
overallSentiment: "Mostly Positive",
confidence: "Medium",
reviewsAnalyzed: reviews.length,
});

/**

* Analyze customer reviews using Gemini.
  */
  const analyzeReviews = async ({
    businessName,
    businessType,
    reviews,
    geminiClient = null,
    sleepFn = sleep,
    model = null,
  }) => {
  try {
  if (
    process.env.MOCK_MODE !== "true" &&
    !geminiClient &&
    !process.env.GEMINI_API_KEY
  ) {
  throw new Error(
  "GEMINI_API_KEY is not configured in .env"
  );
  }

  if (
  !reviews ||
  reviews.length === 0
  ) {
  return {
  summary:
  "No customer reviews were available for analysis.",

  
   strengths: [],
   weaknesses: [],
   commonComplaints: [],
   customerLikes: [],
   opportunities: [],

   overallSentiment:
     "Insufficient data",

   confidence: "Low",

   reviewsAnalyzed: 0,
  

  };
  }

  if (process.env.MOCK_MODE === "true" && !geminiClient) {
  return getMockReviewAnalysis(reviews);
  }

  console.log(
  `Analyzing ${reviews.length} reviews for ${businessName}...`
  );

  /*

  * We don't need to send hundreds of reviews
  * to Gemini.
  *
  * The most relevant 20-30 reviews are
  * enough to identify major patterns.
    */

  const reviewData = reviews
  .slice(0, 30)
  .map((review, index) => ({
  reviewNumber: index + 1,

  
   rating:
     Number(review.rating) || 0,

   reviewerName:
     review.reviewerName ||
     "Anonymous",

   date:
     review.date || null,

   text:
     review.text || "",

   ownerResponse:
     review.ownerResponse ||
     null,
  

  }));

  const prompt = `
  You are an expert local business market research analyst.

Analyze the customer reviews for the following business.

BUSINESS NAME:
${businessName}

BUSINESS TYPE:
${businessType}

CUSTOMER REVIEWS:
${JSON.stringify(
reviewData,
null,
2
)}

Analyze the reviews as a group.

Do NOT simply summarize individual reviews.

Identify recurring patterns.

Analyze:

1. What customers like.
2. What customers dislike.
3. Common complaints.
4. Service quality.
5. Staff behavior.
6. Pricing and value.
7. Waiting time and appointment issues.
8. Cleanliness and environment.
9. Product/service quality.
10. Opportunities for a new competitor.

Only make claims that are reasonably supported
by the supplied reviews.

If there is insufficient evidence for a category,
return an empty array.

Return ONLY valid JSON.

Use exactly this structure:

{
"summary": "Short overall summary",

"strengths": [
"Recurring strength"
],

"weaknesses": [
"Recurring weakness"
],

"commonComplaints": [
"Recurring customer complaint"
],

"customerLikes": [
"Things customers appreciate"
],

"opportunities": [
"Potential opportunity for a new competitor"
],

"overallSentiment": "Mostly Positive",

"confidence": "High",

"reviewsAnalyzed": 20
}

Allowed overallSentiment values:

Positive
Mostly Positive
Mixed
Mostly Negative
Negative
Insufficient data

Allowed confidence values:

High
Medium
Low
`;


let response = null;
let activeModel = resolveModel("sentiment", { model });
const attemptedModels = new Set();
const maxRetriesPerModel = 3;

while (activeModel) {
  attemptedModels.add(activeModel);
  let modelSucceeded = false;

  for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
    try {
      console.log(
        `Gemini review analysis attempt ${attempt}/${maxRetriesPerModel} (model: ${activeModel})...`
      );

      const activeClient = geminiClient || gemini;
      response = await activeClient.models.generateContent({
        model: activeModel,
        contents: prompt,
        config: {
          abortSignal: AbortSignal.timeout(30000),
          httpOptions: { timeout: 30000 },
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              commonComplaints: { type: "array", items: { type: "string" } },
              customerLikes: { type: "array", items: { type: "string" } },
              opportunities: { type: "array", items: { type: "string" } },
              overallSentiment: { type: "string" },
              confidence: { type: "string" },
              reviewsAnalyzed: { type: "integer" },
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
          },
        },
      });

      modelSucceeded = true;
      break;
    } catch (error) {
      console.error(
        `Gemini attempt ${attempt} failed with model ${activeModel}:`,
        error.message
      );

      const classified = classifyProviderError(error);

      // If true quota exhaustion, do NOT perform unnecessary retries and NEVER fail over!
      if (classified.isQuota) {
        console.warn(
          `Gemini review analysis quota exhausted (${classified.sanitizedMessage}). Aborting retries immediately.`
        );
        throw error;
      }

      // If model is unavailable (404), break retry loop to trigger model failover immediately
      if (classified.isModelUnavailable) {
        const nextModel = getFallbackModel("sentiment", activeModel, attemptedModels);
        if (nextModel) {
          console.warn(
            `[Review Analyzer] Gemini model '${activeModel}' is unavailable (${classified.statusCode || 404}). Attempting fallback to '${nextModel}' (hop 1/1)...`
          );
          activeModel = nextModel;
          break;
        } else {
          throw error;
        }
      }

      // Retry only temporary errors (timeouts, 5xx server errors, temporary rate limits)
      const retryable = classified.isTemporary;
      if (!retryable || attempt === maxRetriesPerModel) {
        throw error;
      }

      const waitTime = attempt === 1 ? 2000 : 5000;
      console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
      await sleepFn(waitTime);
    }
  }

  if (modelSucceeded) {
    break;
  }
}

if (!response) {
  throw new Error(
    "Gemini did not return a response"
  );
}

console.log(
  "Gemini review analysis received"
);

const text =
  response.text;

if (!text) {
  throw new Error(
    "Gemini returned an empty response"
  );
}

let analysis;

try {
  analysis =
    JSON.parse(text);

} catch (parseError) {
  console.error(
    "Failed to parse Gemini JSON:"
  );

  console.error(text);

  throw new Error(
    "Gemini returned invalid JSON"
  );
}

/*
 * Normalize the result.
 */

return {
  summary:
    analysis.summary || "",

  strengths:
    Array.isArray(
      analysis.strengths
    )
      ? analysis.strengths
      : [],

  weaknesses:
    Array.isArray(
      analysis.weaknesses
    )
      ? analysis.weaknesses
      : [],

  commonComplaints:
    Array.isArray(
      analysis.commonComplaints
    )
      ? analysis.commonComplaints
      : [],

  customerLikes:
    Array.isArray(
      analysis.customerLikes
    )
      ? analysis.customerLikes
      : [],

  opportunities:
    Array.isArray(
      analysis.opportunities
    )
      ? analysis.opportunities
      : [],

  overallSentiment:
    analysis.overallSentiment ||
    "Insufficient data",

  confidence:
    analysis.confidence ||
    "Low",

  reviewsAnalyzed:
    Number(
      analysis.reviewsAnalyzed
    ) || reviews.length,

  model: activeModel,
};


} catch (error) {
  console.error(
    "Review analysis error:",
    error
  );

  const classified = classifyProviderError(error);

  if (classified.isQuota) {
    const err = new Error("Gemini API quota exceeded. Please try again later or upgrade quota.");
    err.code = "RESOURCE_EXHAUSTED";
    err.status = 429;
    err.provider = "gemini";
    throw err;
  }

  if (classified.isRateLimited) {
    const err = new Error("Gemini rate limit: 1 request/second exceeded. Please wait a moment and retry.");
    err.code = "RATE_LIMIT_EXCEEDED";
    err.status = 429;
    err.provider = "gemini";
    throw err;
  }

  if (classified.isModelUnavailable) {
    const err = new Error(classified.sanitizedMessage || "Gemini model is currently unavailable or deprecated.");
    err.code = "MODEL_UNAVAILABLE";
    err.status = classified.status || 404;
    err.provider = "gemini";
    throw err;
  }

  if (classified.isTimeout) {
    const err = new Error("Gemini Gateway Timeout (504): review sentiment analysis request timed out. Please retry.");
    err.code = "TIMEOUT";
    err.status = classified.status || 504;
    err.provider = "gemini";
    throw err;
  }

  if (classified.status === 502) {
    const err = new Error("Gemini Bad Gateway (502): upstream service was unavailable. Please retry.");
    err.code = "BAD_GATEWAY";
    err.status = 502;
    err.provider = "gemini";
    throw err;
  }

  if (classified.status === 503) {
    const err = new Error("Gemini Service Unavailable (503): model is temporarily overloaded. Please retry.");
    err.code = "SERVICE_UNAVAILABLE";
    err.status = 503;
    err.provider = "gemini";
    throw err;
  }

  if (classified.status === 401 || classified.status === 403 || /api_key|invalid_api_key/i.test(classified.rawMessage)) {
    const err = new Error("Gemini Authentication Error: Invalid or expired API key.");
    err.code = "AUTH_ERROR";
    err.status = classified.status || 403;
    err.provider = "gemini";
    throw err;
  }

  if (classified.isServerError) {
    const err = new Error("Gemini Server Error (500): model service encountered an internal error. Please retry.");
    err.code = "SERVER_ERROR";
    err.status = classified.status || 500;
    err.provider = "gemini";
    throw err;
  }

  const fallbackMsg = classified.sanitizedMessage
    ? `Gemini error (${classified.status || "unknown"}): ${classified.sanitizedMessage}`
    : "Review sentiment analysis failed due to an unknown provider error.";
  const err = new Error(fallbackMsg);
  err.code = "PROVIDER_ERROR";
  err.status = classified.status || 500;
  err.provider = "gemini";
  throw err;
}
};

export default analyzeReviews;

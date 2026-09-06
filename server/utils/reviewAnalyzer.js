import gemini from "../config/gemini.js";

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
  }) => {
  try {
  if (
  process.env.MOCK_MODE !== "true" &&
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

  if (process.env.MOCK_MODE === "true") {
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

/*
 * Gemini can occasionally return 503 when the
 * model is temporarily busy.
 *
 * Retry a few times instead of immediately failing.
 */

const maxAttempts = 3;

for (
  let attempt = 1;
  attempt <= maxAttempts;
  attempt++
) {
  try {
    console.log(
      `Gemini review analysis attempt ${attempt}/${maxAttempts}...`
    );

    response =
      await gemini.models.generateContent({
        model: "gemini-3.5-flash",

        contents: prompt,

        config: {
          responseMimeType:
            "application/json",

          responseSchema: {
            type: "object",

            properties: {
              summary: {
                type: "string",
              },

              strengths: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              weaknesses: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              commonComplaints: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              customerLikes: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              opportunities: {
                type: "array",

                items: {
                  type: "string",
                },
              },

              overallSentiment: {
                type: "string",
              },

              confidence: {
                type: "string",
              },

              reviewsAnalyzed: {
                type: "integer",
              },
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

    /*
     * Gemini request succeeded.
     */

    break;

  } catch (error) {
    console.error(
      `Gemini attempt ${attempt} failed:`,
      error.message
    );

    /*
     * Retry only temporary errors.
     */

    const status =
      error.status ||
      error.response?.status;

    const retryable =
      status === 503 ||
      status === 429 ||
      status === 500;

    if (
      !retryable ||
      attempt === maxAttempts
    ) {
      throw error;
    }

    /*
     * Wait progressively longer:
     *
     * attempt 1 → 2 seconds
     * attempt 2 → 5 seconds
     */

    const waitTime =
      attempt === 1
        ? 2000
        : 5000;

    console.log(
      `Waiting ${
        waitTime / 1000
      } seconds before retry...`
    );

    await sleep(waitTime);
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
};


} catch (error) {
console.error(
"Review analysis error:",
error
);


throw new Error(
  "Failed to analyze business reviews"
);


}
};

export default analyzeReviews;

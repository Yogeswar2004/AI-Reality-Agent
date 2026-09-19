import axios from "axios";

const REVIEWS_URL =
  "https://local-business-data.p.rapidapi.com/business-reviews-v2";

const RAPIDAPI_HOST =
  "local-business-data.p.rapidapi.com";

const getMockReviews = ({ businessId, limit }) => {
  const reviews = [
    {
      reviewerName: "Mock Test Reviewer One",
      rating: 5,
      text: "Mock test data: friendly staff and fast service.",
      date: "2025-01-15",
      reviewId: `${businessId}-mock-review-1`,
    },
    {
      reviewerName: "Mock Test Reviewer Two",
      rating: 3,
      text: "Mock test data: service was useful but the wait was longer than expected.",
      date: "2025-01-20",
      reviewId: `${businessId}-mock-review-2`,
    },
    {
      reviewerName: "Mock Test Reviewer Three",
      rating: 4,
      text: "Mock test data: good quality and reasonable value.",
      date: "2025-02-01",
      reviewId: `${businessId}-mock-review-3`,
    },
    {
      reviewerName: "Mock Test Reviewer Four",
      rating: 2,
      text: "Mock test data: booking updates and communication could improve.",
      date: "2025-02-10",
      reviewId: `${businessId}-mock-review-4`,
    },
    {
      reviewerName: "Mock Test Reviewer Five",
      rating: 5,
      text: "Mock test data: clean environment and helpful team.",
      date: "2025-02-15",
      reviewId: `${businessId}-mock-review-5`,
    },
  ];

  return reviews
    .slice(0, Math.max(0, Number(limit) || 0))
    .map((review) => ({
      ...review,
      language: "en",
      source: "Mock Test Data",
      ownerResponse: null,
      raw: { ...review, source: "MOCK_TEST_DATA" },
    }));
};

/**
 * Get customer reviews for a business
 *
 * @param {Object} options
 * @param {string} options.businessId
 * @param {number} options.limit
 */
const getBusinessReviews = async ({
  businessId,
  limit = 5,
  region = null,
}) => {
  try {
    // ----------------------------------------
    // Validate RapidAPI configuration
    // ----------------------------------------

    // ----------------------------------------
    // Validate business ID
    // ----------------------------------------

    if (process.env.MOCK_MODE === "true") {
      if (!businessId?.trim()) {
        throw new Error(
          "Business ID is required"
        );
      }

      return getMockReviews({
        businessId: businessId.trim(),
        limit,
      });
    }

    if (!process.env.RAPIDAPI_KEY) {
      throw new Error(
        "RAPIDAPI_KEY is not configured in .env"
      );
    }

    if (!businessId?.trim()) {
      throw new Error(
        "Business ID is required"
      );
    }

    console.log(
      "Fetching business reviews..."
    );

    console.log({
      businessId,
      limit,
    });

    // ----------------------------------------
    // ----------------------------------------
    // RapidAPI request with automatic 429 RPS retry
    // ----------------------------------------

    const makeRequest = () =>
      axios.get(
        REVIEWS_URL,
        {
          params: {
            business_id: businessId
              .trim()
              .replace(/^['"]|['"]$/g, ""),

            limit: String(limit),

            sort_by: "most_relevant",

            ...(region && typeof region === "string" && region.trim()
              ? { region: region.trim().toLowerCase() }
              : {}),

            language: "en",
          },

          headers: {
            "x-rapidapi-key":
              process.env.RAPIDAPI_KEY,

            "x-rapidapi-host":
              RAPIDAPI_HOST,

            "Content-Type":
              "application/json",
          },

          timeout: 30000,
        }
      );

    let response;
    try {
      response = await makeRequest();
    } catch (firstErr) {
      const firstStatus =
        firstErr.response?.status ||
        firstErr.status;
      const firstMsg =
        firstErr.response?.data?.message ||
        firstErr.message ||
        "";
      const isQuota =
        /monthly\s*quota|daily\s*quota|requests\s*per\s*month|quota\s*exceeded/i.test(firstMsg) &&
        !/per\s*second/i.test(firstMsg);
      const isRps =
        !isQuota &&
        (firstStatus === 429 ||
          /rate\s*limit|requests?\s*per\s*second|too\s*many\s*requests/i.test(firstMsg));

      if (isRps) {
        console.warn(
          "[BusinessReviews] Transient 429 RPS rate limit detected. Waiting 1.3s for single automatic provider retry..."
        );
        await new Promise((resolve) => setTimeout(resolve, 1300));
        response = await makeRequest();
      } else {
        throw firstErr;
      }
    }

    console.log(
      "Business reviews response received"
    );

    const data = response.data;

    // ----------------------------------------
    // Extract reviews
    // ----------------------------------------

    let reviews = [];

    if (Array.isArray(data)) {
      // Case 1:
      // Response itself is an array

      reviews = data;

    } else if (
      Array.isArray(data?.data?.reviews)
    ) {
      // Case 2:
      // Current RapidAPI response

      reviews = data.data.reviews;

    } else if (
      Array.isArray(data?.reviews)
    ) {
      // Case 3:
      // Reviews directly under response

      reviews = data.reviews;

    } else if (
      Array.isArray(data?.data)
    ) {
      // Case 4:
      // data itself is an array

      reviews = data.data;

    } else if (
      Array.isArray(data?.results)
    ) {
      // Case 5:
      // Alternative API response

      reviews = data.results;
    }

    console.log(
      `Found ${reviews.length} reviews`
    );

    // ----------------------------------------
    // Normalize reviews
    // ----------------------------------------

    const normalizedReviews =
      reviews.map((review) => ({
        reviewerName:
          review.author_name ||
          review.reviewer_name ||
          review.author ||
          review.user_name ||
          null,

        rating:
          Number(
            review.rating ??
            review.stars ??
            0
          ),

        text:
          review.review_text ||
          review.text ||
          review.content ||
          review.comment ||
          "",

        date:
          review.review_datetime_utc ||
          review.date ||
          review.relative_time ||
          review.published_at ||
          null,

        reviewId:
          review.review_id ||
          review.id ||
          null,

        language:
          review.review_language ||
          review.language ||
          "en",

        source:
          review.review_source ||
          "Google",

        ownerResponse:
          review.owner_response_text ||
          null,

        raw: review,
      }));

    console.log(
      `Successfully normalized ${normalizedReviews.length} reviews`
    );

    return normalizedReviews;

  } catch (error) {

    console.error(
      "Business reviews error:"
    );

    // ----------------------------------------
    // Detect HTTP status and raw message
    // ----------------------------------------

    const status =
      error.response?.status ||
      error.status;

    const rawMessage =
      error.response?.data?.message ||
      error.message ||
      "";

    const lower = rawMessage.toLowerCase();

    console.error(
      "Status:",
      status
    );

    console.error(
      "Response:",
      rawMessage
    );

    // ----------------------------------------
    // 1. True Monthly Quota vs Transient RPS
    // ----------------------------------------

    const isQuota =
      /monthly\s*quota|daily\s*quota|requests\s*per\s*month|quota\s*exceeded/i.test(rawMessage) &&
      !/per\s*second/i.test(rawMessage);

    if (isQuota) {
      const err = new Error("RapidAPI monthly quota exceeded. Please try again after quota reset or upgrade your plan.");
      err.code = "REVIEW_QUOTA_EXCEEDED";
      err.status = 429;
      err.provider = "rapidapi";
      throw err;
    }

    const isRps =
      !isQuota &&
      (status === 429 ||
        /rate\s*limit|requests?\s*per\s*second|too\s*many\s*requests/i.test(rawMessage));

    if (isRps) {
      const err = new Error("RapidAPI rate limit: 1 request/second exceeded. Please wait a moment and retry.");
      err.code = "RATE_LIMIT_EXCEEDED";
      err.status = 429;
      err.provider = "rapidapi";
      throw err;
    }

    // ----------------------------------------
    // 2. 504 Gateway Timeout or Network Timeout
    // ----------------------------------------

    const isTimeout =
      status === 504 ||
      status === 408 ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      lower.includes("timeout") ||
      lower.includes("timed out");

    if (isTimeout) {
      const err = new Error("RapidAPI Gateway Timeout (504): upstream reviews service timed out. Please retry.");
      err.code = "TIMEOUT";
      err.status = status || 504;
      err.provider = "rapidapi";
      throw err;
    }

    // ----------------------------------------
    // 3. 502 Bad Gateway
    // ----------------------------------------

    if (status === 502) {
      const err = new Error("RapidAPI Bad Gateway (502): upstream reviews service was unavailable. Please retry.");
      err.code = "BAD_GATEWAY";
      err.status = 502;
      err.provider = "rapidapi";
      throw err;
    }

    // ----------------------------------------
    // 4. 500 Server Error
    // ----------------------------------------

    if (status === 500) {
      const err = new Error("RapidAPI Server Error (500): upstream reviews service encountered an error. Please retry.");
      err.code = "SERVER_ERROR";
      err.status = 500;
      err.provider = "rapidapi";
      throw err;
    }

    // ----------------------------------------
    // 5. 401 / 403 Authentication Error
    // ----------------------------------------

    if (status === 401 || status === 403) {
      const err = new Error("RapidAPI Authentication Error: Invalid or unauthorized API key.");
      err.code = "AUTH_ERROR";
      err.status = status;
      err.provider = "rapidapi";
      throw err;
    }

    // ----------------------------------------
    // 6. Generic Provider Fallback
    // ----------------------------------------

    const fallbackMessage = rawMessage
      ? `RapidAPI error (${status || "unknown"}): ${rawMessage}`
      : "Business reviews request failed due to an unknown provider error.";
    const err = new Error(fallbackMessage);
    err.code = "PROVIDER_ERROR";
    err.status = status || 500;
    err.provider = "rapidapi";
    throw err;
  }
};

export default getBusinessReviews;


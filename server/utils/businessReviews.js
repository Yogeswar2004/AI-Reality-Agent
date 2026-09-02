import axios from "axios";

const REVIEWS_URL =
  "https://local-business-data.p.rapidapi.com/business-reviews-v2";

const RAPIDAPI_HOST =
  "local-business-data.p.rapidapi.com";

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
}) => {
  try {
    // ----------------------------------------
    // Validate RapidAPI configuration
    // ----------------------------------------

    if (!process.env.RAPIDAPI_KEY) {
      throw new Error(
        "RAPIDAPI_KEY is not configured in .env"
      );
    }

    // ----------------------------------------
    // Validate business ID
    // ----------------------------------------

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
    // RapidAPI request
    // ----------------------------------------

    const response = await axios.get(
      REVIEWS_URL,
      {
        params: {
          business_id: businessId
            .trim()
            .replace(/^['"]|['"]$/g, ""),

          limit: String(limit),

          sort_by: "most_relevant",

          region: "in",

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
    // Detect HTTP status
    // ----------------------------------------

    const status =
      error.response?.status ||
      error.status;

    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch business reviews";

    console.error(
      "Status:",
      status
    );

    console.error(
      "Response:",
      message
    );

    // ----------------------------------------
    // RapidAPI monthly quota exceeded
    // ----------------------------------------

    if (status === 429) {
      throw new Error(
        `REVIEW_QUOTA_EXCEEDED: ${message}`
      );
    }

    // ----------------------------------------
    // Other errors
    // ----------------------------------------

    throw new Error(
      "Failed to fetch business reviews"
    );
  }
};

export default getBusinessReviews;


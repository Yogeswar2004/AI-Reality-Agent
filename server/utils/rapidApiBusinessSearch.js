import axios from "axios";

/**

* Search nearby businesses using RapidAPI Local Business Data
*
* Required .env:
* RAPIDAPI_KEY=your_rapidapi_key
  */

const RAPIDAPI_URL =
"https://local-business-data.p.rapidapi.com/search-nearby";

const RAPIDAPI_HOST =
"local-business-data.p.rapidapi.com";

const getMockBusinesses = ({
businessType,
latitude,
longitude,
limit,
}) => {
const offsets = [
  { latitude: 0.001, longitude: 0.001, rating: 4.4, reviewCount: 320 },
  { latitude: -0.003, longitude: 0.002, rating: 4.1, reviewCount: 180 },
  { latitude: 0.007, longitude: -0.002, rating: 4.6, reviewCount: 760 },
  { latitude: -0.012, longitude: -0.004, rating: 3.9, reviewCount: 95 },
  { latitude: 0.018, longitude: 0.009, rating: 4.2, reviewCount: 410 },
];

return offsets.slice(0, Math.max(0, Number(limit) || 0)).map((offset, index) => ({
name: `Mock Test ${businessType} Competitor ${index + 1}`,
placeId: `mock-test-place-${index + 1}`,
latitude: latitude + offset.latitude,
longitude: longitude + offset.longitude,
address: `${index + 1} Mock Test Market Street`,
rating: offset.rating,
reviewCount: offset.reviewCount,
businessStatus: "OPERATIONAL (MOCK TEST DATA)",
website: `https://mock-test-competitor-${index + 1}.example.test`,
phone: `+1-555-010${index + 1}`,
categories: [businessType, "Mock Test Data"],
openingStatus: true,
workingHours: "Mock test hours: 09:00-18:00",
reviewsPerRating: null,
photos: [],
raw: {
  source: "MOCK_TEST_DATA",
  index: index + 1,
},
}));
};

/**

* Search nearby businesses
*
* @param {Object} options
* @param {string} options.businessType
* @param {number} options.latitude
* @param {number} options.longitude
* @param {number} options.radius
* @param {number} options.limit
  */
  const rapidApiBusinessSearch = async ({
  businessType,
  latitude,
  longitude,
  radius = 3000,
  limit = 5,
  }) => {
  try {
  if (process.env.MOCK_MODE === "true") {
  if (!businessType) {
  throw new Error(
  "Business type is required"
  );
  }

  if (
  typeof latitude !== "number" ||
  typeof longitude !== "number"
  ) {
  throw new Error(
  "Valid latitude and longitude are required"
  );
  }

  return getMockBusinesses({
  businessType,
  latitude,
  longitude,
  limit,
  });
  }

  if (!process.env.RAPIDAPI_KEY) {
  throw new Error(
  "RAPIDAPI_KEY is not configured in .env"
  );
  }

  if (!businessType) {
  throw new Error(
  "Business type is required"
  );
  }

  if (
  typeof latitude !== "number" ||
  typeof longitude !== "number"
  ) {
  throw new Error(
  "Valid latitude and longitude are required"
  );
  }





    const makeRequest = () =>
      axios.get(
        RAPIDAPI_URL,
        {
          params: {
            query: businessType,
            lat: String(latitude),
            lng: String(longitude),
            limit: String(limit),
            language: "en",
            extract_emails_and_contacts: "false",
          },
          headers: {
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

    let response;
    try {
      response = await makeRequest();
    } catch (firstErr) {
      const firstStatus = firstErr.response?.status || firstErr.status;
      const firstMsg =
        firstErr.response?.data?.message || firstErr.message || "";
      const isQuota =
        /monthly\s*quota|daily\s*quota|requests\s*per\s*month|quota\s*exceeded/i.test(firstMsg) &&
        !/per\s*second/i.test(firstMsg);
      const isRps =
        !isQuota &&
        (firstStatus === 429 ||
          /rate\s*limit|requests?\s*per\s*second|too\s*many\s*requests/i.test(firstMsg));

      if (isRps) {
        console.warn(
          "[RapidApiBusinessSearch] Transient 429 RPS rate limit detected. Waiting 1.3s for single automatic provider retry..."
        );
        await new Promise((resolve) => setTimeout(resolve, 1300));
        response = await makeRequest();
      } else {
        throw firstErr;
      }
    }

    const data = response.data;

  /*

  * RapidAPI may return the businesses
  * under different response structures.
  *
  * We check the common possibilities.
    */
    let businesses = [];

  if (Array.isArray(data)) {
  businesses = data;
  } else if (
  Array.isArray(data?.data)
  ) {
  businesses = data.data;
  } else if (
  Array.isArray(data?.businesses)
  ) {
  businesses = data.businesses;
  } else if (
  Array.isArray(data?.results)
  ) {
  businesses = data.results;
  }

 

  /*

  * Normalize the response so the rest
  * of our application doesn't depend
  * directly on RapidAPI's structure.
    */
    const normalizedBusinesses =
    businesses.map((business) => ({
    name:
    business.name ||
    business.business_name ||
    "Unknown Business",

    placeId:
    business.place_id ||
    business.placeId ||
    business.business_id ||
    business.businessId ||
    null,

    latitude:
    Number(
    business.latitude ??
    business.lat ??
    business.location?.latitude ??
    0
    ),

    longitude:
    Number(
    business.longitude ??
    business.lng ??
    business.location?.longitude ??
    0
    ),

    address:
    business.address ||
    business.full_address ||
    business.location?.address ||
    "",

    rating:
    Number(
    business.rating ??
    business.stars ??
    0
    ),

    reviewCount:
    Number(
    business.review_count ??
    business.reviews ??
    business.user_ratings_total ??
    0
    ),

    businessStatus:
    business.business_status ||
    business.status ||
    null,

    website:
    business.website ||
    business.site ||
    null,

    phone:
    business.phone ||
    business.phone_number ||
    null,

    categories:
    business.categories ||
    business.category ||
    [],

    openingStatus:
    business.open_now ??
    business.opening_status ??
    null,

    workingHours:
    business.working_hours ||
    business.hours ||
    null,

    reviewsPerRating:
    business.reviews_per_rating ||
    business.rating_distribution ||
    null,

    photos:
    business.photos ||
    [],

    raw: business,
    }));

  return normalizedBusinesses;

} catch (error) {
console.error(
"RapidAPI business search error:"
);


if (error.response) {
  console.error(
    "Status:",
    error.response.status
  );

  console.error(
    "Response:",
    error.response.data
  );
} else {
  console.error(
    error.message
  );
}

    const status = error.response?.status || error.status;
    const rawMessage = error.response?.data?.message || error.message || "";
    const lower = rawMessage.toLowerCase();

    // 1. True Monthly Quota vs Transient RPS
    const isQuota =
      /monthly\s*quota|daily\s*quota|requests\s*per\s*month|quota\s*exceeded/i.test(rawMessage) &&
      !/per\s*second/i.test(rawMessage);

    if (isQuota) {
      const err = new Error("RapidAPI monthly quota exceeded. Please try again after quota reset or upgrade your plan.");
      err.code = "SEARCH_QUOTA_EXCEEDED";
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

    // 2. 504 Gateway Timeout or Network Timeout
    const isTimeout =
      status === 504 ||
      status === 408 ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      lower.includes("timeout") ||
      lower.includes("timed out");

    if (isTimeout) {
      const err = new Error("RapidAPI Gateway Timeout (504): upstream places service timed out. Please retry.");
      err.code = "TIMEOUT";
      err.status = status || 504;
      err.provider = "rapidapi";
      throw err;
    }

    // 3. 502 Bad Gateway
    if (status === 502) {
      const err = new Error("RapidAPI Bad Gateway (502): upstream places service was unavailable. Please retry.");
      err.code = "BAD_GATEWAY";
      err.status = 502;
      err.provider = "rapidapi";
      throw err;
    }

    // 4. 500 Server Error
    if (status === 500) {
      const err = new Error("RapidAPI Server Error (500): upstream places service encountered an error. Please retry.");
      err.code = "SERVER_ERROR";
      err.status = 500;
      err.provider = "rapidapi";
      throw err;
    }

    // 5. 401 / 403 Authentication Error
    if (status === 401 || status === 403) {
      const err = new Error("RapidAPI Authentication Error: Invalid or unauthorized API key.");
      err.code = "AUTH_ERROR";
      err.status = status;
      err.provider = "rapidapi";
      throw err;
    }

    // 6. Generic Provider Fallback
    const fallbackMessage = rawMessage
      ? `RapidAPI error (${status || "unknown"}): ${rawMessage}`
      : "Nearby business search failed due to an unknown provider error.";
    const err = new Error(fallbackMessage);
    err.code = "PROVIDER_ERROR";
    err.status = status || 500;
    err.provider = "rapidapi";
    throw err;
  }
};

export default rapidApiBusinessSearch;

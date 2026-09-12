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





  const response = await axios.get(
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

throw new Error(
  "Failed to search nearby businesses using RapidAPI"
);


}
};

export default rapidApiBusinessSearch;

/**
 * Deterministic mock fixtures for Phase 3 tools.
 */

export const TOOL_FIXTURES = {
  tech_idea_analysis: {
    // This is the default fixture returned for any valid input
    feasibility: "High",
    suggestedStack: ["React", "Node.js", "PostgreSQL"],
    marketFitScore: 8.5,
    risks: ["Competition", "Technical complexity"],
  },
  nearby_business_search: {
    totalFound: 3,
    searchRadius: 3000,
    businesses: [
      {
        name: "Mock Competitor Alpha",
        placeId: "mock-place-alpha-101",
        latitude: 39.7392,
        longitude: -104.9903,
        address: "101 Market St, Denver, CO",
        rating: 4.5,
        reviewCount: 320,
        distanceKm: 0.45,
      },
      {
        name: "Mock Competitor Beta",
        placeId: "mock-place-beta-102",
        latitude: 39.742,
        longitude: -104.987,
        address: "205 16th St, Denver, CO",
        rating: 4.1,
        reviewCount: 180,
        distanceKm: 0.85,
      },
      {
        name: "Mock Competitor Gamma",
        placeId: "mock-place-gamma-103",
        latitude: 39.75,
        longitude: -104.98,
        address: "410 Larimer St, Denver, CO",
        rating: 3.9,
        reviewCount: 95,
        distanceKm: 1.42,
      },
    ],
    density: {
      within500m: 1,
      within1km: 2,
      within3km: 3,
    },
    averageRating: 4.17,
    totalReviews: 595,
  },
  business_reviews_search: {
    businessId: "mock-place-alpha-101",
    businessName: "Mock Competitor Alpha",
    totalReviews: 3,
    reviews: [
      {
        reviewerName: "Customer Alice",
        rating: 5,
        text: "Great selection and fast checkout, but parking can be tricky.",
        date: "2025-01-15",
      },
      {
        reviewerName: "Customer Bob",
        rating: 3,
        text: "Average service, wait times were longer than expected during peak hours.",
        date: "2025-02-01",
      },
      {
        reviewerName: "Customer Carol",
        rating: 4,
        text: "Good prices and friendly staff. Digital app needs better order tracking.",
        date: "2025-02-20",
      },
    ],
  },
  review_sentiment_analyzer: {
    summary:
      "Customers value fast service and quality selection, but frequently complain about wait times during peak hours and parking availability.",
    strengths: ["Helpful staff", "Quality product selection"],
    weaknesses: [
      "Peak hour wait times",
      "Limited parking",
      "App order tracking gaps",
    ],
    commonComplaints: [
      "Long checkout lines",
      "Unpredictable delivery windows",
    ],
    customerLikes: ["Friendly staff", "Competitive pricing"],
    opportunities: [
      "Offer express pickup window",
      "Proactive order status notifications",
    ],
    overallSentiment: "Mostly Positive",
    confidence: "Medium",
    reviewsAnalyzed: 3,
  },
};

export default TOOL_FIXTURES;
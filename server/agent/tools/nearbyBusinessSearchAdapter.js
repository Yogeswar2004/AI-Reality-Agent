import BaseToolAdapter from "../toolAdapter.js";
import {
  TOOL_IDS,
  TOOL_ACCESS,
  TOOL_RISK,
  DEFAULT_QUOTA_COST,
  MOCK_ENABLED,
} from "../toolConstants.js";
import { TOOL_FIXTURES } from "../toolFixtures.js";
import nearbyBusinessSearch from "../../utils/nearbyBusinessSearch.js";

/**
 * Adapter for the nearby_business_search tool.
 */
class NearbyBusinessSearchAdapter extends BaseToolAdapter {
  constructor(definition) {
    super(definition);
    if (definition.id !== TOOL_IDS.NEARBY_BUSINESS_SEARCH) {
      throw new Error("Incorrect tool ID for NearbyBusinessSearchAdapter");
    }
  }

  /**
   * Validate input for nearby_business_search.
   * Expects: { businessType: string, latitude: number, longitude: number, radius?: number, limit?: number }
   * @param {any} input
   * @throws {Error}
   */
  validateInput(input) {
    if (typeof input !== "object" || input === null) {
      throw new Error("Input must be an object");
    }

    const { businessType, latitude, longitude, radius, limit } = input;

    if (typeof businessType !== "string" || !businessType.trim()) {
      throw new Error("Input must have a non-empty string 'businessType'");
    }
    if (businessType.length > 100) {
      throw new Error("'businessType' must not exceed 100 characters");
    }

    if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error("'latitude' must be a valid number between -90 and 90");
    }

    if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("'longitude' must be a valid number between -180 and 180");
    }

    if (radius !== undefined && radius !== null) {
      if (typeof radius !== "number" || !Number.isFinite(radius) || radius < 100 || radius > 20000) {
        throw new Error("'radius' must be a number between 100 and 20000 meters");
      }
    }

    if (limit !== undefined && limit !== null) {
      if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 10) {
        throw new Error("'limit' must be an integer between 1 and 10");
      }
    }

    const allowedKeys = ["businessType", "latitude", "longitude", "radius", "limit"];
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
      const fixture = TOOL_FIXTURES.nearby_business_search;
      return {
        ...fixture,
        businesses: fixture.businesses.map((b) => ({ ...b })),
        density: { ...fixture.density },
      };
    }

    const radius = input.radius || 3000;
    const limit = input.limit || 5;

    const rawBusinesses = await nearbyBusinessSearch({
      businessType: input.businessType.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      radius,
      limit,
    });

    const businesses = rawBusinesses.map((b) => ({
      name: b.name || "Unknown Business",
      placeId: b.placeId || "",
      latitude: Number(b.latitude) || 0,
      longitude: Number(b.longitude) || 0,
      address: b.address || "",
      rating: typeof b.rating === "number" ? b.rating : 0,
      reviewCount: typeof b.reviewCount === "number" ? b.reviewCount : 0,
      distanceKm: typeof b.distanceKm === "number" ? b.distanceKm : 0,
    }));

    const within500m = businesses.filter((b) => b.distanceKm <= 0.5).length;
    const within1km = businesses.filter((b) => b.distanceKm <= 1.0).length;
    const within3km = businesses.filter((b) => b.distanceKm <= 3.0).length;

    const ratings = businesses.map((b) => b.rating).filter((r) => r > 0);
    const averageRating =
      ratings.length > 0
        ? Number((ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(2))
        : 0;

    const totalReviews = businesses.reduce((s, b) => s + (b.reviewCount || 0), 0);

    return {
      totalFound: businesses.length,
      searchRadius: radius,
      businesses,
      density: {
        within500m,
        within1km,
        within3km,
      },
      averageRating,
      totalReviews,
    };
  }

  /**
   * Validate output for nearby_business_search.
   * @param {any} output
   * @throws {Error}
   */
  validateOutput(output) {
    if (typeof output !== "object" || output === null) {
      throw new Error("Output must be an object");
    }

    const { totalFound, searchRadius, businesses, density, averageRating, totalReviews } = output;

    if (typeof totalFound !== "number" || totalFound < 0) {
      throw new Error("Output must have a non-negative number 'totalFound'");
    }
    if (typeof searchRadius !== "number" || searchRadius < 0) {
      throw new Error("Output must have a non-negative number 'searchRadius'");
    }
    if (!Array.isArray(businesses)) {
      throw new Error("Output must have a 'businesses' array");
    }
    for (const b of businesses) {
      if (typeof b !== "object" || b === null) {
        throw new Error("Each item in 'businesses' must be an object");
      }
      if (typeof b.name !== "string" || typeof b.placeId !== "string") {
        throw new Error("Each business must have 'name' and 'placeId' strings");
      }
    }

    if (typeof density !== "object" || density === null) {
      throw new Error("Output must have a 'density' object");
    }
    if (
      typeof density.within500m !== "number" ||
      typeof density.within1km !== "number" ||
      typeof density.within3km !== "number"
    ) {
      throw new Error("'density' must contain within500m, within1km, and within3km numbers");
    }

    if (typeof averageRating !== "number") {
      throw new Error("Output must have a number 'averageRating'");
    }
    if (typeof totalReviews !== "number") {
      throw new Error("Output must have a number 'totalReviews'");
    }
  }
}

const definition = {
  id: TOOL_IDS.NEARBY_BUSINESS_SEARCH,
  name: "Nearby Business Search",
  description: "Discovers competitors and local businesses near coordinates using RapidAPI.",
  version: "1.0.0",
  inputSchema: {
    type: "object",
    properties: {
      businessType: { type: "string", minLength: 1, maxLength: 100 },
      latitude: { type: "number", minimum: -90, maximum: 90 },
      longitude: { type: "number", minimum: -180, maximum: 180 },
      radius: { type: "number", minimum: 100, maximum: 20000 },
      limit: { type: "integer", minimum: 1, maximum: 10 },
    },
    required: ["businessType", "latitude", "longitude"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      totalFound: { type: "number" },
      searchRadius: { type: "number" },
      businesses: { type: "array" },
      density: { type: "object" },
      averageRating: { type: "number" },
      totalReviews: { type: "number" },
    },
    required: ["totalFound", "searchRadius", "businesses", "density", "averageRating", "totalReviews"],
    additionalProperties: true,
  },
  access: TOOL_ACCESS.READ_ONLY,
  external: true,
  quotaCost: DEFAULT_QUOTA_COST,
  riskLevel: TOOL_RISK.LOW,
  mockEnabled: MOCK_ENABLED,
};

const adapterInstance = new NearbyBusinessSearchAdapter(definition);

export {
  adapterInstance as NearbyBusinessSearchAdapter,
  definition as nearbyBusinessSearchDefinition,
};
export default adapterInstance;

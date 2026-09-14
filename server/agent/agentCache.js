import crypto from "crypto";
import { getDB } from "../config/db.js";
import { TOOL_IDS } from "./toolConstants.js";

export const AGENT_CACHE_COLLECTION = "agent_cache";

/**
 * Standard TTL durations in seconds.
 * nearby_business_search: 24 hours
 * business_reviews_search: 24 hours
 * review_sentiment_analyzer: 48 hours
 */
export const CACHE_TTLS = Object.freeze({
  [TOOL_IDS.NEARBY_BUSINESS_SEARCH]: 24 * 60 * 60, // 86,400s
  [TOOL_IDS.BUSINESS_REVIEWS_SEARCH]: 24 * 60 * 60, // 86,400s
  [TOOL_IDS.REVIEW_SENTIMENT_ANALYZER]: 48 * 60 * 60, // 172,800s
});

/**
 * Compute a deterministic SHA-256 hash from any JSON-serializable object.
 */
function sha256Hex(data) {
  const normalized = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Generate a deterministic cache key for nearby_business_search.
 * Normalizes:
 * - businessType (trimmed, lowercased, collapsed whitespace)
 * - latitude & longitude (rounded to 4 decimal places, ~11m precision)
 * - radius (integer meters)
 * - limit (integer)
 */
export const generateNearbyBusinessSearchCacheKey = ({
  businessType,
  latitude,
  longitude,
  radius = 3000,
  limit = 5,
}) => {
  const normType = String(businessType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const normLat = Number(latitude).toFixed(4);
  const normLng = Number(longitude).toFixed(4);
  const normRadius = Math.round(Number(radius) || 3000);
  const normLimit = Math.round(Number(limit) || 5);

  const payload = {
    businessType: normType,
    lat: normLat,
    lng: normLng,
    radius: normRadius,
    limit: normLimit,
  };

  return `nearby_biz:${sha256Hex(payload)}`;
};

/**
 * Generate a deterministic cache key for business_reviews_search.
 * Normalizes:
 * - businessId (Google placeId trimmed, case-sensitive)
 * - limit (integer)
 * - region (trimmed lowercase or null)
 */
export const generateBusinessReviewsSearchCacheKey = ({
  businessId,
  limit = 5,
  region = null,
}) => {
  const normId = String(businessId || "").trim();
  const normLimit = Math.round(Number(limit) || 5);
  const normRegion = region ? String(region).trim().toLowerCase() : null;

  const payload = {
    businessId: normId,
    limit: normLimit,
    region: normRegion,
  };

  return `biz_reviews:${sha256Hex(payload)}`;
};

/**
 * Generate a deterministic cache key for review_sentiment_analyzer.
 * Normalizes:
 * - businessName (trimmed, lowercased)
 * - businessType (trimmed, lowercased)
 * - reviews (canonical sorted review texts / ratings)
 */
export const generateReviewSentimentCacheKey = ({
  businessName,
  businessType,
  reviews = [],
}) => {
  const normName = String(businessName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const normType = String(businessType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const normReviews = (Array.isArray(reviews) ? reviews : [])
    .map((r) => ({
      reviewerName: String(r.reviewerName || "").trim().toLowerCase(),
      rating: typeof r.rating === "number" ? r.rating : 0,
      text: String(r.text || "").trim().toLowerCase().replace(/\s+/g, " "),
      date: r.date ? String(r.date).trim() : null,
    }))
    .sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));

  const payload = {
    businessName: normName,
    businessType: normType,
    reviews: normReviews,
  };

  return `review_sentiment:${sha256Hex(payload)}`;
};

/**
 * Generic key generator helper.
 */
export const generateCacheKey = (cacheType, params = {}) => {
  switch (cacheType) {
    case TOOL_IDS.NEARBY_BUSINESS_SEARCH:
      return generateNearbyBusinessSearchCacheKey(params);
    case TOOL_IDS.BUSINESS_REVIEWS_SEARCH:
      return generateBusinessReviewsSearchCacheKey(params);
    case TOOL_IDS.REVIEW_SENTIMENT_ANALYZER:
      return generateReviewSentimentCacheKey(params);
    default:
      throw new Error(`Unsupported cacheType for caching: ${cacheType}`);
  }
};

/**
 * Retrieve a valid, unexpired entry from agent_cache.
 * Returns null if not found, expired, or on database error.
 */
export const getCachedEntry = async (key) => {
  if (!key || typeof key !== "string") {
    return null;
  }

  try {
    const collection = getDB().collection(AGENT_CACHE_COLLECTION);
    const now = new Date();

    const doc = await collection.findOne({
      key,
      expiresAt: { $gt: now },
    });

    if (!doc || !doc.data) {
      return null;
    }

    // Increment hitCount asynchronously for observability
    collection
      .updateOne(
        { _id: doc._id },
        {
          $inc: { hitCount: 1 },
          $set: { updatedAt: new Date() },
        }
      )
      .catch((err) => {
        // Non-blocking log
        console.warn("[AgentCache] Could not increment hitCount:", err?.message);
      });

    return {
      key: doc.key,
      cacheType: doc.cacheType,
      data: doc.data,
      provider: doc.provider,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      hitCount: doc.hitCount || 0,
    };
  } catch (err) {
    console.warn("[AgentCache] Cache lookup failed, proceeding as miss:", err?.message);
    return null;
  }
};

/**
 * Persist a validated tool output to agent_cache.
 * Never throws; returns the saved entry or null on error.
 */
export const setCachedEntry = async ({
  key,
  cacheType,
  params = {},
  data,
  provider = "unknown",
  ttlSeconds = null,
}) => {
  if (!key || !cacheType || !data || typeof data !== "object") {
    return null;
  }

  try {
    const ttl =
      typeof ttlSeconds === "number" && ttlSeconds > 0
        ? ttlSeconds
        : CACHE_TTLS[cacheType] || 24 * 60 * 60;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    // Deep clone data to prevent accidental mutation
    const safeData = JSON.parse(JSON.stringify(data));
    // Remove internal flags before persisting
    delete safeData._cached;
    delete safeData._cachedAt;

    const cacheDoc = {
      key,
      cacheType,
      params: JSON.parse(JSON.stringify(params)),
      data: safeData,
      provider,
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };

    const collection = getDB().collection(AGENT_CACHE_COLLECTION);
    await collection.updateOne(
      { key },
      { $set: cacheDoc },
      { upsert: true }
    );

    return cacheDoc;
  } catch (err) {
    console.warn("[AgentCache] Cache write failed, continuing safely:", err?.message);
    return null;
  }
};

/**
 * Ensure compound and TTL indexes for agent_cache collection.
 */
export const ensureAgentCacheIndexes = async () => {
  try {
    const collection = getDB().collection(AGENT_CACHE_COLLECTION);

    // 1. Unique index on cache key
    await collection.createIndex({ key: 1 }, { unique: true });

    // 2. TTL index on expiresAt (automatic MongoDB background cleanup)
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // 3. Query index for metrics and cache audit
    await collection.createIndex({ cacheType: 1, createdAt: -1 });

    console.log(
      "Indexes ensured on agent_cache: { key: 1 } (unique), { expiresAt: 1 } (TTL), { cacheType: 1, createdAt: -1 }"
    );
  } catch (err) {
    console.warn("Could not ensure indexes on agent_cache:", err?.message);
  }
};


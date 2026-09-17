/**
 * Shared, pure utility for local business category extraction and keyword taxonomy.
 * 
 * Free of side effects, database clients, LLM dependencies, or environment configuration.
 */

export const LOCAL_KEYWORDS = [
  "food court",
  "food stall",
  "food truck",
  "fast food",
  "coffee shop",
  "coffee",
  "restaurant",
  "canteen",
  "eatery",
  "diner",
  "bistro",
  "bakery",
  "cafe",
  "pizzeria",
  "pizza",
  "brewery",
  "bar",
  "pub",
  "food",
  "gym",
  "fitness",
  "salon",
  "spa",
  "barber",
  "barbershop",
  "boutique",
  "bookstore",
  "grocery store",
  "supermarket",
  "clinic",
  "dentist",
  "dental",
  "doctor",
  "pharmacy",
  "florist",
  "dry cleaner",
  "laundry",
  "car wash",
  "auto repair",
  "mechanic",
  "repair shop",
  "plumber",
  "plumbing",
  "electrician",
  "storefront",
  "brick and mortar",
  "brick-and-mortar",
];

export const MODIFIER_KEYWORDS = new Set([
  "boutique",
  "brick and mortar",
  "brick-and-mortar",
  "storefront",
]);

export const hasWordMatch = (text, word) => {
  const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp("(^|[^a-z0-9])" + escaped + "([^a-z0-9]|$)", "i").test(text);
};

/**
 * Extracts a specific local business category from a freeform goal string.
 * Uses priority weighting: primary establishment types over generic modifiers,
 * and longer/more specific phrases over short substrings.
 * 
 * @param {string} goal
 * @returns {string} Extracted category or "local business"
 */
export function extractBusinessType(goal) {
  if (typeof goal !== "string" || !goal.trim()) {
    return "local business";
  }

  const cleanGoal = goal.toLowerCase().replace(/\s+/g, " ").trim();
  const sortedKeywords = [...LOCAL_KEYWORDS].sort((a, b) => b.length - a.length);

  const matchedKeywords = [];
  for (const kw of sortedKeywords) {
    if (hasWordMatch(cleanGoal, kw)) {
      matchedKeywords.push(kw);
    }
  }

  if (matchedKeywords.length === 0) {
    return "local business";
  }

  // Priority 1: Primary establishment category (non-modifier), picking the longest/most specific match
  const primaryMatch = matchedKeywords.find((kw) => !MODIFIER_KEYWORDS.has(kw));
  if (primaryMatch) {
    return primaryMatch;
  }

  // Priority 2: If only modifier/storefront keywords matched
  const firstMatch = matchedKeywords[0];
  if (firstMatch === "brick and mortar" || firstMatch === "brick-and-mortar" || firstMatch === "storefront") {
    return "local store";
  }

  return firstMatch;
}

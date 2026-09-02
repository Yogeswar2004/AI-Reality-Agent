import rapidApiBusinessSearch from "./rapidApiBusinessSearch.js";

/**
 * Search for nearby competitors using RapidAPI.
 *
 * This function acts as the main business-search layer
 * for the rest of the application.
 *
 * @param {Object} options
 * @param {string} options.businessType
 * @param {number} options.latitude
 * @param {number} options.longitude
 * @param {number} options.radius
 * @param {number} options.limit
 */

const nearbyBusinessSearch = async ({
  businessType,
  latitude,
  longitude,
  radius = 3000,
  limit = 5,
}) => {
  try {
    if (!businessType?.trim()) {
      throw new Error("Business type is required");
    }

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      throw new Error(
        "Valid latitude and longitude are required"
      );
    }





    /*
     * Use the working RapidAPI business-search
     * utility.
     */
    const businesses =
      await rapidApiBusinessSearch({
        businessType: businessType.trim(),
        latitude,
        longitude,
        radius,
        limit,
      });



    /*
     * Calculate distance from the user's selected
     * location and keep businesses within the
     * requested radius.
     *
     * Haversine formula.
     */
    const toRadians = (degrees) =>
      (degrees * Math.PI) / 180;

    const calculateDistance = (
      lat1,
      lon1,
      lat2,
      lon2
    ) => {
      const earthRadiusKm = 6371;

      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(dLon / 2) ** 2;

      const c =
        2 *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        );

      return earthRadiusKm * c;
    };

    const businessesWithDistance =
      businesses
        .map((business) => {
          if (
            !Number.isFinite(
              business.latitude
            ) ||
            !Number.isFinite(
              business.longitude
            ) ||
            business.latitude === 0 ||
            business.longitude === 0
          ) {
            return {
              ...business,
              distanceKm: null,
            };
          }

          const distanceKm =
            calculateDistance(
              latitude,
              longitude,
              business.latitude,
              business.longitude
            );

          return {
            ...business,
            distanceKm:
              Number(distanceKm.toFixed(2)),
          };
        })
        /*
         * Remove businesses whose coordinates
         * are unavailable.
         */
        .filter(
          (business) =>
            business.distanceKm !== null
        )
        /*
         * Keep only businesses inside the
         * requested radius.
         */
        .filter(
          (business) =>
            business.distanceKm <=
            radius / 1000
        )
        /*
         * Nearest businesses first.
         */
        .sort(
          (a, b) =>
            a.distanceKm -
            b.distanceKm
        );



    return businessesWithDistance;
  } catch (error) {
    console.error(
      "Nearby business search error:"
    );

    console.error(
      error.message || error
    );

    throw new Error(
      "Failed to search nearby competitors"
    );
  }
};

export default nearbyBusinessSearch;
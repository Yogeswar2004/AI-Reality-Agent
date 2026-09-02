/**

* Calculate competition score for a local business idea.
*
* Score: 0 - 100
*
* Higher score = stronger competition.
  */

const calculateDistanceKm = (
lat1,
lon1,
lat2,
lon2
) => {
const earthRadiusKm = 6371;

const toRadians = (degrees) =>
(degrees * Math.PI) / 180;

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

const getCompetitionLevel = (score) => {
if (score >= 75) {
return "Very High";
}

if (score >= 55) {
return "High";
}

if (score >= 35) {
return "Medium";
}

if (score >= 15) {
return "Low";
}

return "Very Low";
};

const calculateCompetitionScore = ({
competitors = [],
latitude,
longitude,
}) => {
if (
!Array.isArray(competitors) ||
competitors.length === 0
) {
return {
score: 0,
level: "Very Low",
totalCompetitors: 0,
within500m: 0,
within1km: 0,
within3km: 0,
averageRating: 0,
totalReviews: 0,
competitors: [],
};
}

const competitorsWithDistance =
competitors.map((business) => {
const businessLatitude =
Number(business.latitude);


  const businessLongitude =
    Number(business.longitude);

  let distanceKm = null;

  if (
    Number.isFinite(businessLatitude) &&
    Number.isFinite(businessLongitude) &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    distanceKm = calculateDistanceKm(
      latitude,
      longitude,
      businessLatitude,
      businessLongitude
    );
  }

  return {
    ...business,
    distanceKm:
      distanceKm !== null
        ? Number(distanceKm.toFixed(2))
        : null,
  };
});


const within500m =
competitorsWithDistance.filter(
(business) =>
business.distanceKm !== null &&
business.distanceKm <= 0.5
).length;

const within1km =
competitorsWithDistance.filter(
(business) =>
business.distanceKm !== null &&
business.distanceKm <= 1
).length;

const within3km =
competitorsWithDistance.filter(
(business) =>
business.distanceKm !== null &&
business.distanceKm <= 3
).length;

const businessesWithRatings =
competitorsWithDistance.filter(
(business) =>
Number.isFinite(business.rating) &&
business.rating > 0
);

const averageRating =
businessesWithRatings.length > 0
? businessesWithRatings.reduce(
(sum, business) =>
sum + business.rating,
0
) /
businessesWithRatings.length
: 0;

const totalReviews =
competitorsWithDistance.reduce(
(sum, business) =>
sum +
(Number(business.reviewCount) || 0),
0
);

/*

* ---
* COMPETITION SCORE
* ---
*
* We use four factors:
*
* 1. Nearby competitor density
* 2. Competitors within 1 km
* 3. Average rating
* 4. Review volume
     */

// 0-35 points
const densityScore = Math.min(
within3km * 1.75,
35
);

// 0-30 points
const proximityScore = Math.min(
within1km * 3,
30
);

// 0-20 points
const ratingScore = Math.min(
(averageRating / 5) * 20,
20
);

// 0-15 points
const reviewScore = Math.min(
(Math.log10(
totalReviews + 1
) /
4) *
15,
15
);

let score =
densityScore +
proximityScore +
ratingScore +
reviewScore;

score = Math.round(
Math.min(Math.max(score, 0), 100)
);

return {
score,


level:
  getCompetitionLevel(score),

totalCompetitors:
  competitorsWithDistance.length,

within500m,

within1km,

within3km,

averageRating:
  Number(averageRating.toFixed(2)),

totalReviews,

competitors:
  competitorsWithDistance.sort(
    (a, b) => {
      if (
        a.distanceKm === null
      ) {
        return 1;
      }

      if (
        b.distanceKm === null
      ) {
        return -1;
      }

      return (
        a.distanceKm -
        b.distanceKm
      );
    }
  ),


};
};

export default calculateCompetitionScore;

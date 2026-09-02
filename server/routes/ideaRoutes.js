import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

import nearbyBusinessSearch from "../utils/nearbyBusinessSearch.js";
import getBusinessReviews from "../utils/businessReviews.js";
import analyzeReviews from "../utils/reviewAnalyzer.js";
import localBusinessAnalyzer from "../utils/localBusinessAnalyzer.js";

import aiAnalyzer from "../utils/aiAnalyzer.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// CREATE A NEW IDEA
// POST /api/ideas
// ========================================

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      analysisMode,
      businessType,
      location,
      searchRadius,
    } = req.body;


    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }
    if (
      analysisMode === "local" &&
      (!location ||
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please select a valid location on the map",
      });
    }

    const db = getDB();

    const newIdea = {
      userId: req.user.userId,

      title: title.trim(),

      description: description.trim(),

      category: category?.trim() || "General",

      analysisMode: analysisMode || "tech",

      businessType:
        analysisMode === "local"
          ? businessType?.trim() || null
          : null,

      location:
        analysisMode === "local"
          ? location || null
          : null,

      searchRadius:
        analysisMode === "local"
          ? Number(searchRadius) || 3000
          : null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };
    const result = await db
      .collection("ideas")
      .insertOne(newIdea);

    return res.status(201).json({
      success: true,
      message: "Idea saved successfully",
      idea: {
        id: result.insertedId.toString(),
        ...newIdea,
      },
    });


  } catch (error) {
    console.error("Create idea error:", error);


    return res.status(500).json({
      success: false,
      message: "Failed to save idea",
    });


  }
});

// ========================================
// GET LOGGED-IN USER'S IDEAS
// GET /api/ideas
// ========================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    const db = getDB();


    const ideas = await db
      .collection("ideas")
      .find({
        userId: req.user.userId,
      })
      .sort({
        createdAt: -1,
      })
      .toArray();

    return res.status(200).json({
      success: true,
      ideas,
    });


  } catch (error) {
    console.error("Get ideas error:", error);


    return res.status(500).json({
      success: false,
      message: "Failed to fetch ideas",
    });


  }
});



// ========================================
// ANALYZE ONE IDEA
// POST /api/ideas/:id/analyze
// ========================================

router.post(
  "/:id/analyze",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid idea ID",
        });
      }

      const db = getDB();

      const idea = await db
        .collection("ideas")
        .findOne({
          _id: new ObjectId(id),
          userId: req.user.userId,
        });

      if (!idea) {
        return res.status(404).json({
          success: false,
          message: "Idea not found",
        });
      }








      // ========================================
      // LOCAL BUSINESS ANALYSIS
      // ========================================

      if (idea.analysisMode === "local") {
        if (
          !idea.location ||
          typeof idea.location.latitude !== "number" ||
          typeof idea.location.longitude !== "number"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Business location is missing or invalid",
          });
        }

        if (!idea.businessType?.trim()) {
          return res.status(400).json({
            success: false,
            message:
              "Business type is required for local analysis",
          });
        }

        // ========================================
        // STEP 1 — FIND COMPETITORS
        // ========================================



        const competitors =
          await nearbyBusinessSearch({
            businessType:
              idea.businessType.trim(),

            latitude:
              idea.location.latitude,

            longitude:
              idea.location.longitude,

            radius:
              idea.searchRadius || 3000,

            limit: 5,
          });


        // ========================================
        // STEP 2 — CALCULATE COMPETITION DATA
        // ========================================



        const radiusKm =
          (idea.searchRadius || 3000) / 1000;

        const within500m =
          competitors.filter(
            (business) =>
              business.distanceKm !== null &&
              business.distanceKm <= 0.5
          ).length;

        const within1km =
          competitors.filter(
            (business) =>
              business.distanceKm !== null &&
              business.distanceKm <= 1
          ).length;

        const within3km =
          competitors.filter(
            (business) =>
              business.distanceKm !== null &&
              business.distanceKm <= 3
          ).length;

        const ratings =
          competitors
            .map((business) => business.rating)
            .filter(
              (rating) =>
                Number.isFinite(rating) &&
                rating > 0
            );

        const reviewCounts =
          competitors
            .map(
              (business) =>
                Number(business.reviewCount) || 0
            );

        const averageRating =
          ratings.length > 0
            ? Number(
              (
                ratings.reduce(
                  (sum, rating) =>
                    sum + rating,
                  0
                ) /
                ratings.length
              ).toFixed(2)
            )
            : 0;

        const totalReviews =
          reviewCounts.reduce(
            (sum, count) =>
              sum + count,
            0
          );

        /*
         * Competition score.
         *
         * This is intentionally based primarily
         * on competitor density and social proof.
         *
         * It is NOT simply the number of competitors.
         */

        let competitionScore = 0;

        if (within500m >= 10) {
          competitionScore += 40;
        } else if (within500m >= 5) {
          competitionScore += 30;
        } else if (within500m >= 3) {
          competitionScore += 20;
        } else if (within500m >= 1) {
          competitionScore += 10;
        }

        if (within1km >= 15) {
          competitionScore += 30;
        } else if (within1km >= 10) {
          competitionScore += 25;
        } else if (within1km >= 5) {
          competitionScore += 15;
        } else if (within1km >= 1) {
          competitionScore += 10;
        }

        if (totalReviews >= 10000) {
          competitionScore += 30;
        } else if (totalReviews >= 5000) {
          competitionScore += 25;
        } else if (totalReviews >= 2000) {
          competitionScore += 20;
        } else if (totalReviews >= 500) {
          competitionScore += 10;
        }

        competitionScore = Math.min(
          100,
          competitionScore
        );

        let competitionLevel =
          "Low";

        if (competitionScore >= 76) {
          competitionLevel = "Very High";
        } else if (competitionScore >= 51) {
          competitionLevel = "High";
        } else if (competitionScore >= 26) {
          competitionLevel = "Moderate";
        }

        const competition = {
          score: competitionScore,

          level: competitionLevel,

          totalCompetitors:
            competitors.length,

          within500m,

          within1km,

          within3km,

          searchRadius:
            idea.searchRadius || 3000,

          averageRating,

          totalReviews,

          competitors,
        };





        // ========================================
        // STEP 3 — REVIEW INTELLIGENCE
        // ========================================


        /*
         * Analyze reviews from the strongest nearby
         * competitors.
         *
         * We start with the first 5 competitors
         * because the list is already sorted by distance.
         */

        const competitorsForReviews =
          competitors.slice(0, 5);

        const reviewAnalyses = [];

        for (
          const competitor
          of competitorsForReviews
        ) {
          if (!competitor.placeId) {


            continue;
          }

          try {


            const reviews =
              await getBusinessReviews({
                businessId:
                  competitor.placeId,

                limit: 5,
              });



            if (reviews.length === 0) {
              continue;
            }

            const reviewInsight =
              await analyzeReviews({
                businessName:
                  competitor.name,

                businessType:
                  idea.businessType,

                reviews,
              });

            reviewAnalyses.push({
              businessId:
                competitor.placeId,

              businessName:
                competitor.name,

              rating:
                competitor.rating,

              reviewCount:
                competitor.reviewCount,

              distanceKm:
                competitor.distanceKm,

              reviewsAnalyzed:
                reviews.length,

              insights:
                reviewInsight,
            });

          } catch (reviewError) {
            console.error(
              `Review analysis failed for ${competitor.name}:`,
              reviewError.message
            );

            /*
             * One competitor failing should NOT
             * destroy the entire local analysis.
             */

            continue;
          }
        }

        // ========================================
        // COMBINE REVIEW INTELLIGENCE
        // ========================================

        const combinedReviewInsights = {
          competitorsAnalyzed:
            reviewAnalyses.length,

          totalReviewsAnalyzed:
            reviewAnalyses.reduce(
              (sum, item) =>
                sum +
                Number(
                  item.reviewsAnalyzed
                ),
              0
            ),

          businesses:
            reviewAnalyses,

          summaries:
            reviewAnalyses.map(
              (item) => ({
                businessName:
                  item.businessName,

                rating:
                  item.rating,

                reviewCount:
                  item.reviewCount,

                distanceKm:
                  item.distanceKm,

                insights:
                  item.insights,
              })
            ),
        };






        // ========================================
        // STEP 4 — FINAL GEMINI ANALYSIS
        // ========================================


        const finalAnalysis =
          await localBusinessAnalyzer({
            title:
              idea.title,

            description:
              idea.description,

            businessType:
              idea.businessType,

            location:
              idea.location,

            competition,

            reviewInsights:
              combinedReviewInsights,
          });

        // ========================================
        // STEP 5 — SAVE EVERYTHING TO MONGODB
        // ========================================

        const localAnalysis = {
          ...finalAnalysis,

          competition,

          reviewInsights:
            combinedReviewInsights,

          analyzedAt:
            new Date(),
        };

        await db
          .collection("ideas")
          .updateOne(
            {
              _id: new ObjectId(id),

              userId:
                req.user.userId,
            },

            {
              $set: {
                localAnalysis,

                competitors,

                competitorCount:
                  competitors.length,

                competitorSearchUpdatedAt:
                  new Date(),

                analysis:
                  localAnalysis,

                updatedAt:
                  new Date(),
              },
            }
          );



        return res.status(200).json({
          success: true,

          message:
            "Local business analysis completed successfully",

          analysis:
            localAnalysis,
        });
      }

      // ========================================
      // NORMAL / TECH ANALYSIS
      // ========================================



      const analysis =
        await aiAnalyzer(idea);

      await db
        .collection("ideas")
        .updateOne(
          {
            _id: new ObjectId(id),

            userId:
              req.user.userId,
          },

          {
            $set: {
              analysis,

              updatedAt:
                new Date(),
            },
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Idea analyzed successfully",

        analysis,
      });

    } catch (error) {
      console.error(
        "\n========================================"
      );

      console.error(
        "Analyze idea error:"
      );

      console.error(
        error
      );

      console.error(
        "========================================\n"
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to analyze idea",
      });
    }
  }
);



// ========================================
// GET ONE IDEA
// GET /api/ideas/:id
// ========================================

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;


    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid idea ID",
      });
    }

    const db = getDB();

    const idea = await db
      .collection("ideas")
      .findOne({
        _id: new ObjectId(id),
        userId: req.user.userId,
      });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: "Idea not found",
      });
    }

    return res.status(200).json({
      success: true,
      idea,
    });


  } catch (error) {
    console.error("Get idea error:", error);


    return res.status(500).json({
      success: false,
      message: "Failed to fetch idea",
    });


  }
});

// ========================================
// DELETE IDEA
// DELETE /api/ideas/:id
// ========================================

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;


    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid idea ID",
      });
    }

    const db = getDB();

    const result = await db
      .collection("ideas")
      .deleteOne({
        _id: new ObjectId(id),
        userId: req.user.userId,
      });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Idea not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Idea deleted successfully",
    });


  } catch (error) {
    console.error("Delete idea error:", error);


    return res.status(500).json({
      success: false,
      message: "Failed to delete idea",
    });


  }
});
router.post(
  "/:id/competitors",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;


      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid idea ID",
        });
      }

      const db = getDB();

      const idea = await db
        .collection("ideas")
        .findOne({
          _id: new ObjectId(id),
          userId: req.user.userId,
        });

      if (!idea) {
        return res.status(404).json({
          success: false,
          message: "Idea not found",
        });
      }

      if (
        idea.analysisMode !== "local"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Competitor search is only available for local businesses",
        });
      }

      if (
        !idea.location ||
        typeof idea.location.latitude !==
        "number" ||
        typeof idea.location.longitude !==
        "number"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Business location is missing or invalid",
        });
      }

      const competitors =
        await nearbyBusinessSearch({
          businessType:
            idea.businessType,

          latitude:
            idea.location.latitude,

          longitude:
            idea.location.longitude,

          radius:
            idea.searchRadius || 3000,
        });

      const competitorCount =
        competitors.length;

      await db
        .collection("ideas")
        .updateOne(
          {
            _id: new ObjectId(id),
            userId: req.user.userId,
          },
          {
            $set: {
              competitors,

              competitorCount,

              competitorSearchUpdatedAt:
                new Date(),

              updatedAt:
                new Date(),
            },
          }
        );

      return res.status(200).json({
        success: true,

        message:
          "Nearby competitors found successfully",

        businessType:
          idea.businessType,

        location:
          idea.location,

        searchRadius:
          idea.searchRadius || 3000,

        competitorCount,

        competitors,
      });
    } catch (error) {
      console.error(
        "Competitor search error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to search nearby competitors",
      });
    }


  }
);


export default router;

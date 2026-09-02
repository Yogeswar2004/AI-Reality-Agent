
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-3.5-flash";

/**
 * Generate the final AI analysis for a local business idea.
 *
 * Combines:
 * - User's business idea
 * - Business location
 * - Competition statistics
 * - Nearby competitors
 * - Review intelligence
 */
const localBusinessAnalyzer = async ({
  title,
  description,
  businessType,
  location,
  competition,
  reviewInsights,
}) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY is not configured in .env"
      );
    }

    console.log(
      "Generating final local business analysis..."
    );

    const prompt = `
You are a professional local business market analyst.

Analyze whether the user's proposed local business is a realistic opportunity based on the supplied competition and customer review data.

IMPORTANT RULES:

- Use the supplied data as the primary evidence.
- Do not invent businesses, ratings, reviews, prices, complaints, or market statistics.
- Clearly distinguish evidence from recommendations.
- If information is insufficient, say so.
- Give practical advice that a small business owner can actually use.
- Do not automatically recommend starting the business.
- A high competition score means competition is strong, not that the business is impossible.
- Look for gaps in existing competitors that the new business could exploit.

USER BUSINESS IDEA

Business Name:
${title}

Business Type:
${businessType}

Location:
${location}

Description:
${description}

COMPETITION DATA

${JSON.stringify(competition, null, 2)}

REVIEW INTELLIGENCE

${JSON.stringify(reviewInsights, null, 2)}

Return ONLY valid JSON.

Use exactly this structure:

{
  "overallVerdict": "Strong Opportunity",
  "opportunityScore": 0,
  "competitionScore": 0,
  "competitionLevel": "Very High",
  "marketSummary": "",
  "competitionSummary": "",
  "customerInsights": {
    "whatCustomersLike": [],
    "commonComplaints": [],
    "unmetNeeds": []
  },
  "competitorStrengths": [],
  "competitorWeaknesses": [],
  "businessOpportunities": [],
  "differentiationStrategies": [],
  "risks": [],
  "recommendations": [],
  "recommendedNextSteps": []
}

VALID VALUES:

overallVerdict:
- Strong Opportunity
- Possible Opportunity
- Challenging Market
- High Risk

competitionLevel:
- Low
- Moderate
- High
- Very High

SCORING RULES:

opportunityScore:
0-30 = High Risk
31-50 = Challenging Market
51-70 = Possible Opportunity
71-100 = Strong Opportunity

competitionScore:
0-25 = Low
26-50 = Moderate
51-75 = High
76-100 = Very High

The opportunity score should consider:

- Competition
- Competitor strength
- Customer sentiment
- Review volume
- Identifiable customer complaints
- Unmet needs
- Differentiation opportunities

Do NOT simply calculate:

opportunityScore = 100 - competitionScore

Instead, evaluate the complete situation.

All arrays should contain concise and useful points.

Do not include Markdown.

Return valid JSON only.
`;

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(
          `Local business analysis attempt ${attempt}/3...`
        );

        const response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
        });

        console.log(
          "Final local business analysis received"
        );

        let text =
          response.text ||
          response.candidates?.[0]?.content?.parts?.[0]
            ?.text ||
          "";

        if (!text) {
          throw new Error(
            "Gemini returned an empty response"
          );
        }

        text = text.trim();

        // Remove Markdown JSON fences if Gemini adds them.
        if (text.startsWith("```json")) {
          text = text.substring(7);
        }

        if (text.startsWith("```")) {
          text = text.substring(3);
        }

        if (text.endsWith("```")) {
          text = text.substring(0, text.length - 3);
        }

        text = text.trim();

        const analysis = JSON.parse(text);

        return analysis;
      } catch (error) {
        lastError = error;

        console.error(
          `Local business analysis attempt ${attempt} failed:`,
          error?.message || error
        );

        if (attempt < 3) {
          const delay = attempt * 2000;

          console.log(
            `Retrying in ${delay / 1000} seconds...`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );
        }
      }
    }

    throw lastError;
  } catch (error) {
    console.error(
      "Local business analyzer error:",
      error?.message || error
    );

    throw new Error(
      "Failed to generate local business analysis"
    );
  }
};

export default localBusinessAnalyzer;


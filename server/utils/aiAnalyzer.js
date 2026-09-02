import gemini from "../config/gemini.js";

const normalizeScore = (value, fallback = 0) => {
const score = Number(value);

if (Number.isNaN(score)) {
return fallback;
}

return Math.max(0, Math.min(100, Math.round(score)));
};

const normalizeLevel = (value, fallback = "Medium") => {
const normalized = String(value || "")
.trim()
.toLowerCase();

if (normalized === "low") {
return "Low";
}

if (normalized === "medium") {
return "Medium";
}

if (normalized === "high") {
return "High";
}

return fallback;
};

const normalizeArray = (value) => {
if (!Array.isArray(value)) {
return [];
}

return value
.filter((item) => typeof item === "string")
.map((item) => item.trim())
.filter(Boolean);
};

const normalizeText = (
value,
fallback = "Not available"
) => {
if (
typeof value !== "string" ||
!value.trim()
) {
return fallback;
}

return value.trim();
};

const normalizeRoadmap = (value) => {
if (!Array.isArray(value)) {
return [];
}

return value
.filter(
(item) =>
item &&
typeof item === "object" &&
!Array.isArray(item)
)
.map((item) => ({
phase: normalizeText(
item.phase,
"Development Phase"
),
title: normalizeText(
item.title,
"Task"
),
description: normalizeText(
item.description,
""
),
}));
};

const validateAnalysis = (data) => {
const scores = data?.scores || {};

return {
overallScore: normalizeScore(
data?.overallScore
),


competition: normalizeLevel(
  data?.competition
),

demand: normalizeLevel(
  data?.demand
),

development: normalizeLevel(
  data?.development
),

monetization: normalizeLevel(
  data?.monetization
),

seo: normalizeLevel(
  data?.seo
),

scores: {
  competition: normalizeScore(
    scores.competition
  ),

  demand: normalizeScore(
    scores.demand
  ),

  development: normalizeScore(
    scores.development
  ),

  monetization: normalizeScore(
    scores.monetization
  ),

  seo: normalizeScore(
    scores.seo
  ),
},

targetUsers: normalizeArray(
  data?.targetUsers
),

competitors: normalizeArray(
  data?.competitors
),

differentiation: normalizeArray(
  data?.differentiation
),

requiredApis: normalizeArray(
  data?.requiredApis
),

estimatedCost: normalizeText(
  data?.estimatedCost,
  "Not estimated"
),

strengths: normalizeArray(
  data?.strengths
),

weaknesses: normalizeArray(
  data?.weaknesses
),

marketRisks: normalizeArray(
  data?.marketRisks
),

monetizationStrategies: normalizeArray(
  data?.monetizationStrategies
),

mvpFeatures: normalizeArray(
  data?.mvpFeatures
),

roadmap: normalizeRoadmap(
  data?.roadmap
),

recommendation: normalizeText(
  data?.recommendation
),

analyzedAt: new Date(),


};
};

const aiAnalyzer = async (idea) => {
const prompt = `
You are an expert startup analyst, product strategist,
market researcher, and software architect.

Analyze the following project idea in detail:

Title: ${idea.title}

Description:
${idea.description}

Category: ${idea.category}

Return ONLY valid JSON.

Do not return markdown.
Do not return code fences.
Do not add explanations outside the JSON.

Use this exact structure:

{
"overallScore": 0,

"competition": "Low",
"demand": "Low",
"development": "Low",
"monetization": "Low",
"seo": "Low",

"scores": {
"competition": 0,
"demand": 0,
"development": 0,
"monetization": 0,
"seo": 0
},

"targetUsers": [
"User group 1",
"User group 2",
"User group 3"
],

"competitors": [
"Competitor 1",
"Competitor 2",
"Competitor 3"
],

"differentiation": [
"Differentiation idea 1",
"Differentiation idea 2",
"Differentiation idea 3"
],

"requiredApis": [
"API 1",
"API 2"
],

"estimatedCost": "$0 - $0",

"strengths": [
"Strength 1",
"Strength 2",
"Strength 3"
],

"weaknesses": [
"Weakness 1",
"Weakness 2",
"Weakness 3"
],

"marketRisks": [
"Risk 1",
"Risk 2",
"Risk 3"
],

"monetizationStrategies": [
"Strategy 1",
"Strategy 2",
"Strategy 3"
],

"mvpFeatures": [
"Feature 1",
"Feature 2",
"Feature 3",
"Feature 4",
"Feature 5"
],

"roadmap": [
{
"phase": "Phase 1",
"title": "Planning",
"description": "Description"
},
{
"phase": "Phase 2",
"title": "MVP Development",
"description": "Description"
},
{
"phase": "Phase 3",
"title": "Testing",
"description": "Description"
}
],

"recommendation": "Final recommendation about whether to build this project."
}

Rules:

* Every numerical score must be between 0 and 100.
* Use only Low, Medium, or High for:
  competition, demand, development, monetization, and seo.
* Analyze the idea realistically, not optimistically.
* Mention actual competitors when possible.
* Identify meaningful strengths and weaknesses.
* Identify realistic market and technical risks.
* Suggest practical monetization strategies.
* Recommend only essential MVP features.
* Create a practical development roadmap.
* The recommendation should clearly explain whether
  the user should build, validate, pivot, or avoid the idea.
* Only recommend APIs that would genuinely be useful.
* estimatedCost should be a realistic MVP development cost range in USD.
  `;

  try {
  const response = await gemini.models.generateContent({
  model: "gemini-3.6-flash",

  
  contents: prompt,

  config: {
    temperature: 0.4,
    responseMimeType: "application/json",
  },
  

  });

  const text = response.text;

  if (!text) {
  throw new Error(
  "Gemini returned an empty response"
  );
  }

  let rawAnalysis;

  try {
  rawAnalysis = JSON.parse(text);
  } catch (parseError) {
  console.error(
  "Invalid Gemini JSON:",
  text
  );

  
  throw new Error(
    "Gemini returned invalid JSON"
  );
  

  }

  return validateAnalysis(rawAnalysis);
  } catch (error) {
  console.error(
  "AI analysis error:",
  error
  );

  throw new Error(
  "Failed to generate AI analysis"
  );
  }
  };

export default aiAnalyzer;

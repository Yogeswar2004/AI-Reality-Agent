import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
throw new Error(
"GEMINI_API_KEY is missing from the .env file"
);
}

const gemini = new GoogleGenAI({
apiKey: process.env.GEMINI_API_KEY,
});

export default gemini;


import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const modelsToTest = [
    "gemini-2.0-flash-lite-preview-02-05", // Seen in curl output
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
];

async function main() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log("Testing Specific Models:");
    for (const modelName of modelsToTest) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log(`✅ OK`);
        } catch (error: any) {
            console.log(`❌ Failed (${error.status || error.message})`);
        }
    }
}

main();

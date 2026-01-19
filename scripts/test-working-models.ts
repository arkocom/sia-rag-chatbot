
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const modelsToTest = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-001"
];

async function main() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        console.log("No API Key");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log("Testing Available Models:");
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

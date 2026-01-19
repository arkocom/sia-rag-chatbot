
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-pro",
    "gemini-2.0-flash-exp",
];

async function main() {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        console.log("No API Key");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    console.log("Testing Chat Models:");
    for (const modelName of modelsToTest) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            console.log(`✅ OK`);
        } catch (error: any) {
            console.log(`❌ Failed (${error.status || 'Error'})`);
        }
    }

    console.log("\nTesting Embedding Models:");
    const embeddingModels = ["text-embedding-004", "embedding-001"];
    for (const modelName of embeddingModels) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.embedContent("Hello world");
            console.log(`✅ OK`);
        } catch (error: any) {
            console.log(`❌ Failed`);
        }
    }
}

main();

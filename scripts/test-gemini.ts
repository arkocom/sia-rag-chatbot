
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No GEMINI_API_KEY found in environment");
        return;
    }
    console.log(`🔑 Key found: ${apiKey.substring(0, 5)}...`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Test 1: List models
    console.log("\n📡 Testing Model List...");
    try {
        // Need to use the REST API or see if SDK supports listing (SDK doesn't expose listModels directly in client usually, but let's try a simple generation first)
        // Actually getting a model list is good practice.
        // But let's just try to generate content with 'gemini-1.5-flash' first.

        const modelName = "gemini-1.5-flash";
        console.log(`🤖 Testing generation with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log(`✅ Success! Response: ${response.text()}`);
    } catch (error: any) {
        console.error(`❌ Error with gemini-1.5-flash: ${error.message}`);

        // Try fallback
        console.log("\n🔄 Retrying with 'gemini-pro'...");
        try {
            const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await fallbackModel.generateContent("Hello?");
            console.log(`✅ Success with gemini-pro! Response: ${result.response.text()}`);
        } catch (e: any) {
            console.error(`❌ Error with gemini-pro: ${e.message}`);
        }
    }
}

main();

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ✅ FIX: ensure fetch works in all Node versions
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// ==========================================
// 🚨 FAIL-SAFE: CHECK FOR API KEY 🚨
// ==========================================
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "undefined") {
  console.error("\n❌ ERROR: Gemini API Key is missing!");
  console.error("Make sure your file is named exactly '.env'");
  console.error("It must be in the same folder as server.js");
  console.error("Format:");
  console.error("GEMINI_API_KEY=your_key_here\n");
  process.exit(1);
} else {
  console.log("\n✅ SUCCESS: Gemini API Key found!");
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini SDK securely
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. YAHOO FINANCE PRICE ENDPOINT
// ==========================================
app.get("/price/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase() + ".NS";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!price) {
      console.log("Yahoo response:", data);
      return res.status(400).json({ error: "Invalid symbol or no data" });
    }

    res.json({
      price,
      isLive: true,
    });

  } catch (err) {
    console.error("PRICE API ERROR:", err.message || err);
    res.status(500).json({ error: "Failed to fetch price" });
  }
});

// ==========================================
// 2. AI ASSISTANT ENDPOINT (GEMINI)
// ==========================================
app.post("/ai", async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message is required" });
    }

    const systemPrompt = `
You are a friendly, intelligent, and human-like AI assistant integrated into an investment dashboard.

-----------------------------------------
🧠 CORE IDENTITY
-----------------------------------------
You are:
- A conversational AI like ChatGPT
- ALSO a smart investment assistant

You can handle:
✔ Casual conversations
✔ Random questions
✔ Investment analysis using portfolio data

-----------------------------------------
💬 PERSONALITY & TONE
-----------------------------------------
- Natural, human-like, and engaging
- Slightly informal but respectful
- Light humor is okay when appropriate
- Never robotic or overly technical

-----------------------------------------
🧠 INTELLIGENCE MODES
-----------------------------------------
1. GENERAL MODE → normal chat
2. FINANCE MODE → portfolio insights

-----------------------------------------
📊 USER PORTFOLIO DATA
-----------------------------------------
${context && context.hasData ? JSON.stringify(context, null, 2) : "No portfolio data provided."}

-----------------------------------------
💡 RESPONSE GUIDELINES
-----------------------------------------
- Be conversational
- No robotic tone
- Keep it clean and readable
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(message);
    const reply = result?.response?.text() || "No response generated";

    res.json({ reply });

  } catch (error) {
    console.error("Gemini AI Error:", error.message || error);

    // ✅ Better error handling
    if (error.message?.includes("API key")) {
      return res.status(500).json({
        reply: "API key issue. Please check server configuration.",
      });
    }

    res.status(500).json({
      reply: "I'm having trouble connecting right now. Please try again.",
    });
  }
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📈 Price API: http://localhost:${PORT}/price/:symbol`);
  console.log(`🤖 AI API: http://localhost:${PORT}/ai\n`);
});
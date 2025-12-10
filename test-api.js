import axios from "axios";

// ⬇️ PASTE YOUR NEW CORE KEY BETWEEN THE QUOTES
const CORE_KEY = "sk-5a46bee270d64a78b7019886b98c63e0";
const MODEL = "deepseek-chat";

async function testDeepSeek() {
  console.log("🔍 Testing CORE_AI");
  console.log("🔑 Using Key:", CORE_KEY.substring(0, 15) + "...");

  try {
    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: MODEL,
        messages: [{ role: "user", content: "Respond with one word: SUCCESS" }]
      },
      {
        headers: {
          Authorization: `Bearer ${CORE_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("🌟 RESULT:", response.data.choices[0].message.content);
  } catch (err) {
    console.log("❌ ERROR:", err.response?.data || err.message);
  }
}

testDeepSeek();

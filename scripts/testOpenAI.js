/**
 * Lightweight OpenAI connectivity check.
 * Loads .env.local then calls gpt-4o-mini for a short JSON reply.
 */
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, "..", ".env.local"));

async function main() {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY in process.env / .env.local");
    process.exit(1);
  }

  const model = "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: 'Reply with JSON only: {"phrase":"<exactly five words>"}',
        },
        {
          role: "user",
          content: "Return any safe five-word phrase.",
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content ?? "";
    console.log("[SUCCESS] OpenAI API Connected!");
    console.log("Model:", response.model || model);
    console.log("Response:", content);
  } catch (error) {
    console.error("[ERROR] OpenAI API call failed");
    console.error("Status:", error?.status ?? "n/a");
    console.error("Code:", error?.code ?? "n/a");
    console.error("Type:", error?.type ?? error?.name ?? "n/a");
    console.error("Message:", error?.message ?? String(error));
    if (error?.error) {
      console.error("Details:", JSON.stringify(error.error, null, 2));
    }
    process.exit(1);
  }
}

main();

// Quick standalone test for the OpenRouter "stealth/ox-alpha" model.
// Usage (PowerShell):
//   $env:OPENROUTER_API_KEY="sk-..."; node scripts/test-ox-alpha.js "your prompt here"

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Missing OPENROUTER_API_KEY environment variable.");
  process.exit(1);
}

const prompt = process.argv.slice(2).join(" ") || "Dis bonjour en une phrase.";

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "stealth/ox-alpha",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exitCode = 1;
    return;
  }

  const data = await res.json();
  console.log(data.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

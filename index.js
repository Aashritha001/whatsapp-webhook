const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: false }));

// Stores conversation history per WhatsApp number
const sessions = {};

app.post("/whatsapp", async (req, res) => {
  const userMessage = req.body.Body;
  const from = req.body.From;

  if (!userMessage || !from) {
    return res.status(400).send("Bad request");
  }

  // Build conversation history
  if (!sessions[from]) sessions[from] = [];
  sessions[from].push({ role: "user", content: userMessage });
  if (sessions[from].length > 20) sessions[from] = sessions[from].slice(-20);

  try {
    // Call your existing Lovable chatbot
    const chatRes = await fetch("https://smile-helper-bot.lovable.app/api/public/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: sessions[from] }),
    });

    const data = await chatRes.json();
    const replyText = buildReply(data);

    sessions[from].push({ role: "assistant", content: data.message });

    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyText}</Message></Response>`);

  } catch (err) {
    console.error(err);
    res.set("Content-Type", "text/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, something went wrong. Please try again.</Message></Response>`);
  }
});

function buildReply(data) {
  let text = data.message || "I'm here to help!";

  // Fix "button" references to "link"
  text = text.replace(/button below/gi, "link below");
  text = text.replace(/Book button/gi, "link");
  text = text.replace(/Call button/gi, "link");

  if (data.actions?.includes("book") && data.meta?.booking_url) {
    text += `\n\n📅 Book online: ${data.meta.booking_url}`;
  }
  if (data.actions?.includes("call") && data.meta?.phone) {
    text += `\n\n📞 Call us: ${data.meta.phone}`;
  }
  if (data.actions?.includes("call_back")) {
    text += `\n\n📋 Reply with your name and phone number and we'll call you back.`;
  }
  if (data.actions?.includes("nhs")) {
    text += `\n\nℹ️ NHS info: https://www.nhs.uk/nhs-services/dentists/`;
  }
  if (data.suggestions?.length) {
    text += "\n\n💬 Reply with a number to choose:\n" + data.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n");
  }

  return text;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Webhook running on port ${PORT}`));

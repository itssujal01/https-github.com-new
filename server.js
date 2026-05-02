import express from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: "*" }));

function cleanText(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function findAvatar(html) {
  const imgMatches = [...html.matchAll(/https?:\/\/[^"'\s<>]+?\.(?:png|jpg|jpeg|webp)/gi)];
  const urls = imgMatches.map(m => m[0]);

  return (
    urls.find(u => u.includes("avatar")) ||
    urls.find(u => u.includes("picuser")) ||
    urls.find(u => u.includes("head")) ||
    urls[0] ||
    ""
  );
}

function findPackages(text) {
  const packages = [];

  const priceRegex = /(₹\s?\d+)/g;
  const prices = [...text.matchAll(priceRegex)].map(m => m[1]);

  const packRegex = /(\d+\s*Gold)/gi;
  const packs = [...text.matchAll(packRegex)].map(m => m[1]);

  for (let i = 0; i < Math.min(prices.length, packs.length); i++) {
    packages.push({
      pack: packs[i],
      price: prices[i],
      extraGold: "0"
    });
  }

  return packages;
}

function findName(text, id) {
  let beforeId = text.split(id)[0] || "";
  beforeId = beforeId.replace(/.*Controls/i, "").trim();

  if (beforeId.length > 2 && beforeId.length < 80) {
    return beforeId;
  }

  return "";
}

app.get("/", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.json({
      success: false,
      message: "Please provide id"
    });
  }

  try {
    const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await response.text();
    const visibleText = cleanText(html);

    const userNotFound =
      visibleText.toLowerCase().includes("user doesn't exist") ||
      visibleText.toLowerCase().includes("user does not exist");

    if (userNotFound) {
      return res.json({
        success: false,
        id,
        message: "User not found"
      });
    }

    const avatar = findAvatar(html);
    const packages = findPackages(visibleText);
    const name = findName(visibleText, id);

    return res.json({
      success: true,
      id,
      url,
      name,
      avatar,
      packages,
      visibleText
    });
  } catch (error) {
    return res.json({
      success: false,
      id,
      message: "Fetch failed",
      error: error.message
    });
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});

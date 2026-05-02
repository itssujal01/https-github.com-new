import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();

app.use(cors({ origin: "*" }));

let browser;

const CACHE = new Map();
const CACHE_TTL = 60 * 1000;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-default-apps"
      ]
    });
  }

  return browser;
}

function cleanText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function getLines(text) {
  return cleanText(text)
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);
}

function extractName(text, id) {
  const allLines = getLines(text);

  for (const line of allLines) {
    if (line.includes(`ID: ${id}`)) {
      const name = line.split("ID:")[0].trim();
      if (name && name.length < 50) return name;
    }
  }

  const inline = cleanText(text).match(new RegExp(`(?:Controls\\s+)?(.{1,40}?)\\s+ID:\\s*${id}`));
  if (inline && inline[1]) {
    return inline[1]
      .replace(/About Us|Contribute Songs|Media Resources|Parental Controls/gi, "")
      .trim();
  }

  return "";
}

function extractMaskedEmail(text) {
  const match = cleanText(text).match(/[a-zA-Z0-9._%+-]*\*{3,}[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : "";
}

function extractPackages(text) {
  const flat = cleanText(text);
  const packages = [];

  const packRegex = /((?:\d+(?:K)?|\d{1,6})\s*Gold)\s*₹\s?(\d+)/gi;
  let match;

  while ((match = packRegex.exec(flat)) !== null) {
    const pack = match[1].replace(/\s+/g, " ").trim();
    const price = `₹${match[2]}`;

    const start = Math.max(0, match.index - 80);
    const end = Math.min(flat.length, match.index + match[0].length + 80);
    const nearby = flat.slice(start, end);

    const bonusMatch =
      nearby.match(/\+\s*([0-9]+)\s*(?:bonus\s*)?Gold/i) ||
      nearby.match(/extra\s*Gold\s*[:\-]?\s*([0-9]+)/i);

    packages.push({
      pack,
      price,
      extraGold: bonusMatch ? bonusMatch[1] : "",
      hasOffer: !!bonusMatch
    });
  }

  const unique = [];
  const seen = new Set();

  for (const p of packages) {
    const key = `${p.pack}-${p.price}-${p.extraGold}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  return unique;
}

function extractCharm(text) {
  const match = cleanText(text).match(/Charm\s*:\s*([0-9]+)/i);
  return match ? match[1] : "";
}

function pickAvatar(images) {
  return (
    images.find(src => src.includes("picuser")) ||
    images.find(src => src.includes("/header/")) ||
    images.find(src => src.toLowerCase().includes("avatar")) ||
    ""
  );
}

app.get("/", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.json({
      success: false,
      message: "Please provide id"
    });
  }

  const cached = CACHE.get(id);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.json(cached.data);
  }

  let page;

  try {
    const b = await getBrowser();

    page = await b.newPage({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      viewport: { width: 390, height: 844 }
    });

    await page.route("**/*", route => {
      const type = route.request().resourceType();

      if (["font", "media"].includes(type)) {
        return route.abort();
      }

      return route.continue();
    });

    const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForFunction(
      userId => document.body && document.body.innerText.includes(userId),
      id,
      { timeout: 12000 }
    ).catch(() => {});

    await page.waitForTimeout(1500);

    const dataFromPage = await page.evaluate(userId => {
      const text = document.body ? document.body.innerText : "";

      const images = Array.from(document.images)
        .map(img => img.src)
        .filter(Boolean);

      return {
        text,
        images
      };
    }, id);

    const visibleText = dataFromPage.text || "";
    const images = dataFromPage.images || [];

    const notFound =
      visibleText.toLowerCase().includes("user doesn't exist") ||
      visibleText.toLowerCase().includes("user does not exist");

    if (notFound) {
      const result = {
        success: false,
        id,
        message: "User not found"
      };

      CACHE.set(id, { time: Date.now(), data: result });
      return res.json(result);
    }

    const result = {
      success: true,
      id,
      name: extractName(visibleText, id),
      avatar: pickAvatar(images),
      charm: extractCharm(visibleText),
      maskedEmail: extractMaskedEmail(visibleText),
      packages: extractPackages(visibleText),
      url,
      fetchedAt: new Date().toISOString()
    };

    CACHE.set(id, { time: Date.now(), data: result });

    return res.json(result);
  } catch (error) {
    return res.json({
      success: false,
      id,
      message: "Fetch failed",
      error: error.message
    });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});

import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
app.use(cors({ origin: "*" }));

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
  }
  return browser;
}

function lines(text) {
  return text.split("\n").map(x => x.trim()).filter(Boolean);
}

function extractName(text, id) {
  for (const line of lines(text)) {
    if (line.includes(`ID: ${id}`)) {
      return line.split("ID:")[0].trim();
    }
  }
  return "";
}

function extractCharm(text) {
  const m = text.match(/Charm\s*:\s*([0-9]+)/i);
  return m ? m[1] : "";
}

function extractMaskedEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]*\*+[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : "";
}

function extractPaymentMethods(text) {
  const methods = ["VISA", "mastercard", "DISCOVER", "Diners", "AMEX", "UPI by UniPin", "PayPal"];
  return methods.filter(m => text.toLowerCase().includes(m.toLowerCase()));
}

function extractPackages(text) {
  const found = [];
  const regex = /(\d+(?:K)?\s*Gold)\s*₹\s?(\d+)/gi;
  let m;

  while ((m = regex.exec(text)) !== null) {
    found.push({
      pack: m[1],
      price: `₹${m[2]}`
    });
  }

  const knownPacks = [
    "300 Gold", "600 Gold", "3000 Gold", "10000 Gold",
    "50000 Gold", "100K Gold", "250K Gold", "500K Gold"
  ];

  if (!found.length) {
    for (const p of knownPacks) {
      const priceMatch = text.match(new RegExp(`${p.replace("K", "K")}\\s*₹\\s?(\\d+)`, "i"));
      if (priceMatch) found.push({ pack: p, price: `₹${priceMatch[1]}` });
    }
  }

  return found;
}

async function getImages(page) {
  return await page.locator("img").evaluateAll(imgs =>
    imgs.map(img => ({
      src: img.src || "",
      alt: img.alt || "",
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0
    })).filter(x => x.src)
  ).catch(() => []);
}

function pickAvatar(images) {
  return (
    images.find(x => x.src.includes("picuser"))?.src ||
    images.find(x => x.src.includes("header"))?.src ||
    images.find(x => x.src.includes("avatar"))?.src ||
    ""
  );
}

function pickPossibleCharmIcon(images) {
  return (
    images.find(x => x.src.toLowerCase().includes("charm"))?.src ||
    images.find(x => x.src.toLowerCase().includes("vip"))?.src ||
    images.find(x => x.src.toLowerCase().includes("badge"))?.src ||
    ""
  );
}

app.get("/", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.json({ success: false, message: "Please provide id" });
  }

  let page;

  try {
    const b = await getBrowser();

    page = await b.newPage({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      viewport: { width: 390, height: 844 }
    });

    const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;

    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(6000);

    const visibleText = await page.locator("body").innerText().catch(() => "");
    const allLines = lines(visibleText);
    const images = await getImages(page);

    const notFound =
      visibleText.toLowerCase().includes("user doesn't exist") ||
      visibleText.toLowerCase().includes("user does not exist");

    if (notFound) {
      return res.json({ success: false, id, message: "User not found" });
    }

    const data = {
      success: true,
      id,
      url,
      name: extractName(visibleText, id),
      charm: extractCharm(visibleText),
      maskedEmail: extractMaskedEmail(visibleText),
      avatar: pickAvatar(images),
      possibleCharmIcon: pickPossibleCharmIcon(images),
      packages: extractPackages(visibleText),
      paymentMethods: extractPaymentMethods(visibleText),
      images,
      visibleLines: allLines,
      visibleText
    };

    return res.json(data);
  } catch (error) {
    return res.json({
      success: false,
      id,
      message: "Playwright fetch failed",
      error: error.message
    });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});

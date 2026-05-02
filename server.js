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

function extractName(text, id) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`ID: ${id}`) || lines[i].includes(id)) {
      const sameLine = lines[i];

      const nameMatch = sameLine.match(/^(.+?)\s*ID\s*:/i);
      if (nameMatch && nameMatch[1]) {
        return nameMatch[1].trim();
      }

      return lines[i - 1] || "";
    }
  }

  const inlineMatch = text.match(new RegExp(`([\\s\\S]{1,80})ID:\\s*${id}`));
  if (inlineMatch && inlineMatch[1]) {
    return inlineMatch[1]
      .replace(/About Us|Contribute|Songs|Media|Parental Controls/gi, "")
      .trim();
  }

  return "";
}

function extractPackages(text) {
  const packages = [];
  const regex = /(\d+\s*Gold)\s*(?:\+\s*(\d+)\s*bonus Gold)?\s*₹\s?(\d+)/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    packages.push({
      pack: match[1] || "",
      bonus: match[2] ? `${match[2]} bonus Gold` : "",
      price: `₹${match[3]}`
    });
  }

  return packages;
}

function extractMaskedEmail(text) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]*\*+[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : "";
}

async function extractAvatar(page) {
  return await page
    .locator("img")
    .evaluateAll(imgs => {
      const srcs = imgs.map(i => i.src).filter(Boolean);

      return (
        srcs.find(src => src.includes("picuser")) ||
        srcs.find(src => src.includes("avatar")) ||
        srcs.find(src => src.includes("head")) ||
        srcs[0] ||
        ""
      );
    })
    .catch(() => "");
}

app.get("/", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.json({
      success: false,
      message: "Please provide id"
    });
  }

  let page;

  try {
    const b = await getBrowser();

    page = await b.newPage({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
      viewport: {
        width: 390,
        height: 844
      }
    });

    const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(4000);

    const visibleText = await page.locator("body").innerText().catch(() => "");

    const notFound =
      visibleText.toLowerCase().includes("user doesn't exist") ||
      visibleText.toLowerCase().includes("user does not exist");

    if (notFound) {
      return res.json({
        success: false,
        id,
        message: "User not found"
      });
    }

    const name = extractName(visibleText, id);
    const avatar = await extractAvatar(page);
    const packages = extractPackages(visibleText);
    const email = extractMaskedEmail(visibleText);

    return res.json({
      success: true,
      id,
      url,
      name,
      avatar,
      email,
      packages,
      visibleText
    });
  } catch (error) {
    return res.json({
      success: false,
      id,
      message: "Playwright fetch failed",
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

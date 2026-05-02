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
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"
    });

    const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const visibleText = await page.locator("body").innerText().catch(() => "");
    const avatar = await page
      .locator("img")
      .evaluateAll(imgs => imgs.map(i => i.src).find(src => src.includes("picuser") || src.includes("avatar") || src.includes("head")) || "")
      .catch(() => "");

    const name = await page
      .locator("body")
      .evaluate((body, userId) => {
        const text = body.innerText || "";
        const before = text.split(userId)[0] || "";
        const lines = before.split("\n").map(x => x.trim()).filter(Boolean);
        return lines[lines.length - 1] || "";
      }, id)
      .catch(() => "");

    return res.json({
      success: true,
      id,
      url,
      name,
      avatar,
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

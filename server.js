const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
app.use(cors());

function cleanText(text = "") {
  return text.replace(/\s+/g, " ").trim().slice(0, 5000);
}

app.get("/", (req, res) => {
  res.send("WePlay API Running ✅");
});

app.get("/check", async (req, res) => {
  const id = String(req.query.id || "").trim();

  if (!/^[0-9]{4,15}$/.test(id)) {
    return res.json({
      success: false,
      error: "Invalid ID"
    });
  }

  const url = `https://weplayapp.com/recharge?id=${encodeURIComponent(id)}`;
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 45000
    });

    await page.waitForTimeout(5000);

    const visibleText = await page.locator("body").innerText().catch(() => "");

    const images = await page.$$eval("img", imgs =>
      imgs
        .map(img => ({
          src: img.src || "",
          alt: img.alt || "",
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0
        }))
        .filter(img => img.src)
        .slice(0, 30)
    );

    await browser.close();

    res.json({
      success: true,
      id,
      url,
      visibleText: cleanText(visibleText),
      images
    });
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }

    res.json({
      success: false,
      error: err.message
    });
  }
});

const port = process.env.PORT || 8080;

app.listen(port, "0.0.0.0", () => {
  console.log("Server running on port " + port);
});

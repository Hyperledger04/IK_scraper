import express from "express";
import bodyParser from "body-parser";
import { chromium } from "playwright";

const app = express();
app.use(bodyParser.json());

// ---------- Test Route ----------
app.get("/", (req, res) => {
  res.json({ status: "IK Scraper API running" });
});

// ---------- Scraper Logic ----------
async function getDocIdsFromSearch(searchUrl, max = 50) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Block images to reduce load time
  await page.route("**/*", route => {
    const type = route.request().resourceType();
    if (type === "image" || type === "font" || type === "media") route.abort();
    else route.continue();
  });

  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);

  const hrefs = await page.$$eval('a[href*="/doc/"]', els =>
    Array.from(new Set(els.map(a => a.getAttribute("href"))))
  );

  await browser.close();

  const ids = hrefs
    .map(h => {
      const m = h.match(/\/doc\/([^\/?#]+)/);
      return m ? m[1] : null;
    })
    .filter(Boolean)
    .slice(0, max);

  return ids;
}

// ---------- API Endpoint ----------
app.post("/scrape", async (req, res) => {
  try {
    const url = req.body.url;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    console.log("Scraping:", url);
    const docIds = await getDocIdsFromSearch(url);
    res.json({ count: docIds.length, docIds });
  } catch (err) {
    console.error("Scraper error:", err);
    res.status(500).json({ error: "Failed to scrape", details: err.message });
  }
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


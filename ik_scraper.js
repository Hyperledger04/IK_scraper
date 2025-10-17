import express from "express";
import bodyParser from "body-parser";
import { chromium } from "playwright";

const app = express();
app.use(bodyParser.json());

// Core scraper function
async function getDocIdsFromSearch(searchUrl, max = 50) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(searchUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // wait for JS-rendered content

  // Extract all unique /doc/<docid>/ links
  const hrefs = await page.$$eval('a[href*="/doc/"]', els =>
    Array.from(new Set(els.map(a => a.getAttribute("href"))))
  );

  await browser.close();

  // Parse docids
  const ids = hrefs
    .map(h => {
      const m = h.match(/\/doc\/([^\/?#]+)/);
      return m ? m[1] : null;
    })
    .filter(Boolean)
    .slice(0, max); // limit to top `max` results

  return ids;
}

// Express POST endpoint
app.post("/scrape", async (req, res) => {
  try {
    const url = req.body.url;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    const docIds = await getDocIdsFromSearch(url);
    res.json({ docIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to scrape", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

#!/usr/bin/env python3
"""
rss_scanner.py — Zero-API science news aggregator
Fetches from RSS feeds + HTTP endpoints, outputs data/news_feed.json
Compatible with AppChurch pattern: no external AI API required.
"""

import feedparser
import requests
import json
import os
import hashlib
from datetime import datetime, timezone
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────
#  RSS SOURCE REGISTRY
#  Edit this list or use the editor.html AI Optimizer to manage it.
# ─────────────────────────────────────────────
RSS_SOURCES = [
    # ── Core Science ──────────────────────────
    {"name": "Nature News",          "url": "https://www.nature.com/nature.rss",                    "category": "Multidisciplinary"},
    {"name": "Science Magazine",     "url": "https://www.science.org/rss/news_current.xml",          "category": "Multidisciplinary"},
    {"name": "ScienceDaily",         "url": "https://www.sciencedaily.com/rss/all.xml",              "category": "Multidisciplinary"},
    {"name": "Phys.org",             "url": "https://phys.org/rss-feed/",                            "category": "Physics & Tech"},
    {"name": "New Scientist",        "url": "https://www.newscientist.com/feed/home/",               "category": "Multidisciplinary"},
    {"name": "Scientific American",  "url": "https://www.scientificamerican.com/platform/syndication/rss/", "category": "Multidisciplinary"},

    # ── Technology & AI ───────────────────────
    {"name": "MIT Technology Review","url": "https://www.technologyreview.com/feed/",               "category": "Technology"},
    {"name": "Wired Science",        "url": "https://www.wired.com/feed/category/science/latest/rss/","category": "Technology"},
    {"name": "Ars Technica Science", "url": "https://feeds.arstechnica.com/arstechnica/science",    "category": "Technology"},
    {"name": "IEEE Spectrum",        "url": "https://spectrum.ieee.org/rss",                        "category": "Engineering"},
    {"name": "The Verge Science",    "url": "https://www.theverge.com/rss/science/index.xml",       "category": "Technology"},

    # ── Space & Astronomy ─────────────────────
    {"name": "NASA News",            "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss",       "category": "Space"},
    {"name": "Space.com",            "url": "https://www.space.com/feeds/all",                      "category": "Space"},
    {"name": "ESA News",             "url": "https://www.esa.int/rssfeed/Our_Activities/Space_Science","category": "Space"},

    # ── Biology & Medicine ────────────────────
    {"name": "NIH News",             "url": "https://www.nih.gov/rss/news.xml",                     "category": "Medicine"},
    {"name": "EurekAlert!",          "url": "https://www.eurekalert.org/rss.xml",                   "category": "Multidisciplinary"},
    {"name": "MedicalXpress",        "url": "https://medicalxpress.com/rss-feed/",                  "category": "Medicine"},
    {"name": "Cell Press",           "url": "https://www.cell.com/rss/home",                        "category": "Biology"},

    # ── Environment & Climate ─────────────────
    {"name": "Carbon Brief",         "url": "https://www.carbonbrief.org/feed",                     "category": "Climate"},
    {"name": "Climate Home News",    "url": "https://www.climatechangenews.com/feed/",              "category": "Climate"},
    {"name": "Inside Climate News",  "url": "https://insideclimatenews.org/feed/",                  "category": "Climate"},
]

MAX_ITEMS = int(os.environ.get("MAX_ITEMS", 10))
OUTPUT_FILE = "data/news_feed.json"
LOG_FILE    = "data/scan_log.json"
HEADERS     = {"User-Agent": "ScienceNewsBot/1.0 (GitHub Actions; RSS Aggregator)"}
TIMEOUT     = 15


def fetch_rss(source: dict) -> list[dict]:
    """Parse an RSS/Atom feed and return normalized article dicts."""
    items = []
    try:
        resp = requests.get(source["url"], headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)

        for entry in feed.entries[:MAX_ITEMS]:
            # Extract best available summary
            summary = ""
            if hasattr(entry, "summary"):
                soup = BeautifulSoup(entry.summary, "lxml")
                summary = soup.get_text(separator=" ").strip()[:500]

            pub_date = ""
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                pub_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
            elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                pub_date = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc).isoformat()

            link = entry.get("link", "")
            uid  = hashlib.md5(link.encode()).hexdigest()[:12]

            items.append({
                "id":       uid,
                "title":    entry.get("title", "").strip(),
                "url":      link,
                "summary":  summary,
                "source":   source["name"],
                "category": source["category"],
                "date":     pub_date,
            })
    except Exception as e:
        print(f"  ✗ {source['name']}: {e}")
    return items


def deduplicate(articles: list[dict]) -> list[dict]:
    seen_urls = set()
    unique = []
    for a in articles:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            unique.append(a)
    return unique


def main():
    os.makedirs("data", exist_ok=True)
    all_articles = []
    scan_results = []

    print(f"[{datetime.utcnow().isoformat()}] Starting RSS scan ({len(RSS_SOURCES)} sources, max {MAX_ITEMS}/source)")

    for source in RSS_SOURCES:
        print(f"  → {source['name']} …")
        items = fetch_rss(source)
        all_articles.extend(items)
        scan_results.append({
            "source":   source["name"],
            "category": source["category"],
            "url":      source["url"],
            "fetched":  len(items),
            "status":   "ok" if items else "empty",
        })
        print(f"    {len(items)} items fetched")

    all_articles = deduplicate(all_articles)
    # Sort newest first
    all_articles.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Load existing feed and merge (keep last 500 items)
    existing = []
    if os.path.exists(OUTPUT_FILE):
        with open(OUTPUT_FILE) as f:
            try:
                existing = json.load(f).get("articles", [])
            except Exception:
                pass

    existing_urls = {a["url"] for a in all_articles}
    merged = all_articles + [a for a in existing if a["url"] not in existing_urls]
    merged = merged[:500]

    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total":        len(merged),
        "sources":      len(RSS_SOURCES),
        "articles":     merged,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    log = {
        "scanned_at":   datetime.utcnow().isoformat() + "Z",
        "sources_tried":len(RSS_SOURCES),
        "total_fetched":sum(r["fetched"] for r in scan_results),
        "after_dedup":  len(all_articles),
        "results":      scan_results,
    }
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Done. {len(merged)} articles saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

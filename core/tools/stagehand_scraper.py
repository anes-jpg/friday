import sys
import os
import asyncio
import json
import html

# Ensure standard output uses UTF-8 encoding on Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

vendor_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../vendor'))
if vendor_path not in sys.path:
    sys.path.insert(0, vendor_path)

async def extract_web_data(url: str, instruction: str = "") -> str:
    """
    Extracts structured DOM text, headers, and data from a given URL.
    Handles search engine results (DuckDuckGo), documentation, and standard web pages.
    """
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    try:
        import httpx
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,ar;q=0.7",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(url)
            if resp.status_code >= 400:
                return json.dumps({
                    "error": f"HTTP {resp.status_code} while fetching {url}",
                    "url": url
                }, ensure_ascii=False)

            soup = BeautifulSoup(resp.text, "html.parser")

            # Remove scripts, styles, svg
            for tag in soup(["script", "style", "noscript", "svg"]):
                tag.decompose()

            raw_title = soup.title.string.strip() if soup.title and soup.title.string else url
            title = html.unescape(raw_title)

            # Detect DuckDuckGo search results
            is_ddg = "duckduckgo.com" in url or bool(soup.find(class_="results") or soup.find(class_="web-result"))
            search_items = []

            if is_ddg:
                result_elements = soup.find_all(class_=lambda c: c and ("web-result" in c or "result__body" in c or "result" in c))
                seen_snippets = set()
                for el in result_elements:
                    t_el = el.find(class_="result__title") or el.find(class_="result__a")
                    s_el = el.find(class_="result__snippet")
                    u_el = el.find(class_="result__url")

                    t_text = html.unescape(t_el.get_text(" ", strip=True)) if t_el else ""
                    s_text = html.unescape(s_el.get_text(" ", strip=True)) if s_el else ""
                    u_text = u_el.get_text(strip=True) if u_el else ""

                    if s_text and s_text not in seen_snippets:
                        seen_snippets.add(s_text)
                        search_items.append({
                            "title": t_text or "Search Result",
                            "snippet": s_text,
                            "url": u_text
                        })
                    if len(search_items) >= 8:
                        break

            # Extract main headings
            headings = [html.unescape(h.get_text(strip=True)) for h in soup.find_all(["h1", "h2", "h3"]) if h.get_text(strip=True)]
            headings_preview = headings[:10]

            # Extract paragraphs and content sections
            paragraphs = []
            for p in soup.find_all(["p", "article", "section", "li", "tr"]):
                txt = html.unescape(p.get_text(" ", strip=True))
                if len(txt) > 30 and txt not in paragraphs:
                    paragraphs.append(txt)
                if len(paragraphs) >= 15:
                    break

            body_sample = "\n\n".join(paragraphs)
            if len(body_sample) > 4000:
                body_sample = body_sample[:4000] + "... [truncated]"

            # Build human-readable summary
            summary_lines = []
            if search_items:
                for item in search_items:
                    line = f"• **{item['title']}**"
                    if item['url']:
                        line += f" ({item['url']})"
                    line += f"\n  {item['snippet']}"
                    summary_lines.append(line)
            elif paragraphs:
                summary_lines = paragraphs[:6]

            readable_summary = "\n\n".join(summary_lines)

            return json.dumps({
                "title": title,
                "url": url,
                "headings": headings_preview,
                "results": search_items,
                "summary": readable_summary,
                "content": readable_summary if search_items else body_sample,
                "instruction": instruction
            }, indent=2, ensure_ascii=False)

    except Exception as e:
        return json.dumps({"error": f"Failed to extract from {url}: {str(e)}", "url": url}, ensure_ascii=False)

if __name__ == "__main__":
    res = asyncio.run(extract_web_data("https://html.duckduckgo.com/html/?q=prix+sony+xperia+1+mark+3+en+algerie", "check price"))
    print(res)



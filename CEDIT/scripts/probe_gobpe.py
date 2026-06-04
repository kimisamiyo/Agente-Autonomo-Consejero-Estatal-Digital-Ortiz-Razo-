import re
import requests
from html import unescape

url = "https://www.gob.pe/institucion/mef/noticias"
r = requests.get(url, timeout=30, headers={"User-Agent": "CEDIT-MEF-NewsBot/1.0"})
html = r.text

# h3 titles near links
blocks = re.findall(
    r'<h3[^>]*>\s*<a[^>]+href="(/institucion/mef/noticias/[^"]+)"[^>]*>([^<]+)</a>',
    html,
    re.I,
)
print("h3 blocks", len(blocks))
for path, title in blocks[:5]:
    print(path[:60], "...", unescape(title.strip())[:80])

# og:title on article
sample = blocks[0][0] if blocks else None
if sample:
    ar = requests.get("https://www.gob.pe" + sample, timeout=30, headers={"User-Agent": "CEDIT-MEF-NewsBot/1.0"})
    og = re.search(r'property="og:title"\s+content="([^"]+)"', ar.text)
    print("og:title", unescape(og.group(1)) if og else "none")

# -*- coding: utf-8 -*-
from pathlib import Path
import re
import time
import urllib.request

p = Path(r"c:/Users/Ibiza/Desktop/project/挑战杯/frontend/index.html")
raw = p.read_bytes()
text = raw.decode("utf-8", errors="replace")
print("size_bytes", len(raw))
print("size_mb", round(len(raw) / 1024 / 1024, 2))
print("lines", raw.count(b"\n") + 1)
scripts = re.findall(r"<script[^>]+src=[\"']([^\"']+)", text)
print("external_scripts", len(scripts))
for s in scripts:
    print(" ", s)
inline = sum(len(m) for m in re.findall(r"<script(?![^>]*src=)[^>]*>([\s\S]*?)</script>", text, flags=re.I))
print("inline_script_chars", inline)
print("inline_script_kb", round(inline / 1024, 1))

fonts = [u for u in re.findall(r"https://[^\"'\s>]+", text) if "font" in u or "googleapis" in u or "gstatic" in u]
print("font_related_urls", len(set(fonts)))

# local html timing
t0 = time.perf_counter()
with urllib.request.urlopen("http://127.0.0.1:5500/index.html", timeout=30) as r:
    body = r.read()
print("local_html_ms", round((time.perf_counter() - t0) * 1000), "bytes", len(body))

for name, url in [
    ("echarts", "https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"),
    ("g6", "https://cdn.jsdelivr.net/npm/@antv/g6@4.8.24/dist/g6.min.js"),
    ("gsap", "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"),
    ("tsparticles", "https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/tsparticles.slim.bundle.min.js"),
    ("three", "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"),
    ("fonts_css", "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=IBM+Plex+Mono:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Syne:wght@600;700;800&display=swap"),
]:
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=45) as r:
            b = r.read()
        print(f"{name}_ms", round((time.perf_counter() - t0) * 1000), "bytes", len(b))
    except Exception as e:
        print(f"{name}_FAIL", type(e).__name__, str(e)[:160])

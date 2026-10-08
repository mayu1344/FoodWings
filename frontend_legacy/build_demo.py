"""Bundle the front end into ONE self-contained HTML file that always runs in demo mode.

    python frontend/build_demo.py            ->  frontend/dist/foodwings-demo.html

Handy for sharing a clickable demo with your team: no server, no database needed.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def build(body_only: bool = False) -> str:
    html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(HERE, "css", "styles.css"), encoding="utf-8").read()
    html = html.replace('<link rel="stylesheet" href="css/styles.css">', f"<style>\n{css}\n</style>")

    def inline(m):
        src = m.group(1)
        js = open(os.path.join(HERE, src), encoding="utf-8").read()
        if src.endswith("config.js"):
            js += '\nApp.config.mode = "demo"; App.config.lockMode = true;\n'
        return f"<script>\n/* ---- {src} ---- */\n{js}\n</script>"

    # the single-file demo uses the built-in schematic map (no map tiles needed)
    html = re.sub(r'\s*<!-- Map library.*?-->\s*<link[^>]*leaflet[^>]*>\s*<script[^>]*leaflet[^>]*></script>', "", html, flags=re.S)
    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    html = re.sub(r'<a href="(customer|restaurant|rider)\.html">open alone</a>', "", html)   # single file: no sub-pages
    if body_only:   # for hosts that add their own <html>/<head>/<body> wrapper
        head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
        body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
        head = re.sub(r'<meta[^>]*>\s*', "", head)
        html = head.strip() + "\n" + body.strip() + "\n"
    return html


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    out = os.path.join(HERE, "dist", "foodwings-demo.html")
    open(out, "w", encoding="utf-8").write(build())
    print("wrote", out)

import base64
import re
from pathlib import Path

dist = Path(__file__).resolve().parent / "docs"
html = (dist / "index.html").read_text(encoding="utf-8-sig")
logo = base64.b64encode((dist / "atu.svg").read_bytes()).decode("ascii")
html = html.replace('"atu.svg"', '"data:image/svg+xml;base64,' + logo + '"')
html = html.replace('href="./"', 'href="#title"')
html = re.sub(
    r'<link rel="stylesheet" href="([^"]+)">',
    lambda match: "<style>\n" + (dist / match[1]).read_text(encoding="utf-8-sig") + "\n</style>",
    html,
)
scripts = re.findall(r'<script defer src="([^"]+)"></script>\n', html)
html = re.sub(r'<script defer src="[^"]+"></script>\n', "", html)
source = "\n".join((dist / script).read_text(encoding="utf-8-sig") for script in scripts)
source = re.sub(r"</script", lambda match: r"<\/script", source, flags=re.IGNORECASE)
html = html.replace("</body>", "<script>\n" + source + "\n</script>\n</body>")
(dist / "atu-parking-offline.html").write_text(html, encoding="utf-8")

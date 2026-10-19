import os, re, html, time, http.cookiejar, urllib.request, urllib.parse

BASE = 'https://www.vvz.ethz.ch/Vorlesungsverzeichnis/'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36'
_jar = http.cookiejar.CookieJar()
_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_op.addheaders = [('User-Agent', UA)]
_primed = False
# seconds between requests; raise it if the VVZ starts refusing connections
DELAY = float(os.environ.get('VVZ_DELAY', '0.4'))

def _open(url):
    """GET with patient retries: VVZ refuses connections when hit too fast."""
    for wait in (0, 5, 20, 60, 120, 240):
        if wait:
            print(f'  VVZ busy, retrying in {wait}s', flush=True)
            time.sleep(wait)
        try:
            return _op.open(url, timeout=30).read().decode('utf-8', 'replace')
        except Exception:
            continue
    raise RuntimeError(url)

def get(path, **params):
    global _primed
    if not _primed:
        _open('https://www.vvz.ethz.ch/'); _primed = True
    url = BASE + path + ('?' + urllib.parse.urlencode(params) if params else '')
    r = _open(url)
    time.sleep(DELAY)
    return r

def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

def options(h, name):
    m = re.search(r'<select[^>]*name="%s"(.*?)</select>' % name, h, re.S)
    if not m: return []
    return [(v, html.unescape(t).strip()) for v, t in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(1)) if v]

def reset_session():
    """VVZ keeps sticky form state per session; start a fresh one."""
    global _primed
    _jar.clear(); _primed = False

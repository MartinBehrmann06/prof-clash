import re, html, time, http.cookiejar, urllib.request, urllib.parse

BASE = 'https://www.vvz.ethz.ch/Vorlesungsverzeichnis/'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36'
_jar = http.cookiejar.CookieJar()
_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_op.addheaders = [('User-Agent', UA)]
_primed = False

def get(path, **params):
    global _primed
    if not _primed:
        _op.open('https://www.vvz.ethz.ch/').read(); _primed = True
    url = BASE + path + ('?' + urllib.parse.urlencode(params) if params else '')
    for attempt in range(3):
        try:
            r = _op.open(url, timeout=30).read().decode('utf-8', 'replace')
            time.sleep(0.25)
            return r
        except Exception as e:
            time.sleep(2)
    raise RuntimeError(url)

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

"""Fetch lecturer details from VVZ (dozent.view) and look for a portrait photo on the web.
Usage: python3 scrape_people.py courses.json people.json ../public/img/profs"""
import json, os, re, sys, unicodedata, urllib.request, urllib.parse, html as H
from concurrent.futures import ThreadPoolExecutor
from vvz_common import get, text, UA

def field(h, label):
    m = re.search(r'<td[^>]*>\s*%s\s*</td>\s*<td[^>]*>(.*?)</td>' % label, h, re.S)
    return text(m.group(1)) if m else ''

def lecturer(dozide, sem):
    h = get('dozent.view', dozide=dozide, ansicht='2', semkez=sem, lang='en')
    url = re.search(r'<td[^>]*>\s*URL\s*</td>\s*<td[^>]*>.*?href="([^"]+)"', h, re.S)
    return {'id': dozide, 'fullName': field(h, 'Name'), 'field': field(h, 'Field'),
            'department': field(h, 'Department'), 'relationship': field(h, 'Relationship'),
            'url': url.group(1) if url else ''}

def fetch(url, binary=False, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(4_000_000)
        return (data, r.headers.get('Content-Type', '')) if binary else data.decode('utf-8', 'replace')

def ascii_fold(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()

def surname(p):
    n = re.sub(r'^(Prof\.|Dr\.|PD|em\.|sc\.|nat\.|techn\.|ETH|\s)+', '', p['fullName']).strip()
    return n.split()[-1] if n else ''

def from_homepage(p):
    if not p['url']: return None
    try:
        h = fetch(p['url'])
    except Exception:
        return None
    sn = ascii_fold(surname(p))
    cands = []
    for tag in re.findall(r'<img[^>]+>', h, re.I):
        src = re.search(r'\ssrc="([^"]+)"', tag) or re.search(r"\ssrc='([^']+)'", tag)
        if not src: continue
        s = src.group(1)
        hay = ascii_fold(H.unescape(tag))
        if sn and len(sn) > 2 and sn in hay and not re.search(r'logo|icon|banner|\.svg', s, re.I):
            cands.append(s)
    og = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', h, re.I)
    if not cands and og and sn in ascii_fold(og.group(1)):
        cands.append(og.group(1))
    return urllib.parse.urljoin(p['url'], H.unescape(cands[0])) if cands else None

def from_wikipedia(p):
    name = re.sub(r'^(Prof\.|Dr\.|PD|em\.|\s)+', '', p['fullName']).strip()
    for lang in ('en', 'de'):
        try:
            q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'generator': 'search', 'gsrlimit': 1,
                                        'gsrsearch': f'"{name}" ETH', 'prop': 'pageimages', 'piprop': 'thumbnail', 'pithumbsize': 400})
            d = json.loads(fetch(f'https://{lang}.wikipedia.org/w/api.php?{q}'))
            for pg in d.get('query', {}).get('pages', {}).values():
                if ascii_fold(surname(p)) in ascii_fold(pg.get('title', '')) and 'thumbnail' in pg:
                    return pg['thumbnail']['source']
        except Exception:
            pass
    return None

PHOTO_INDEX = json.load(open(os.path.join(os.path.dirname(__file__), 'photo_index.json'))) if os.path.exists(os.path.join(os.path.dirname(__file__), 'photo_index.json')) else []

def clean_name(p):
    n = re.sub(r'\(.*?\)', '', p['fullName'])
    return re.sub(r'^(Prof\.|Dr\.|PD|em\.|\s)+', '', n).strip()

def from_index(p):
    parts = ascii_fold(clean_name(p)).split()
    if len(parts) < 2: return None
    first, last = parts[0], parts[-1]
    for e in sorted(PHOTO_INDEX, key=lambda e: not e.get('personlist')):
        alt = ascii_fold(e['alt'])
        if re.search(r'\b%s\b' % re.escape(last), alt) and re.search(r'\b%s\b' % re.escape(first), alt) and not re.search(r'group|team|gruppe|logo', alt):
            return e['src']
    return None

def find_image(p, outdir):
    for finder in (from_index, from_homepage, from_wikipedia):
        src = finder(p)
        if not src: continue
        try:
            data, ct = fetch(src, binary=True)
        except Exception:
            continue
        if not ct.startswith('image/') or len(data) < 3000: continue
        ext = {'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif'}.get(ct.split(';')[0], 'jpg')
        fn = f"{p['id']}.{ext}"
        open(os.path.join(outdir, fn), 'wb').write(data)
        return {'image': 'img/profs/' + fn, 'imageSource': src}
    return {'image': None, 'imageSource': None}

def main(courses_file, out_file, outdir):
    os.makedirs(outdir, exist_ok=True)
    C = json.load(open(courses_file))
    ids = {}
    for c in C['courses']:
        for d, short in c['lecturers']:
            ids.setdefault(d, c['sem'])
    old = json.load(open(out_file)) if os.path.exists(out_file) else {}
    people = {}
    for i, (d, sem) in enumerate(ids.items()):
        people[d] = old.get(d) or lecturer(d, sem)
        if i % 25 == 0: print('details', i, len(ids), flush=True)
    todo = [p for p in people.values() if not p.get('image')]
    with ThreadPoolExecutor(8) as ex:
        for p, r in zip(todo, ex.map(lambda p: find_image(p, outdir), todo)):
            p.update(r)
    print('with image:', sum(1 for p in people.values() if p.get('image')), '/', len(people))
    json.dump(people, open(out_file, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:4])

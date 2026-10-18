"""Crawl ETH department websites (people/faculty sections) and index portrait images by their alt text.
Output: photo_index.json  [{alt, src, page}]"""
import json, re, sys, html as H, urllib.parse
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from scrape_people import fetch

DOMAINS = ['arch', 'baug', 'biol', 'bsse', 'chab', 'eaps', 'erdw', 'gess', 'hest', 'inf', 'ee', 'mtec', 'mavt', 'mat', 'math', 'phys', 'usys']
KEEP = re.compile(r'people|personen|faculty|professor|dozierende|team|members|mitglieder|groups|gruppen|institut|lehrstuhl|chair', re.I)
DROP = re.compile(r'\.(pdf|jpg|png|zip|ics)$|news|events|veranstaltungen|archive|archiv|alumni|jobs|/de/', re.I)

def nav_pages(base):
    """AEM sites expose their whole navigation tree as JSON."""
    for path in ('/en/_jcr_content.navigation.json', '/_jcr_content.navigation.json', '/de/_jcr_content.navigation.json'):
        try:
            tree = json.loads(fetch(base + path, timeout=15))
        except Exception:
            continue
        out = []
        def walk(n):
            if n.get('path') and (KEEP.search(n['path']) or KEEP.search(n.get('title', ''))) and not re.search(r'news|event|alumni|job|footer', n['path'], re.I):
                out.append(base + n['path'])
            for c in n.get('children', []): walk(c)
        walk(tree)
        if out: return out
    return []

def imgs(u):
    try: h = fetch(u, timeout=12)
    except Exception: return []
    out = []
    # AEM person lists (data-json-url=...personlist.list.json) carry name + portrait endpoint
    for jurl in set(re.findall(r'data-json-url="([^"]*personlist[^"]*)"', h)):
        base = '{0.scheme}://{0.netloc}'.format(urllib.parse.urlparse(u))
        try:
            data = json.loads(fetch(urllib.parse.urljoin(u, H.unescape(jurl)), timeout=15)).get('data', [])
        except Exception:
            data = []
        for d in data:
            a = d.get('attributes', {})
            if a.get('image') and a.get('name'):
                out.append({'alt': a['name'], 'src': base + a['image'], 'page': u, 'email': a.get('email', ''), 'personlist': True})
    for tag in re.findall(r'<img[^>]+>', h, re.I):
        alt = re.search(r'\salt="([^"]*)"', tag); src = re.search(r'\ssrc="([^"]+)"', tag)
        if alt and src and re.search(r'\w+\s+\w+', alt.group(1)) and not src.group(1).endswith('.svg'):
            ss = re.search(r'\ssrcset="([^"]+)"', tag)
            best = ss.group(1).split(',')[-1].strip().split(' ')[0] if ss else src.group(1)
            out.append({'alt': H.unescape(alt.group(1)), 'src': urllib.parse.urljoin(u, H.unescape(best)), 'page': u})
    return out

def crawl(dom, limit=400):
    pages = []
    for base in (f'https://{dom}.ethz.ch', f'https://www.{dom}.ethz.ch'):
        pages = nav_pages(base)
        if pages: break
    pages = pages[:limit]
    with ThreadPoolExecutor(6) as ex:
        out = [x for r in ex.map(imgs, pages) for x in r]
    print(dom, len(pages), 'pages', len(out), 'imgs', flush=True)
    return out

if __name__ == '__main__':
    with ThreadPoolExecutor(4) as ex:
        res = [x for r in ex.map(crawl, DOMAINS) for x in r]
    json.dump(res, open(sys.argv[1], 'w'), ensure_ascii=False, indent=0)

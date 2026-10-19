"""Fetch lecturer details from the VVZ (dozent.view). No photos: the app draws comic figures.
Usage: python3 scrape_people.py courses.json people.json"""
import glob, json, os, re, sys
from vvz_common import get, text

def field(h, label):
    m = re.search(r'<td[^>]*>\s*%s\s*</td>\s*<td[^>]*>(.*?)</td>' % label, h, re.S)
    return text(m.group(1)) if m else ''

def lecturer(dozide, sem):
    h = get('dozent.view', dozide=dozide, ansicht='2', semkez=sem, lang='en')
    url = re.search(r'<td[^>]*>\s*URL\s*</td>\s*<td[^>]*>.*?href="([^"]+)"', h, re.S)
    return {'id': dozide, 'fullName': field(h, 'Name'), 'field': field(h, 'Field'),
            'department': field(h, 'Department'), 'relationship': field(h, 'Relationship'),
            'url': url.group(1) if url else ''}

def main(courses_file, out_file):
    # courses.json plus the older-term files next to it (courses_2025W.json, ...)
    files = [courses_file] + sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(courses_file)), 'courses_[0-9][0-9][0-9][0-9][WS].json')), reverse=True)
    ids = {}
    for c in (c for f in files for c in json.load(open(f))['courses']):
        for d, short in c['lecturers']:
            ids.setdefault(d, c['sem'])
    old = json.load(open(out_file)) if os.path.exists(out_file) else {}
    people = {}
    for i, (d, sem) in enumerate(ids.items()):
        people[d] = old.get(d) or lecturer(d, sem)
        if i % 25 == 0: print('details', i, len(ids), flush=True)
    # photos are not used by the app (it draws comic figures), so no image search/download
    for p in people.values():
        p.pop('image', None); p.pop('imageSource', None)
    print('lecturers:', len(people))
    json.dump(people, open(out_file, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(*sys.argv[1:3])

"""Scrape mandatory (O) bachelor courses + lecturers from the ETH VVZ.
Output: courses.json  {programs: {...}, courses: [...], lecturers: {...}}"""
import json, re, sys
from vvz_common import get, options, text, reset_session

SEMS = ['2026W', '2026S']  # autumn 2026 + spring 2026 = one full study year
SKIP = re.compile(r"science in perspective|thesis|bachelor's project|elective|wahl|minor|seminar week|sports practice|compensatory|additional|colloqui|major|specialization|fields of|conditionally", re.I)

def year_of(path, sem):
    p = path.lower()
    m = re.search(r'(\d)\.?\s*(?:st|nd|rd|th)?\s*semester', p)
    if m:
        return (int(m.group(1)) + 1) // 2
    if re.search(r'first year|1st year|basisprüfung|basis courses part 1|foundation year|first year examination', p): return 1
    if re.search(r'second year|2nd year|second and third', p): return 2
    if re.search(r'third year|3rd year', p): return 3
    if re.search(r'basic courses ii\b', p): return 2
    if re.search(r'basic courses i\b', p): return 1
    if 'core' in p: return 3
    if re.search(r'basic|basis|compulsory|grundlagen', p): return 2
    return None

def parse_rows(h, sem):
    out = []
    for tr in re.split(r'<tr[^>]*>', h):
        m = re.search(r'<b>(\d{3}-\d{4}-[0-9A-Z]{3})</b>', tr)
        if not m: continue
        tm = re.search(r'lerneinheitId=(\d+)[^>]*>([^<]+)</a>', tr)
        lect = re.findall(r'dozide=(\d+)[^>]*>([^<]+)</a>', tr)
        out.append({'code': m.group(1), 'title': text(tm.group(2)) if tm else '', 'leId': tm.group(1) if tm else None,
                    'sem': sem, 'lecturers': [(d, text(n)) for d, n in lect]})
    return out

def search(sem, did, pid, bid='', ubid=''):
    h = get('sucheLehrangebot.view', lang='en', search='on', semkez=sem, studiengangTyp='BSC', deptId=did,
            studiengangAbschnittId=pid, bereichAbschnittId=bid, unterbereichAbschnittId=ubid, wahlinfo='O', seite='0')
    return parse_rows(h, sem)

def main(sections_file, out_file):
    S = json.load(open(sections_file))
    courses = {}  # key (pid, code) -> course
    only = set(sys.argv[3:])
    for pid, prog in S['programs'].items():
        if only and pid not in only: continue
        did = prog['dept']
        for sem in SEMS:
            reset_session()
            # section/program ids differ per semester -> resolve by name
            dpre = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did, refresh='on')
            spid = next((i for i, n in options(dpre, 'studiengangAbschnittId') if n == prog['name']), None)
            if not spid: print('  missing', prog['name'], sem); continue
            pre = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did, studiengangAbschnittId=spid, refresh='on')
            for bid, bname in options(pre, 'bereichAbschnittId'):
                if SKIP.search(bname): continue
                pre2 = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did,
                           studiengangAbschnittId=spid, bereichAbschnittId=bid, refresh='on')
                subs = [(u, n) for u, n in options(pre2, 'unterbereichAbschnittId') if not SKIP.search(n)] or [('', '')]
                for ubid, uname in subs:
                    path = bname + (' > ' + uname if uname else '')
                    for c in search(sem, did, spid, bid, ubid):
                        key = (pid, c['code'])
                        y = year_of(path, sem)
                        if key in courses:
                            old = courses[key]
                            if old['year'] is None and y: old['year'] = y
                            continue
                        c.update(program=pid, dept=did, section=path, year=y)
                        courses[key] = c
            print(prog['name'], sem, sum(1 for k in courses if k[0] == pid), flush=True)
    json.dump({'programs': S['programs'], 'depts': S['depts'], 'courses': list(courses.values())},
              open(out_file, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

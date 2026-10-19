"""Scrape mandatory (O) bachelor courses + lecturers from the ETH VVZ.
Output: courses.json  {programs: {...}, courses: [...], lecturers: {...}}"""
import json, os, re, sys
from vvz_common import get, options, text, reset_session

# Terms to scrape (VVZ 'semkez'), e.g. TERMS=2025W,2025S. Default: the current study year.
SEMS = [t for t in os.environ.get('TERMS', '2026W,2026S').split(',') if t]
# Older terms only matter for early semesters (a student in semester N had semester k
# N-k terms ago), so sections clearly above KMAX are skipped to save requests.
KMAX = int(os.environ.get('KMAX', '99'))
SKIP = re.compile(r"science in perspective|thesis|bachelor's project|elective|wahl|minor|seminar week|sports practice|compensatory|additional|colloqui|major|specialization|fields of|conditionally", re.I)

EXPLICIT_YEAR = [(1, r'first year|1st year|basisprüfung|basis courses part 1|foundation year|basic courses i\b'),
                 (2, r'second year|2nd year|second and third|basic courses ii\b'),
                 (3, r'third year|3rd year')]
GUESSED_YEAR = [(3, r'core'), (2, r'basic|basis|compulsory|grundlagen')]

def semester_of(path, sem):
    """Exact study semester (1..6) of a course, from its VVZ section path and term.
    The deepest section wins; explicit 'Nth semester' beats year hints, which beat guesses."""
    hs = sem.endswith('W')
    parts = [x.strip().lower() for x in path.split('>')][::-1]
    for x in parts:
        m = re.search(r'(\d)\.?\s*(?:st|nd|rd|th)?\s*semester', x)
        if m:
            n = int(m.group(1))
            # autumn = odd semesters, spring = even ones
            if hs and n % 2 == 0: n -= 1
            if not hs and n % 2 == 1: n += 1
            return n
    for table in (EXPLICIT_YEAR, GUESSED_YEAR):
        for x in parts:
            for y, rx in table:
                if re.search(rx, x):
                    return (y - 1) * 2 + (1 if hs else 2)
    return None

def year_of(path, sem):
    s = semester_of(path, sem)
    return (s + 1) // 2 if s else None

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
    # VVZ keeps the last (sub)section in the session; without a fresh one, a section that has
    # no subsections returns the previous subsection's courses under the wrong label.
    reset_session()
    h = get('sucheLehrangebot.view', lang='en', search='on', semkez=sem, studiengangTyp='BSC', deptId=did,
            studiengangAbschnittId=pid, bereichAbschnittId=bid, unterbereichAbschnittId=ubid, wahlinfo='O', seite='0')
    return parse_rows(h, sem)

def main(sections_file, out_file):
    S = json.load(open(sections_file))
    courses = {}  # key (pid, code) -> course
    only = set(sys.argv[3:])
    # resume support: progress is saved after every programme
    partial = out_file + '.partial'
    done = set()
    if os.path.exists(partial):
        P = json.load(open(partial))
        done = set(P['done'])
        courses = {(c['program'], c['code']): c for c in P['courses']}
        print('resuming, already done:', len(done), flush=True)
    for pid, prog in S['programs'].items():
        if only and pid not in only: continue
        if pid in done: continue
        did = prog['dept']
        for sem in SEMS:
            reset_session()
            # section/program ids differ per semester -> resolve by name
            dpre = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did, refresh='on')
            spid = next((i for i, n in options(dpre, 'studiengangAbschnittId') if n == prog['name']), None)
            if not spid: print('  missing', prog['name'], sem); continue
            reset_session()
            pre = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did, studiengangAbschnittId=spid, refresh='on')
            for bid, bname in options(pre, 'bereichAbschnittId'):
                if SKIP.search(bname): continue
                if (semester_of(bname, sem) or 0) > KMAX: continue
                reset_session()  # fresh session, or VVZ shows the previous section's subsections
                pre2 = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did,
                           studiengangAbschnittId=spid, bereichAbschnittId=bid, refresh='on')
                subs = [(u, n) for u, n in options(pre2, 'unterbereichAbschnittId') if not SKIP.search(n)] or [('', '')]
                for ubid, uname in subs:
                    path = bname + (' > ' + uname if uname else '')
                    for c in search(sem, did, spid, bid, ubid):
                        key = (pid, c['code'])
                        sm = semester_of(path, sem)
                        if key in courses:
                            old = courses[key]
                            if sm and (old['semester'] is None or sm < old['semester']):
                                old.update(semester=sm, year=(sm + 1) // 2, section=path)
                            continue
                        c.update(program=pid, dept=did, section=path, semester=sm, year=(sm + 1) // 2 if sm else None)
                        courses[key] = c
            print(prog['name'], sem, sum(1 for k in courses if k[0] == pid), flush=True)
        done.add(pid)
        json.dump({'done': sorted(done), 'courses': list(courses.values())}, open(partial, 'w'), ensure_ascii=False)
    json.dump({'programs': S['programs'], 'depts': S['depts'], 'courses': list(courses.values())},
              open(out_file, 'w'), ensure_ascii=False, indent=1)
    if os.path.exists(partial): os.remove(partial)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

"""Second pass: program-level mandatory search + per-course 'Offered in' section lookup to
fill in courses hidden in deeper VVZ levels and to determine the study year.
Usage: python3 augment.py courses.json"""
import json, re, sys
from scrape_courses import search, semester_of, SEMS, SKIP
from vvz_common import get, options, text, reset_session

def offered_section(le_id, sem, prog_name):
    h = get('lerneinheit.view', lerneinheitId=le_id, semkez=sem, lang='en', ansicht='ALLE')
    i = h.find('<h3>Offered in</h3>')
    if i < 0: return None, None
    for tr in re.findall(r'<tr>(.*?)</tr>', h[i:i + 20000], re.S):
        tds = [text(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
        if len(tds) >= 3 and tds[0] == prog_name:
            return tds[1], tds[2]
    return None, None

def main(f):
    D = json.load(open(f))
    by = {(c['program'], c['code']): c for c in D['courses']}
    for pid, prog in D['programs'].items():
        did = prog['dept']
        for sem in SEMS:
            reset_session()
            dpre = get('sucheLehrangebotPre.view', lang='en', semkez=sem, studiengangTyp='BSC', deptId=did, refresh='on')
            spid = next((i for i, n in options(dpre, 'studiengangAbschnittId') if n == prog['name']), None)
            if not spid: continue
            added = 0
            for c in search(sem, did, spid):
                key = (pid, c['code'])
                cur = by.get(key)
                if cur and cur.get('semester'): continue
                sec, typ = offered_section(c['leId'], sem, prog['name'])
                if sec and SKIP.search(sec): continue
                sm = semester_of(sec or '', sem)
                if cur:
                    if sm: cur.update(semester=sm, year=(sm + 1) // 2)
                    continue
                c.update(program=pid, dept=did, section=sec or '', semester=sm, year=(sm + 1) // 2 if sm else None)
                by[key] = c; added += 1
            print(prog['name'], sem, '+', added, flush=True)
    D['courses'] = list(by.values())
    json.dump(D, open(f, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1])

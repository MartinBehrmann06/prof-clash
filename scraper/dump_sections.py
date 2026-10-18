import json, sys
from vvz_common import get, options
pre = get('sucheLehrangebotPre.view', lang='en')
depts = options(pre, 'deptId')
out = {}
for did, dname in depts:
    h = get('sucheLehrangebotPre.view', lang='en', semkez='2026W', studiengangTyp='BSC', deptId=did, refresh='on')
    for pid, pname in options(h, 'studiengangAbschnittId'):
        if not pname.endswith('Bachelor'): continue
        h2 = get('sucheLehrangebotPre.view', lang='en', semkez='2026W', studiengangTyp='BSC', deptId=did, studiengangAbschnittId=pid, refresh='on')
        out[pid] = {'dept': did, 'deptName': dname, 'name': pname, 'sections': options(h2, 'bereichAbschnittId')}
        print(dname, '|', pname, [s[1] for s in out[pid]['sections']], flush=True)
json.dump({'depts': depts, 'programs': out}, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)

#!/bin/sh
# Scrape older VVZ terms into courses_<term>.json (one file per term).
# A student now (HS 2026) in semester N took semester k in the term N-k steps back,
# so term d steps back only matters for semesters k <= 7 - d.
set -e
cd "$(dirname "$0")"
for spec in 2025W:5 2025S:4 2024W:3 2024S:2 2023W:1; do
  term=${spec%%:*}; kmax=${spec##*:}
  if [ -f "courses_$term.json" ]; then echo "skip $term (done)"; continue; fi
  echo "=== $term (semesters <= $kmax)"
  TERMS=$term KMAX=$kmax python3 scrape_courses.py sections.json "courses_$term.tmp.json"
  TERMS=$term python3 augment.py "courses_$term.tmp.json"
  mv "courses_$term.tmp.json" "courses_$term.json"
done
echo HISTORY_DONE

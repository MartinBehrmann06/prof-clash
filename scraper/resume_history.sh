#!/bin/sh
# Wait out a VVZ block, then continue the history scrape gently.
cd "$(dirname "$0")"
sleep "${PAUSE:-2700}"
until curl -s -o /dev/null -m 20 -A "Mozilla/5.0" https://www.vvz.ethz.ch/; do echo "VVZ still blocked, waiting 15 min"; sleep 900; done
VVZ_DELAY=2 ./scrape_history.sh

#!/usr/bin/env python3
"""Build data/players.json: a slim copy of Sleeper's 14 MB /v1/players/nfl with only the fields Weasel Hub uses.
Keeps fantasy-relevant positions that are on an NFL team or rostered in any of USER's leagues. Fails loudly (non-zero exit)
if Sleeper returns something implausible, so a bad run never overwrites a good file."""
import json, os, sys, time, urllib.request
USER = os.environ.get('WH_USER', 'howibrettyourmother')
API = 'https://api.sleeper.app'
def get(path):
    req = urllib.request.Request(API + path, headers={'User-Agent': 'weaselhub-slim/1.0', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)
state = get('/v1/state/nfl'); season = state.get('league_season') or state.get('season')
user = get('/v1/user/' + USER)
rostered = set()
for lg in get('/v1/user/%s/leagues/nfl/%s' % (user['user_id'], season)) or []:
    for r in get('/v1/league/%s/rosters' % lg['league_id']) or []:
        rostered.update(r.get('players') or [])
allp = get('/v1/players/nfl')
if not isinstance(allp, dict) or len(allp) < 5000:
    sys.exit('players file looks wrong: %r entries' % (len(allp) if hasattr(allp, '__len__') else allp))
want = {'QB', 'RB', 'WR', 'TE', 'K', 'DEF'}; out = {}
for pid, p in allp.items():
    fp = [x for x in (p.get('fantasy_positions') or [p.get('position')]) if x]
    if not any(x in want for x in fp): continue
    if not p.get('team') and pid not in rostered: continue
    name = (p.get('first_name', '') + ' ' + p.get('last_name', '')) if p.get('position') == 'DEF' else (p.get('full_name') or ((p.get('first_name') or '') + ' ' + (p.get('last_name') or '')).strip())
    out[pid] = {'n': name, 'p': fp, 't': p.get('team'), 'i': p.get('injury_status'), 's': p.get('status'), 'b': p.get('injury_body_part'),
                'pr': p.get('practice_participation'), 'e': p.get('espn_id'), 'a': p.get('age'), 'y': p.get('years_exp')}
if len(out) < 600: sys.exit('only %d players after filtering; refusing to write' % len(out))
os.makedirs('data', exist_ok=True)
with open('data/players.json', 'w') as f:
    json.dump({'at': int(time.time() * 1000), 'season': season, 'n': len(out), 'p': out}, f, separators=(',', ':'))
print('wrote %d players, %d rostered ids' % (len(out), len(rostered)))

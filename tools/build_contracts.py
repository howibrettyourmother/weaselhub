#!/usr/bin/env python3
"""Build data/contracts.json: real NFL contract status for every player rostered in USER's Sleeper leagues.
Source: nflverse-data release 'contracts' (historical_contracts.parquet, derived from OverTheCap.com; nflverse refreshes it daily).
Matching: Sleeper players.json gsis_id -> nflverse gsis_id (exact); fallback = normalized name + position (+ team when ambiguous).
No match -> the player is simply absent (the hub shows 'unknown'; never guessed).
Derived fields (per player, current active contract):
  end   : last season under contract = last season_history year with cash paid > 0 (void years / placeholder salaries ignored)
  fa    : end + 1 (offseason he next hits free agency)
  kind  : UFA / RFA / ERFA by accrued seasons at contract end (approx: seasons since entering the league; 4+ UFA, 3 RFA, <3 ERFA)
  rk    : 1 if still on his rookie deal; opt: 5th-year option status for 1st-rounders ('exercised' / 'declined' / 'pending')
  apy, gtd (in $M), typ (Drafted/Extension/...), signed, team.
Fails loudly (non-zero exit) on implausible inputs so a bad run never overwrites a good file."""
import json, os, re, sys, time, urllib.request, io
import pyarrow.parquet as pq
USER = os.environ.get('WH_USER', 'howibrettyourmother')
API = 'https://api.sleeper.app'
REL = 'https://github.com/nflverse/nflverse-data/releases/download/contracts/'
def fetch(url, timeout=180):
    req = urllib.request.Request(url, headers={'User-Agent': 'weaselhub-contracts/1.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
def get(path): return json.loads(fetch(API + path))
def norm(n): return re.sub(r'(jr|sr|ii|iii|iv|v)$', '', re.sub(r'[^a-z]', '', (n or '').lower()))
state = get('/v1/state/nfl'); season = int(state.get('league_season') or state.get('season'))
user = get('/v1/user/' + USER)
rost = set()
for lg in get('/v1/user/%s/leagues/nfl/%s' % (user['user_id'], season)) or []:
    for r in get('/v1/league/%s/rosters' % lg['league_id']) or []: rost.update(p for p in (r.get('players') or []) if p.isdigit())
allp = json.loads(fetch(API + '/v1/players/nfl'))
if len(allp) < 5000: sys.exit('sleeper players file looks wrong')
ts = json.loads(fetch(REL + 'timestamp.json')).get('last_updated')
tb = pq.read_table(io.BytesIO(fetch(REL + 'historical_contracts.parquet'))).to_pylist()
if len(tb) < 20000: sys.exit('contracts table looks wrong: %d rows' % len(tb))
act = [r for r in tb if r.get('is_active')]
if len(act) < 1500: sys.exit('only %d active contracts; refusing' % len(act))
byG, byN = {}, {}
for r in act:
    if r.get('gsis_id'): byG.setdefault(r['gsis_id'], []).append(r)
    byN.setdefault((norm(r['player']), r.get('position')), []).append(r)
POSMAP = {'QB': 'QB', 'RB': 'RB', 'FB': 'RB', 'WR': 'WR', 'TE': 'TE', 'K': 'K', 'P': 'P'}
TEAMS = {}  # sleeper abbrev -> OTC team nickname piece, for name-match disambiguation
for k, v in {'ARI':'Cardinals','ATL':'Falcons','BAL':'Ravens','BUF':'Bills','CAR':'Panthers','CHI':'Bears','CIN':'Bengals','CLE':'Browns','DAL':'Cowboys','DEN':'Broncos','DET':'Lions','GB':'Packers','HOU':'Texans','IND':'Colts','JAX':'Jaguars','KC':'Chiefs','LV':'Raiders','LAC':'Chargers','LAR':'Rams','MIA':'Dolphins','MIN':'Vikings','NE':'Patriots','NO':'Saints','NYG':'Giants','NYJ':'Jets','PHI':'Eagles','PIT':'Steelers','SF':'49ers','SEA':'Seahawks','TB':'Buccaneers','TEN':'Titans','WAS':'Commanders'}.items(): TEAMS[k] = v
def pick(rows):  # most recent active deal
    return sorted(rows, key=lambda r: (r.get('year_signed') or 0, r.get('apy') or 0))[-1]
def derive(r, sp):
    yrs = []
    for s in r.get('season_history') or []:
        y = s.get('year')
        if y and str(y).isdigit() and (s.get('cash_paid') or 0) > 0: yrs.append(int(y))  # void years carry no cash
    ys, n = r.get('year_signed') or 0, r.get('years') or 0
    typ = None; ch = [c for c in (r.get('contract_history') or []) if c.get('status') == 'Active']
    if ch: typ = ch[-1].get('contract_type')
    est = (ys + n) if typ == 'Extension' else (ys + n - 1)
    end = max(yrs) if yrs else (est if ys else None)
    if end is None: return None
    rookie = typ == 'Drafted' or (typ is None and r.get('draft_year') == ys)
    dy = r.get('draft_year') or sp.get('rookie_year') or (season - (sp.get('years_exp') or 0))
    try: dy = int(dy)
    except Exception: dy = season - int(sp.get('years_exp') or 0)
    acc = end - dy + 1
    kind = 'UFA' if acc >= 4 else 'RFA' if acc == 3 else 'ERFA'
    o = {'end': end, 'fa': end + 1, 'kind': kind, 'apy': round(r.get('apy') or 0, 2), 'gtd': round(r.get('guaranteed') or 0, 2), 'typ': typ, 'signed': ys, 'team': r.get('team'), 'otc': r.get('otc_id'), 'dy': dy}
    if rookie:
        o['rk'] = 1
        if r.get('draft_round') == 1 and dy >= 2011:
            o5 = dy + 4
            o['opt'] = 'exercised' if o5 in yrs else ('declined' if season > dy + 3 or (season == dy + 3 and time.gmtime().tm_mon >= 6) else 'pending')
    if end < season: return None  # stale row (contract already over) -> treat as unknown
    return o
out, how = {}, {'gsis': 0, 'name': 0}
for pid in sorted(rost):
    sp = allp.get(pid) or {}
    pos = sp.get('position')
    if not pos or pos == 'DEF': continue
    r = None; g = sp.get('gsis_id')
    if g and g.strip() in byG: r = pick(byG[g.strip()]); how['gsis'] += 1
    else:
        c = byN.get((norm(sp.get('full_name') or ''), POSMAP.get(pos, pos))) or []
        if len(c) > 1 and sp.get('team'): c = [x for x in c if TEAMS.get(sp['team'], '~') in (x.get('team') or '')] or c
        if len({x.get('otc_id') for x in c}) == 1: r = pick(c); how['name'] += 1
    if not r:  # name + position didn't resolve: unique name across positions (two-way guys like Travis Hunter)
        c = [x for k, v in byN.items() if k[0] == norm(sp.get('full_name') or '') for x in v]
        if len({x.get('otc_id') for x in c}) == 1: r = pick(c); how['name_any_pos'] = how.get('name_any_pos', 0) + 1
    if not r and sp.get('team') and sp.get('last_name'):  # nickname: same last name + team + position, first names share a 3-letter prefix (Nick/Nicholas, Matt/Matthew)
        fn, ln, tn = norm(sp.get('first_name')), norm(sp.get('last_name')), TEAMS.get(sp['team'], '~')
        c = [x for x in act if norm(x['player'].split(' ', 1)[-1]) == ln and tn in (x.get('team') or '') and x.get('position') == POSMAP.get(pos, pos)
             and (lambda f: f[:3] == fn[:3] and (f.startswith(fn) or fn.startswith(f) or len(fn) >= 3))(norm(x['player'].split(' ', 1)[0]))]
        if len({x.get('otc_id') for x in c}) == 1: r = pick(c); how['nickname'] = how.get('nickname', 0) + 1
    if not r:
        if not sp.get('team') and pos in ('QB', 'RB', 'WR', 'TE'):  # no NFL team and no active deal: he's a free agent right now
            g = sp.get('gsis_id'); old = [x for x in tb if (g and x.get('gsis_id') == g.strip()) or norm(x['player']) == norm(sp.get('full_name') or '')]
            if old: out[pid] = {'now': 1, 'end': max((x.get('year_signed') or 0) + (x.get('years') or 1) - 1 for x in old), 'fa': season, 'kind': 'UFA', 'team': None}
        continue
    d = derive(r, sp)
    if d: out[pid] = d
skill = [p for p in rost if (allp.get(p) or {}).get('position') in ('QB', 'RB', 'WR', 'TE') and (allp.get(p) or {}).get('team')]
rate = sum(1 for p in skill if p in out) / max(1, len(skill))
if rate < 0.6: sys.exit('match rate %.0f%% too low; refusing to write' % (rate * 100))
os.makedirs('data', exist_ok=True)
json.dump({'at': int(time.time() * 1000), 'season': season, 'src': 'nflverse contracts (OverTheCap)', 'src_at': ts, 'n': len(out), 'rostered': len(rost),
           'match_skill_on_team': round(rate, 3), 'how': how, 'c': out}, open('data/contracts.json', 'w'), separators=(',', ':'))
print('wrote %d contracts; rostered %d; skill-on-team match %.1f%%; %r; src %s' % (len(out), len(rost), rate * 100, how, ts))

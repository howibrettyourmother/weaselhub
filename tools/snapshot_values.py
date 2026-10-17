#!/usr/bin/env python3
"""Daily trade-value snapshot for Weasel Hub: data/values_history.json.
For each of USER's Sleeper leagues this season: total FantasyCalc dynasty value of USER's roster (players + owned future picks),
using the FantasyCalc format that matches the league (QBs/superflex, team count, PPR), the same way the site does.
Per-player values for USER's rostered players are kept so the site can show risers/fallers. One entry per ET date (re-runs overwrite today)."""
import json, os, sys, time, datetime, urllib.request
USER = os.environ.get('WH_USER', 'howibrettyourmother'); API = 'https://api.sleeper.app'; OUT = 'data/values_history.json'; KEEP = 400
ORD = ['', '1st', '2nd', '3rd', '4th', '5th']
def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'weaselhub-values/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
def fmt(lg, n):
    rp = lg.get('roster_positions') or []; q = 2 if (rp.count('QB') >= 2 or 'SUPER_FLEX' in rp) else 1
    rec = (lg.get('scoring_settings') or {}).get('rec') or 0; ppr = 1 if rec >= 1 else 0.5 if rec >= 0.5 else 0
    return q, n, ppr
state = get(API + '/v1/state/nfl'); season = state.get('league_season') or state.get('season')
user = get(API + '/v1/user/' + USER); uid = user['user_id']
fc = {}
def values(q, n, ppr):
    k = '%s:%s:%s' % (q, n, ppr)
    if k not in fc:
        d = get('https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=%s&numTeams=%s&ppr=%s' % (q, n, ppr))
        if not isinstance(d, list) or len(d) < 200: sys.exit('FantasyCalc looks wrong for ' + k)
        p, pk = {}, {}
        for x in d:
            pl = x.get('player') or {}
            if pl.get('position') == 'PICK': pk[pl.get('name')] = x.get('value') or 0
            elif pl.get('sleeperId'): p[str(pl['sleeperId'])] = x.get('value') or 0
        fc[k] = (k, p, pk)
    return fc[k]
def pickval(pk, s, r):
    return pk.get('%s %s' % (s, ORD[r])) or pk.get('%s %s (Mid)' % (s, ORD[r])) or (pk.get('%s %s' % (s - 1, ORD[r])) or 0) * 0.9
today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-4))).date().isoformat()  # ET date (EDT; close enough for a daily key)
snap = {'d': today, 'at': int(time.time() * 1000), 'lg': {}, 'v': {}}
for lg in get(API + '/v1/user/%s/leagues/nfl/%s' % (uid, season)) or []:
    if (lg.get('settings') or {}).get('best_ball'): continue
    lid = lg['league_id']; rosters = get(API + '/v1/league/%s/rosters' % lid); n = len(rosters)
    mine = [r for r in rosters if r.get('owner_id') == uid or uid in (r.get('co_owners') or [])]
    if not mine: continue
    me = mine[0]; k, P, PK = values(*fmt(lg, n)); tp = get(API + '/v1/league/%s/traded_picks' % lid) or []
    pv = sum(P.get(str(p), 0) for p in me.get('players') or [])
    rounds = int((lg.get('settings') or {}).get('draft_rounds') or 4); kv = 0; y0 = int(lg['season'])
    for s in range(y0 + 1, y0 + 4):
        for r in range(1, rounds + 1):
            for ro in rosters:
                owner = ro['roster_id']
                for t in tp:
                    if int(t['season']) == s and int(t['round']) == r and t['roster_id'] == ro['roster_id']: owner = t['owner_id']
                if owner == me['roster_id']: kv += pickval(PK, s, r)
    snap['lg'][lid] = {'n': lg['name'].strip(), 'f': k, 'pv': round(pv), 'kv': round(kv), 'tot': round(pv + kv), 'pl': [str(p) for p in me.get('players') or []]}
    vv = snap['v'].setdefault(k, {})
    for p in me.get('players') or []: vv[str(p)] = P.get(str(p), 0)
if not snap['lg']: sys.exit('no leagues found; refusing to write')
try: hist = json.load(open(OUT))
except Exception: hist = {'user': USER, 'days': []}
hist['days'] = [d for d in hist.get('days', []) if d.get('d') != today] + [snap]
hist['days'] = sorted(hist['days'], key=lambda d: d['d'])[-KEEP:]; hist['updated'] = snap['at']
os.makedirs('data', exist_ok=True)
with open(OUT, 'w') as f: json.dump(hist, f, separators=(',', ':'))
print('snapshot', today, {v['n']: v['tot'] for v in snap['lg'].values()})

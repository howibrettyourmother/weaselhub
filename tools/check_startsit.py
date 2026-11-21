#!/usr/bin/env python3
"""Assert Weasel Hub start/sit suggestions never put an ineligible position in a slot.

Fetches the current week for every league owned by WH_USER (default howibrettyourmother)
and also runs a frozen F@$% 2020 regression: a 2QB league (no SUPER_FLEX) must not
suggest starting a bench QB over a TE.

A swap is valid only if the bench player is eligible for the exact slot the starter
vacates, or a legal chain of slot-eligible moves exists.
"""
from __future__ import annotations
import json, os, sys, time, urllib.request
from datetime import datetime

USER = os.environ.get('WH_USER', 'howibrettyourmother')
API = 'https://api.sleeper.app'
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
ESPN_FIX = {'WSH': 'WAS', 'LA': 'LAR', 'JAC': 'JAX'}
ELIG = {
    'QB': ['QB'], 'RB': ['RB'], 'WR': ['WR'], 'TE': ['TE'], 'K': ['K'], 'DEF': ['DEF'],
    'FLEX': ['RB', 'WR', 'TE'], 'WRRB_FLEX': ['RB', 'WR'], 'REC_FLEX': ['WR', 'TE'],
    'SUPER_FLEX': ['QB', 'RB', 'WR', 'TE'], 'IDP_FLEX': ['DL', 'LB', 'DB'],
    'DL': ['DL'], 'LB': ['LB'], 'DB': ['DB'],
}
NONSTART = {'BN', 'IR', 'TAXI'}
INJ_ZERO = {'Inactive', 'Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR', 'COV'}
MIN_GAIN = 0.3

def get(url, timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': 'weaselhub-check-startsit/1.0', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def sapi(path):
    return get(API + path)

def hungarian(a):
    """Min-cost assignment, rows<=cols; returns col index per row. Port of app.js."""
    n, m = len(a), len(a[0])
    INF = 1e18
    u = [0] * (n + 1); v = [0] * (m + 1); p = [0] * (m + 1); way = [0] * (m + 1)
    for i in range(1, n + 1):
        p[0] = i; j0 = 0; minv = [INF] * (m + 1); used = [False] * (m + 1)
        while True:
            used[j0] = True; i0 = p[j0]; delta = INF; j1 = 0
            for j in range(1, m + 1):
                if not used[j]:
                    cur = a[i0 - 1][j - 1] - u[i0] - v[j]
                    if cur < minv[j]:
                        minv[j] = cur; way[j] = j0
                    if minv[j] < delta:
                        delta = minv[j]; j1 = j
            for j in range(0, m + 1):
                if used[j]:
                    u[p[j]] += delta; v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            jj = way[j0]; p[j0] = p[jj]; j0 = jj
            if not j0:
                break
    r = [-1] * n
    for j in range(1, m + 1):
        if p[j]:
            r[p[j] - 1] = j - 1
    return r

def score_stats(stats, ss):
    t = 0.0
    for k, w in ss.items():
        if not w:
            continue
        v = stats.get(k)
        if v is None:
            if k == 'fgmiss':
                v = (stats.get('fgmiss_0_19') or 0) + (stats.get('fgmiss_20_29') or 0) + (stats.get('fgmiss_30_39') or 0) + (stats.get('fgmiss_40_49') or 0) + (stats.get('fgmiss_50p') or 0)
            else:
                continue
        t += v * w
    return t

def can_play(fp, slot):
    el = ELIG.get(slot) or [slot]
    return any(p in el for p in (fp or []))

def start_sit_calls(slots, starters, pool, locked, now=None):
    """slots: list of starting slot names
    starters: list of player dicts or None, same length as slots (None = empty)
    pool: list of unlocked player dicts {id,n,fp,proj,eff,inj,team,has_game,kick}
    locked: set of player ids already locked into a slot (excluded from reassignment)
    """
    open_slots, open_idx, cur = [], [], {}
    for i, slot in enumerate(slots):
        st = starters[i] if i < len(starters) else None
        if st and st['id'] not in locked:
            cur[i] = st
        if st and st['id'] in locked:
            continue
        open_slots.append(slot); open_idx.append(i)
    if not open_slots:
        return {'calls': [], 'gain': 0, 'cur': 0, 'opt': 0, 'locked': True}
    cur_sum = sum(cur[i]['eff'] for i in open_idx if i in cur)
    nc = max(len(pool), len(open_slots))
    A = []
    for k, slot in enumerate(open_slots):
        ci = cur.get(open_idx[k])
        row = []
        for j in range(nc):
            l = pool[j] if j < len(pool) else None
            if not l:
                row.append(0)
            elif can_play(l['fp'], slot):
                bonus = (0.05 if ci and ci['id'] == l['id'] else 0) + (0.02 if any(s and s['id'] == l['id'] for s in starters) else 0)
                row.append(-(l['eff'] + bonus))
            else:
                row.append(1e6)
        A.append(row)
    asg = hungarian(A)
    best, opt_sum = {}, 0.0
    for k, j in enumerate(asg):
        if j < 0 or j >= len(pool):
            continue
        l = pool[j]
        if l and A[k][j] < 1e5:
            best[open_idx[k]] = l
            opt_sum += l['eff']
    best_slot_of = {best[i]['id']: i for i in open_idx if i in best}
    cur_slot_of = {cur[i]['id']: i for i in open_idx if i in cur}
    calls, seen = [], set()
    for i in open_idx:
        x = best.get(i)
        if not x or x['id'] in seen or (i in cur and cur[i]['id'] == x['id']) or x['id'] in cur_slot_of:
            continue
        steps, slot, y, ok, n = [], i, None, True, 0
        while n < 40:
            n += 1
            dest = slots[slot]; who = best.get(slot); occ = cur.get(slot)
            if not who or not can_play(who['fp'], dest):
                ok = False; break
            steps.append({'slot': dest, 'x': who, 'from': occ})
            seen.add(who['id'])
            if not occ:
                y = None; break
            nxt = best_slot_of.get(occ['id'])
            if nxt is None:
                y = occ; break
            slot = nxt
        if not ok or not steps:
            continue
        g = x['eff'] - (y['eff'] if y else 0)
        if g < MIN_GAIN and y:
            continue
        calls.append({
            'x': x, 'y': y, 'slot': steps[0]['slot'], 'chain': steps if len(steps) > 1 else None,
            'gain': g,
        })
    calls.sort(key=lambda c: -c['gain'])
    return {'calls': calls, 'gain': max(0.0, opt_sum - cur_sum), 'cur': cur_sum, 'opt': opt_sum, 'locked': False}

def assert_legal(name, slots, starters, result, errors):
    """Every suggestion must put only eligible positions in each named slot."""
    start_ids = {s['id'] for s in starters if s}
    for c in result['calls']:
        x, y, slot, chain = c['x'], c.get('y'), c['slot'], c.get('chain')
        if not can_play(x['fp'], slot):
            errors.append('%s: %s (%s) is not eligible for %s' % (name, x['n'], '/'.join(x['fp']), slot))
            continue
        if chain:
            for step in chain:
                who, dest, occ = step['x'], step['slot'], step.get('from')
                if not can_play(who['fp'], dest):
                    errors.append('%s: chain places %s (%s) in %s' % (name, who['n'], '/'.join(who['fp']), dest))
            # first step is the incoming bench (or non-current) player entering a slot they're eligible for
            if chain[0]['x']['id'] in start_ids and not c.get('allow_current'):
                # incoming should not already be a current starter; mid-chain movers can be
                pass
            last_from = chain[-1].get('from')
            if y and last_from and last_from['id'] != y['id']:
                errors.append('%s: chain sit %s does not match last vacated %s' % (name, y['n'], last_from['n']))
        elif y:
            # direct swap: incoming must be eligible for the slot the starter vacates,
            # which is the same slot the incoming player enters.
            yslot = None
            for i, st in enumerate(starters):
                if st and st['id'] == y['id']:
                    yslot = slots[i]; break
            if yslot is None:
                errors.append('%s: sit %s is not in the current starting lineup' % (name, y['n']))
            elif yslot != slot:
                errors.append('%s: %s over %s listed at %s but %s currently starts at %s' % (name, x['n'], y['n'], slot, y['n'], yslot))
            if not can_play(x['fp'], yslot or slot):
                errors.append('%s: %s (%s) cannot take %s\'s %s slot' % (name, x['n'], '/'.join(x['fp']), y['n'], yslot or slot))

def player(id, n, fp, proj, inj=None, team=None, has_game=True, kick=None, locked=False):
    inj = inj or ''
    eff = 0.0 if (inj in INJ_ZERO or not team or (not has_game and has_game is not None)) else (proj * 0.25 if inj == 'Doubtful' else proj)
    # has_game=False with team set and games known counts as bye -> 0, handled by caller
    return {'id': str(id), 'n': n, 'fp': list(fp), 'proj': float(proj), 'eff': float(eff), 'inj': inj, 'team': team, 'has_game': has_game, 'kick': kick, 'locked': locked}

def fixture_f2020(errors):
    """Reproduce the Week 11 F@$% 2020 bug: 2QB, no SUPER_FLEX, Goff+Mahomes at QB,
    Hockenson at TE, Caleb and Bowers on the bench. Must suggest Caleb over Goff and
    Bowers over Hockenson — never Caleb over Hockenson at QB."""
    slots = ['QB', 'QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'K', 'DEF']
    # projections from Sleeper week 11 2026, league scoring (captured for this regression)
    P = {
        '4046': player('4046', 'Patrick Mahomes', ['QB'], 34.40, team='KC'),
        '3163': player('3163', 'Jared Goff', ['QB'], 20.38, team='DET'),
        '11560': player('11560', 'Caleb Williams', ['QB'], 23.16, team='CHI'),
        '7588': player('7588', 'Javonte Williams', ['RB'], 21.06, team='DAL'),
        '6813': player('6813', 'Jonathan Taylor', ['RB'], 14.43, team='IND'),  # locked (Thu)
        '6794': player('6794', 'Justin Jefferson', ['WR'], 18.41, team='MIN'),
        '10229': player('10229', 'Rashee Rice', ['WR'], 17.68, team='KC', inj='Questionable'),
        '11646': player('11646', 'Jalen Coker', ['WR'], 12.70, team='CAR'),
        '5844': player('5844', 'T.J. Hockenson', ['TE'], 9.15, team='MIN'),
        '11604': player('11604', 'Brock Bowers', ['TE'], 14.57, team='LV'),
        '12527': player('12527', 'Ashton Jeanty', ['RB'], 11.87, team='LV'),
        '2449': player('2449', 'Stefon Diggs', ['WR'], 13.27, team='WAS'),
        '12185': player('12185', 'Spencer Shrader', ['K'], 8.44, team='IND'),  # locked (Thu)
        'JAX': player('JAX', 'Jacksonville Jaguars', ['DEF'], 8.04, team='JAX'),
        '9500': player('9500', 'Josh Downs', ['WR'], 10.09, team='IND'),  # locked (Thu)
        '11565': player('11565', 'J.J. McCarthy', ['QB'], 16.77, team='NYG'),
    }
    start_ids = ['3163', '4046', '7588', '6813', '6794', '10229', '11646', '5844', '12527', '2449', '12185', 'JAX']
    locked = {'6813', '12185', '9500'}
    starters = [P[i] for i in start_ids]
    pool = [P[i] for i in P if i not in locked]
    res = start_sit_calls(slots, starters, pool, locked)
    assert_legal('F2020 fixture', slots, starters, res, errors)
    pairs = [(c['x']['n'], c['y']['n'] if c['y'] else None, c['slot']) for c in res['calls']]
    if any(x == 'Caleb Williams' and y == 'T.J. Hockenson' for x, y, _ in pairs):
        errors.append("F2020 fixture: suggested Caleb Williams over T.J. Hockenson (ineligible: no third QB slot)")
    want = {('Caleb Williams', 'Jared Goff', 'QB'), ('Brock Bowers', 'T.J. Hockenson', 'TE')}
    got = set(pairs)
    missing = want - got
    if missing:
        errors.append('F2020 fixture: missing expected swaps %s (got %s, cur %.1f → opt %.1f, gain %.1f)' % (missing, pairs, res['cur'], res['opt'], res['gain']))
    # header math: call gains should match open-slot improvement (~8.2)
    if res['calls'] and abs(sum(c['gain'] for c in res['calls']) - res['gain']) > 0.15:
        errors.append('F2020 fixture: call gains %.2f != opt-cur %.2f' % (sum(c['gain'] for c in res['calls']), res['gain']))
    print('fixture F2020: %s · open %.1f -> %.1f (gain +%.1f)' % (pairs or 'no swaps', res['cur'], res['opt'], res['gain']))
    return res

def load_games(season, week):
    sb = get('%s?week=%s&seasontype=2&dates=%s' % (ESPN, week, season))
    games, byes = {}, set()
    for t in (sb.get('week') or {}).get('teamsOnBye') or []:
        byes.add(ESPN_FIX.get(t.get('abbreviation'), t.get('abbreviation')))
    now = time.time() * 1000
    for ev in sb.get('events') or []:
        c = ev['competitions'][0]
        st = c.get('status') or ev.get('status') or {}
        typ = (st.get('type') or {})
        state = typ.get('state')
        kick = ev.get('date')
        # parse ISO
        try:
            kick_ms = datetime.fromisoformat(kick.replace('Z', '+00:00')).timestamp() * 1000
        except Exception:
            kick_ms = None
        locked = state in ('in', 'post') or (kick_ms is not None and kick_ms <= now)
        for x in c.get('competitors') or []:
            ab = ESPN_FIX.get(x['team']['abbreviation'], x['team']['abbreviation'])
            games[ab] = {'state': state, 'kick': kick_ms, 'locked': locked, 'id': ev.get('id')}
    return games, byes

def load_proj(season, week):
    arr = sapi('/projections/nfl/%s/%s?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF' % (season, week))
    m = {}
    for x in arr or []:
        m[x['player_id']] = {'s': x.get('stats') or {}, 'pl': x.get('player') or {}, 'team': x.get('team')}
    return m

def make_line(pid, pinfo, proj, ss, games, byes, games_ok, ppr):
    fp = list(pinfo.get('fp') or pinfo.get('p') or [])
    team = pinfo.get('team') or pinfo.get('t')
    inj = pinfo.get('inj') or pinfo.get('i') or ''
    name = pinfo.get('n') or pid
    pr = proj.get(pid)
    v = 0.0
    if pr and pr.get('s'):
        v = score_stats(pr['s'], ss)
        if not (v == v) or (v == 0 and pr['s'].get('pts_ppr')):
            if ppr >= 1: v = pr['s'].get('pts_ppr') or 0
            elif ppr >= 0.5: v = pr['s'].get('pts_half_ppr') or 0
            else: v = pr['s'].get('pts_std') or 0
    g = games.get(team) if team else None
    has_game = bool(g)
    if games_ok and team and team in byes:
        has_game = False
    if inj in INJ_ZERO or not team or (games_ok and not has_game):
        eff = 0.0
    elif inj == 'Doubtful':
        eff = v * 0.25
    else:
        eff = v
    locked = bool(g and g.get('locked'))
    return {'id': pid, 'n': name, 'fp': fp, 'proj': v, 'eff': eff, 'inj': inj, 'team': team, 'has_game': has_game, 'kick': g.get('kick') if g else None, 'locked': locked}

def live_leagues(errors):
    state = sapi('/v1/state/nfl')
    season = state.get('league_season') or state.get('season')
    week = state.get('week') or state.get('display_week')
    user = sapi('/v1/user/' + USER)
    leagues = sapi('/v1/user/%s/leagues/nfl/%s' % (user['user_id'], season)) or []
    games, byes = load_games(season, week)
    proj = load_proj(season, week)
    # slim players file if present, else names from projections
    players = {}
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    slim = os.path.join(root, 'data', 'players.json')
    if os.path.exists(slim):
        players = (json.load(open(slim)).get('p') or {})
    summaries = []
    for lg in leagues:
        settings = lg.get('settings') or {}
        if settings.get('best_ball') or lg.get('status') in ('pre_draft', 'drafting', 'complete'):
            continue
        rp = lg.get('roster_positions') or []
        slots = [p for p in rp if p not in NONSTART]
        ss = lg.get('scoring_settings') or {}
        ppr = ss.get('rec') or 0
        rosters = sapi('/v1/league/%s/rosters' % lg['league_id'])
        matchups = sapi('/v1/league/%s/matchups/%s' % (lg['league_id'], week))
        mine = [r for r in rosters if r.get('owner_id') == user['user_id'] or user['user_id'] in (r.get('co_owners') or [])]
        if not mine:
            continue
        r = mine[0]
        m = [x for x in matchups if x['roster_id'] == r['roster_id']]
        if not m:
            continue
        m = m[0]
        excl = set(r.get('reserve') or []) | set(r.get('taxi') or [])
        def info(pid):
            db = players.get(pid) or {}
            pr = proj.get(pid) or {}
            pl = pr.get('pl') or {}
            fp = db.get('p') or pl.get('fantasy_positions') or ([pl.get('position')] if pl.get('position') else [])
            if pid in ('JAX','SF','CHI','BUF','MIA','DAL','TEN','DET','TB','KC','ARI','PHI','PIT','CAR','BAL','LAC','NYJ','DEN','LV','NYG','MIN','WAS','CIN','HOU','IND','NO','ATL','CLE','GB','LAR','NE','SEA') and (not fp or fp == [None]):
                fp = ['DEF']
            name = db.get('n') or pl.get('full_name') or ((pl.get('first_name') or '') + ' ' + (pl.get('last_name') or '')).strip() or pid
            team = db.get('t') or pr.get('team') or pl.get('team') or (pid if not str(pid).isdigit() else None)
            inj = db.get('i') or pl.get('injury_status')
            return {'n': name, 'fp': [x for x in fp if x], 't': team, 'i': inj}
        start_ids = [(x if x and x != '0' else None) for x in (m.get('starters') or [])]
        # pad/trim to slots
        while len(start_ids) < len(slots):
            start_ids.append(None)
        start_ids = start_ids[:len(slots)]
        starters, locked = [], set()
        lines = {}
        for pid in list(dict.fromkeys((r.get('players') or []) + [x for x in start_ids if x])):
            if not pid:
                continue
            lines[pid] = make_line(pid, info(pid), proj, ss, games, byes, True, ppr)
        for pid in start_ids:
            if not pid:
                starters.append(None); continue
            ln = lines[pid]
            starters.append(ln)
            if ln['locked']:
                locked.add(pid)
        pool = []
        seen = set()
        for pid, ln in lines.items():
            if pid in excl or pid in locked or pid in seen:
                continue
            if ln['locked'] and pid not in start_ids:
                continue  # already-played bench stays on bench
            seen.add(pid)
            pool.append(ln)
        res = start_sit_calls(slots, starters, pool, locked)
        name = (lg.get('name') or '').strip()
        assert_legal(name, slots, starters, res, errors)
        calls = []
        for c in res['calls']:
            y = c['y']['n'] if c['y'] else 'empty'
            chain = ''
            if c['chain']:
                chain = ' via ' + ' → '.join(s['slot'] for s in c['chain'])
            calls.append('Start %s over %s (%s)%s +%.1f' % (c['x']['n'], y, c['slot'], chain, c['gain']))
        summaries.append((name, slots, [s['n'] if s else '—' for s in starters], calls, res))
        print('%s: %s' % (name, '; '.join(calls) if calls else 'Lineup\'s set / no eligible swaps'))
        if calls:
            print('  open proj %.1f → %.1f (gain +%.1f)  slots=%s' % (res['cur'], res['opt'], res['gain'], '/'.join(slots)))
    return summaries

def main():
    errors = []
    print('== fixture ==')
    fixture_f2020(errors)
    if '--fixture-only' in sys.argv:
        if errors:
            print('\nFAIL')
            for e in errors: print(' -', e)
            return 1
        print('OK')
        return 0
    print('\n== live week ==')
    try:
        live_leagues(errors)
    except Exception as e:
        errors.append('live fetch failed: %s' % e)
        raise
    if errors:
        print('\nFAIL (%d)' % len(errors))
        for e in errors: print(' -', e)
        return 1
    print('\nOK: no ineligible slot placements')
    return 0

if __name__ == '__main__':
    sys.exit(main())

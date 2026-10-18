#!/usr/bin/env python3
"""Brett's injury alerts across all his Sleeper leagues (Weasel Hub logic, runnable anywhere, no deps).

  python3 /workspace/weasel_injury_alerts.py            # prints JSON, remembers statuses in the state file
  python3 /workspace/weasel_injury_alerts.py --peek     # same, but doesn't update the state file
  python3 /workspace/weasel_injury_alerts.py --reset    # forget remembered statuses (next run treats every current Q/D/Out as new)

Output JSON (also written to /workspace/weasel_alerts_latest.json):
  changes[]  : STARTERS whose status CHANGED INTO Out/Doubtful/Questionable/Inactive/IR/PUP/Sus/bye since the last run  <- ping on these
  cleared[]  : starters who were flagged last run and are now healthy (e.g. Q -> active)
  current[]  : every currently flagged starter (all leagues), with locked=true once his game has kicked off
  each item  : league, league_id, player, player_id, pos, team, slot, status, prev, body, kickoff_et, locked, source, swap (best healthy bench option whose game hasn't kicked off: player, proj, team, game, kickoff_et, kicks_before_starter, note)

Status precedence (same as the hub): Sleeper's live projections feed (injury_status, cache-busted) > Sleeper players file
(hub's slim copy if < 75 min old, else Sleeper's full file); IR/PUP/Sus/Inactive from the players file are never cleared;
ESPN game-day injuries/inactives (games within 2.5 h of kickoff) can only ADD an Out.
"""
import json, os, sys, time, re, datetime, urllib.request
USER = os.environ.get('WH_USER', 'howibrettyourmother')
STATE = os.environ.get('WH_ALERT_STATE', '/workspace/weasel_alerts_state.json')
LATEST = '/workspace/weasel_alerts_latest.json'
S = 'https://api.sleeper.app'
SLIM = 'https://howibrettyourmother.github.io/weaselhub/data/players.json'
ALERT = {'Out', 'Doubtful', 'Questionable', 'Inactive', 'IR', 'PUP', 'Sus', 'NA', 'DNR', 'COV', 'BYE', 'NO TEAM'}
LONG = {'IR', 'PUP', 'Sus', 'NA', 'DNR', 'COV'}
FIX = {'WSH': 'WAS', 'LA': 'LAR', 'JAC': 'JAX'}
ELIG = {'QB': ['QB'], 'RB': ['RB'], 'WR': ['WR'], 'TE': ['TE'], 'K': ['K'], 'DEF': ['DEF'], 'FLEX': ['RB', 'WR', 'TE'], 'WRRB_FLEX': ['RB', 'WR'],
        'REC_FLEX': ['WR', 'TE'], 'SUPER_FLEX': ['QB', 'RB', 'WR', 'TE']}
ET = datetime.timezone(datetime.timedelta(hours=-4))  # display only

def get(url, timeout=60):
    sep = '&' if '?' in url else '?'
    req = urllib.request.Request(url + sep + '_=%d' % int(time.time()), headers={'User-Agent': 'weasel-alerts/1.0', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)

def norm(n): return re.sub(r'(jr|sr|ii|iii|iv)$', '', re.sub(r'[^a-z]', '', (n or '').lower()))

def score(stats, ss):
    t = 0.0
    for k, w in (ss or {}).items():
        v = stats.get(k)
        if v is not None and w: t += v * w
    return t

def main():
    args = set(sys.argv[1:])
    if '--reset' in args and os.path.exists(STATE): os.remove(STATE)
    st = get(S + '/v1/state/nfl'); season = st.get('league_season') or st['season']; week = int(st.get('display_week') or st.get('week') or 1)
    user = get(S + '/v1/user/' + USER); uid = user['user_id']
    leagues = [l for l in get(S + '/v1/user/%s/leagues/nfl/%s' % (uid, season)) if not (l.get('settings') or {}).get('best_ball') and l.get('status') in ('in_season', 'post_season')]
    # players: hub slim file if fresh, else Sleeper full
    P, src = None, ''
    try:
        d = get(SLIM)
        if time.time() * 1000 - d['at'] < 75 * 60e3: P, src = d['p'], 'hub slim players file (%d min old)' % ((time.time() * 1000 - d['at']) / 6e4)
    except Exception: pass
    if P is None:
        allp = get(S + '/v1/players/nfl', 180); P = {}
        for pid, p in allp.items():
            P[pid] = {'n': p.get('full_name') or ('%s %s' % (p.get('first_name', ''), p.get('last_name', ''))).strip(), 'p': p.get('fantasy_positions') or [p.get('position')],
                      't': p.get('team'), 'i': p.get('injury_status'), 's': p.get('status'), 'b': p.get('injury_body_part'), 'e': p.get('espn_id')}
        src = 'Sleeper players file (direct)'
    proj = {}
    try:
        for x in get(S + '/projections/nfl/%s/%d?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF' % (season, week)):
            proj[x['player_id']] = x
    except Exception: pass
    # ESPN schedule + byes + game-day injuries
    games, byes, espn_out, now = {}, set(), {}, time.time()
    try:
        sb = get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=%d&seasontype=2&dates=%s' % (week, season))
        for t in (sb.get('week') or {}).get('teamsOnBye') or []: byes.add(FIX.get(t['abbreviation'], t['abbreviation']))
        for ev in sb.get('events') or []:
            c = ev['competitions'][0]; kick = datetime.datetime.fromisoformat(ev['date'].replace('Z', '+00:00')).timestamp(); stt = (c.get('status') or ev['status'])['type']['state']
            for tm in c['competitors']: games[FIX.get(tm['team']['abbreviation'], tm['team']['abbreviation'])] = {'id': ev['id'], 'kick': kick, 'state': stt, 'name': ev.get('shortName') or ev.get('name')}
        for g in {g['id']: g for g in games.values() if g['state'] != 'post' and g['kick'] - now <= 150 * 60}.values():
            try:
                sm = get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=' + g['id'])
                for T in sm.get('injuries') or []:
                    for i in T.get('injuries') or []:
                        if re.match(r'^out$', i.get('status') or '', re.I):
                            a = i.get('athlete') or {}; espn_out[str(a.get('id'))] = 1; espn_out['n:' + norm(a.get('displayName'))] = 1
            except Exception: pass
    except Exception: pass
    def status(pid):
        if not pid.isdigit(): return (('BYE' if pid in byes else None), 'schedule')
        db = P.get(pid) or {}; pr = proj.get(pid) or {}; pl = pr.get('player') or {}
        if 'injury_status' in pl:
            s, so = pl.get('injury_status'), 'Sleeper live'
            if not s and (db.get('i') in LONG or db.get('s') == 'Inactive'): s, so = db.get('i') or 'Inactive', 'Sleeper players file'
        else:
            s, so = db.get('i') or ('Inactive' if db.get('s') == 'Inactive' else None), 'Sleeper players file'
        if s not in LONG and s not in ('Out', 'Inactive') and (espn_out.get(str(db.get('e'))) or espn_out.get('n:' + norm(db.get('n')))): s, so = 'Out', 'ESPN game-day'
        team = pr.get('team') or db.get('t')
        if not team: return ('NO TEAM', 'Sleeper')
        if not s and (team in byes or (games and team not in games)): return ('BYE', 'ESPN schedule')
        return (s, so)
    def name(pid): return pid + ' D/ST' if not pid.isdigit() else (P.get(pid) or {}).get('n') or ('Player ' + pid)
    def pos(pid): return 'DEF' if not pid.isdigit() else ((P.get(pid) or {}).get('p') or ['?'])
    def team(pid): return pid if not pid.isdigit() else ((proj.get(pid) or {}).get('team') or (P.get(pid) or {}).get('t'))
    cur = []
    for lg in leagues:
        lid = lg['league_id']; rosters = get(S + '/v1/league/%s/rosters' % lid)
        me = next((r for r in rosters if r.get('owner_id') == uid or uid in (r.get('co_owners') or [])), None)
        if not me: continue
        mu = get(S + '/v1/league/%s/matchups/%d' % (lid, week)); mm = next((m for m in mu if m['roster_id'] == me['roster_id']), None)
        starters = (mm or {}).get('starters') or me.get('starters') or []
        slots = [s for s in lg['roster_positions'] if s not in ('BN', 'IR', 'TAXI')]; ss = lg.get('scoring_settings') or {}
        def pj(pid):
            x = proj.get(pid); return round(score(x.get('stats') or {}, ss), 1) if x else 0.0
        ex = set((me.get('reserve') or []) + (me.get('taxi') or []))
        bench = [p for p in (me.get('players') or []) if p not in starters and p not in ex]
        used = set()
        for i, pid in enumerate(starters):
            slot = slots[i] if i < len(slots) else '?'
            if not pid or pid == '0':
                s, so = 'EMPTY', 'Sleeper lineup'
            else:
                s, so = status(pid)
            if s is None and pid and pid != '0': continue
            g = games.get(team(pid) or '') if pid and pid != '0' else None
            locked = bool(g and (g['state'] != 'pre' or g['kick'] <= now))
            el = ELIG.get(slot, [slot]); cands = []
            for b in bench:
                if b in used: continue
                bs, _ = status(b); bg = games.get(team(b) or '')
                if bs in ALERT: continue
                if not bg or bg['state'] != 'pre' or bg['kick'] <= now: continue  # swap's game already started/locked
                pp = pos(b); pp = pp if isinstance(pp, list) else [pp]
                if any(x in el for x in pp): cands.append((pj(b), b, bg))
            cands.sort(key=lambda c: (c[0], c[1]), reverse=True); sw = None
            if cands and not locked:  # no swap once the starter's own game has locked
                bg = cands[0][2]; kt = datetime.datetime.fromtimestamp(bg['kick'], ET)
                sw = {'player': name(cands[0][1]), 'player_id': cands[0][1], 'proj': cands[0][0], 'team': team(cands[0][1]), 'game': bg.get('name'),
                      'kickoff_et': kt.strftime('%a %-I:%M %p ET'), 'kickoff_ts': int(bg['kick']), 'kicks_before_starter': bool(g and bg['kick'] < g['kick'])}
                if sw['kicks_before_starter']:
                    sw['note'] = '%s plays the %s %s game (before %s) - swap before then' % (sw['player'], kt.strftime('%-I:%M %p ET'), bg.get('name') or team(cands[0][1]), name(pid))
                if s != 'Questionable': used.add(cands[0][1])
            pp = pos(pid) if pid and pid != '0' else ['-']
            cur.append({'league': lg['name'].strip(), 'league_id': lid, 'player': name(pid) if pid and pid != '0' else '(empty slot)', 'player_id': pid or '', 'pos': pp[0] if isinstance(pp, list) else pp,
                        'team': team(pid) if pid and pid != '0' else None, 'slot': slot, 'status': 'Empty' if s == 'EMPTY' else s, 'body': (P.get(pid) or {}).get('b') if pid else None,
                        'proj': pj(pid) if pid else 0, 'kickoff_et': datetime.datetime.fromtimestamp(g['kick'], ET).strftime('%a %-I:%M %p ET') if g else None,
                        'locked': locked, 'source': so, 'swap': sw, 'lineup_url': 'https://sleeper.com/leagues/%s/team' % lid})
    prev = {}
    try: prev = json.load(open(STATE))
    except Exception: pass
    key = lambda x: '%s:%s:%s' % (season, x['league_id'], x['player_id'] or x['slot'])
    pw = prev.get('week') == '%s-%d' % (season, week); old = prev.get('s', {}) if pw else {}
    changes = [dict(x, prev=old.get(key(x))) for x in cur if x['status'] != old.get(key(x)) and not x['locked']]
    nowk = {key(x) for x in cur}
    cleared = [{'key': k, 'prev': v} for k, v in old.items() if k not in nowk]
    out = {'generated_et': datetime.datetime.now(ET).strftime('%Y-%m-%d %-I:%M %p ET'), 'user': USER, 'user_id': uid, 'season': season, 'week': week,
           'leagues': {l['league_id']: l['name'].strip() for l in leagues}, 'players_source': src, 'espn_games_checked': len({g['id'] for g in games.values() if g['state'] != 'post' and g['kick'] - now <= 150 * 60}),
           'changes': changes, 'cleared': cleared, 'current': cur}
    if '--peek' not in args:
        json.dump({'week': '%s-%d' % (season, week), 's': {key(x): x['status'] for x in cur}, 'at': int(time.time())}, open(STATE, 'w'))
    json.dump(out, open(LATEST, 'w'), indent=1)
    print(json.dumps(out, indent=1))

if __name__ == '__main__': main()

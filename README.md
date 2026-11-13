# Weasel Hub

Brett's private multi-league dynasty command center: https://howibrettyourmother.github.io/weaselhub/
Static site (GitHub Pages, no build step, no server, no login). Everything is computed in the browser from free public data:
Sleeper API, FantasyCalc dynasty values, ESPN public scoreboard/news, plus three data files refreshed by GitHub Actions.
Read-only: nothing here posts to Sleeper or messages anyone. "Propose / Set lineup / Add" links just open Sleeper.

## Sections (phone: bottom bar = group, top row = tabs in that group)
| Group | Tabs (`#hash`) |
|---|---|
| Today | `#home` lineup briefing, league snapshot, deadline alert · `#sunday` start/sit calls, scoreboard, rooting guide · `#live` live games, Pick Watch, who's left |
| Leagues | `#standings` every team: record, PF, max PF, playoff + #1-seed odds, projected rookie slot · `#rosters` values, holes, bye planner · `#scout` leaguemate buy/sell reads · `#exposure` value tracker, concentration, contracts, risk |
| Moves | `#trade` deadlines, Trade Finder (all leagues) · `#find/<sleeper id>` player finder: owner + value in every league, trade route · `#waivers` best FAs per league, bye-week targets |
| Draft | `#picks` Pick Watch for every 1st/2nd you own, all picks + values · `#draft` rookie war room: projected order, mock, live assistant |
| More | `#news` injury/status feed on your players · `#recap` last week's report cards · `#coach` Coaches Corner (Dynasty Guru's game plan) |

URL options: `?lg=<leagueId>,<leagueId>` league filter (also the chips under the header), `?u=<sleeper user>`, `?w=<week>`.

## One model for odds and draft order
`core.js` is a pure, unit-tested season simulator (3,000 seasons): this week from live scores + projections, the rest from the real
remaining Sleeper schedule, seeding by wins then PF, then a simulated playoff bracket (fixed bracket, top seeds get byes, 3rd-place game).
Rookie draft order, per Brett's leagues: **non-playoff teams first by lowest max PF, then playoff teams by playoff finish (champion last)**.
`hub5.js` wraps `standings()` so every consumer (Home odds, Standings, Picks, Live Pick Watch, Draft, Trade pick values) reads the same slots.
Pick Watch ignores max PF for teams with 90%+ playoff odds (it can't move their pick).

## Files
| File | What |
|---|---|
| `app.js` | state, Sleeper/ESPN loading, projections, statuses, Sunday tab, router, refresh |
| `tabs.js` | Rosters, Exposure risk panel, Trade tab host, Waivers, Picks, Recap, News, FantasyCalc values, team model |
| `tabs2.js` | Home snapshot, Scout, bye planner, roasts |
| `live.js` | Live tab (play-by-play, Pick Watch, who's left) |
| `hub2.js` / `hub3.js` / `hub4.js` | lineup briefing + value tracker / Trade Finder + Draft war room + concentration / contracts |
| `cc.js` | Coaches Corner renderer (`data/cc_<league>.md`); record/PF rank/waivers/deadline tiles are live |
| `core.js`, `hub5.js` | simulator + wiring (see above) |
| `hub6.js` | Standings tab, Player Finder, key dates / deadline alert |
| `hub7.js` | grouped navigation, phone bottom bar, redirects retired hash names |
| `tools/` | data builders (below), `injury_alerts.py` (JSON of flagged starters across leagues), `smoke.py` |

Each `*.js` is an IIFE except `app.js` (shared globals: `D`, `standings`, `pinfo`, `projFor`, `ownerOf`, `EXTRA_TABS`, ...).
New tabs: `EXTRA_TABS.push([key, icon, LABEL, renderFn])` and add the key to a group in `hub7.js`. Bump the `?v=` on any changed file in `index.html`.

## Data files (GitHub Actions)
- `data/players.json` (`players.yml`, every 30 min on game days, hourly otherwise): slim Sleeper players file. Its `at` timestamp is the
  freshness heartbeat the app checks (older than 75 min near kickoff / 3 h otherwise = fall back to Sleeper's 14 MB file), which is why
  this produces most commits. Deliberate; don't "fix" by keeping `at` constant.
- `data/values_history.json` (`values.yml`, daily): FantasyCalc snapshots for the Trade-Value Tracker.
- `data/contracts.json` (`contracts.yml`, daily): nflverse/OverTheCap contracts for rostered players (FA badges, Contracts view).

## Coaches Corner
`data/cc_<league>.md` (shadynasty, f2020, dynastyjunkies, livefree): markdown, each `##` heading becomes a card, `|` tables and `-` lists work.
The hero tiles (record, PF rank, FAAB/waiver priority, deadline) are live from Sleeper; a banner flags plans older than ~6 days.
To update the plan, replace the file and push.

## Checks
- `node tests/core.test.js`: simulator/bracket/draft-order unit tests (also run by `.github/workflows/ci.yml` with a syntax check of every script).
- `python3 tools/smoke.py [url]`: every tab at phone + desktop size in headless Chrome; fails on any JS error, error panel or page overflow.
  Run it against a local `python3 -m http.server` before pushing, and against the live site after.

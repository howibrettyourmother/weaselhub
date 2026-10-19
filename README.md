# Weasel Hub

## Round 2/3 additions
- Home: Sunday Morning Briefing (per league: starters Out/Doubtful/Questionable/Inactive/bye, empty slots, swap suggestions with projections, trending FA adds). Big and expanded Sunday 5am-1pm ET and within 3h of your next kickoff.
- Exposure: Trade-Value Tracker (daily snapshots in `data/values_history.json` from `.github/workflows/values.yml` / `tools/snapshot_values.py`; live last point; risers/fallers + sell-high hints) and Concentration (position / NFL-team shares, over-exposure flags).
- Trade: Trade Finder (all rosters, all leagues; league / target / sell filters; FantasyCalc in each league's format, stud-adjusted fairness, "why they'd accept").
- Draft: Rookie Draft War Room (projected picks by max-PF order, mock, live assistant once Sleeper creates the draft).
- `tools/injury_alerts.py`: JSON of Brett's flagged starters and status changes across all leagues.

## Contracts
`data/contracts.json` is rebuilt daily by `.github/workflows/contracts.yml` (`tools/build_contracts.py`) from the nflverse `contracts` release (historical_contracts.parquet, OverTheCap-derived). Only players rostered in Brett's Sleeper leagues. Matching: Sleeper gsis_id, else exact normalized name + position (team breaks ties); no confident match = left out (UI says "unknown"). Shown on the Exposure tab (Contracts section + "hitting free agency" callout) and as small "FA YYYY" badges for deals ending after this season.

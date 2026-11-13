#!/usr/bin/env python3
"""Weasel Hub smoke test: loads every tab at phone (390x844) and desktop (1366x900) sizes in headless Chrome and fails on any
JS error, error panel, or horizontal page overflow. Needs: pip install playwright && playwright install chromium (or CHROME=path).
  python3 tools/smoke.py                                   # live site
  python3 -m http.server 8000 & python3 tools/smoke.py http://127.0.0.1:8000/   # local checkout
Screenshots go to ./smoke-shots/ (git-ignored). Uses a normal browser user agent: ESPN's API returns 403 to 'HeadlessChrome'."""
import asyncio, os, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://howibrettyourmother.github.io/weaselhub/'
TABS = ['home', 'sunday', 'live', 'standings', 'rosters', 'scout', 'exposure', 'trade', 'find', 'waivers', 'picks', 'draft', 'news', 'recap', 'coach']
UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
UA_DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
OUT = 'smoke-shots'
async def run(p, name, vp, mobile):
    kw = {'executable_path': os.environ['CHROME']} if os.environ.get('CHROME') else {}
    b = await p.chromium.launch(args=['--no-sandbox'], **kw)
    ctx = await b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, user_agent=UA_PHONE if mobile else UA_DESK)
    pg = await ctx.new_page(); errs = []; cur = {'t': 'boot'}
    pg.on('pageerror', lambda e: errs.append((cur['t'], 'pageerror', str(e)[:300])))
    pg.on('console', lambda m: errs.append((cur['t'], 'console', m.text[:300])) if m.type == 'error' else None)
    await pg.goto(BASE + '#home', wait_until='domcontentloaded')
    await pg.wait_for_function("document.querySelector('#view') && !document.querySelector('#view > .spin')", timeout=45000)
    for t in TABS:
        cur['t'] = t
        await pg.evaluate("h => location.hash = h", '#' + t)
        await pg.wait_for_timeout(1200)
        try: await pg.wait_for_function("!document.querySelector('#view .spin')", timeout=25000)
        except Exception: errs.append((t, 'timeout', 'still loading after 25s'))
        await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""() => ({err: [...document.querySelectorAll('#view .err')].map(e => e.innerText.slice(0, 160)),
            ovx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            empty: (document.querySelector('#view').innerText || '').trim().length < 40})""")
        for e in r['err']: errs.append((t, 'panel', e))
        if r['ovx']: errs.append((t, 'layout', 'horizontal page overflow'))
        if r['empty']: errs.append((t, 'empty', 'tab rendered almost nothing'))
        os.makedirs(OUT, exist_ok=True); await pg.screenshot(path='%s/%s-%s.png' % (OUT, name, t))
    await b.close(); return errs
async def main():
    async with async_playwright() as p:
        res = await asyncio.gather(run(p, 'phone', {'width': 390, 'height': 844}, True), run(p, 'desktop', {'width': 1366, 'height': 900}, False))
    bad = [(n,) + e for n, r in zip(['phone', 'desktop'], res) for e in r
           if not (e[1] == 'panel' and 'ESPN' in e[2])]  # ESPN outages show a soft banner by design
    for x in bad: print('FAIL', *x)
    print('%d tabs x 2 sizes, %d problems' % (len(TABS), len(bad)))
    sys.exit(1 if bad else 0)
asyncio.run(main())

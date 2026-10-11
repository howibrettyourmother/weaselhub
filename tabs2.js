'use strict';
// Weasel Hub, part 3: Home snapshot (+playoff sim, rivals), Scout, Bye planner, Weasel roasts, tab order.
(function(){
function int(n){return Math.round(+n||0).toLocaleString('en-US')}
function hash(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function pick(arr,seed){return arr[hash(seed)%arr.length]}
function fill(t,o){return t.replace(/\{(\w+)\}/g,function(m,k){return '<b>'+esc(o[k]==null?'':o[k])+'</b>'})}
function rng(seed){var a=hash(seed)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function gauss(r){var u=r()||1e-9,v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v)}

// ---------- Weasel roasts: fantasy performance only (lineups, scores, benches, records); never real-life/personal stuff ----------
var R={
 pre_fav:["{O} is projected for {op}. The Weasel is projected to collect.","{O} set a lineup. Brave. Pointless, but brave.","{O} needs a miracle and a stat correction. Probably two.","Projected margin {m}. {O} should start drafting the excuse now."],
 pre_dog:["{O} is favored by {m}. The Weasel has seen worse odds and stolen better wins.","Underdog by {m}. Perfect. Weasels work best from behind.","{O} is projected ahead. Projections have been wrong before. Mostly about {O}."],
 pre_even:["Coin flip vs {O}. One kicker decides this. Pray.","Dead even with {O}. Somebody's flex is about to ruin a group chat."],
 live_up:["Up {m} on {O}. Keep the foot on the throat.","{O} is down {m} and refreshing the app like it owes them money.","Leading {O} by {m}. Don't get cute, the Weasel never gets cute."],
 live_down:["Down {m} to {O}. The Weasel is not panicking. The Weasel is a little panicking.","{O} up {m}. Time for your guys to remember they're good."],
 won:["Weasels win. {O} never stood a chance.","{O} got cooked by {m}. Medium-well. Nobody sent it back.","Beat {O} by {m}. Frame this one for {O}'s fridge."],
 lost:["{O} beat the Weasels by {m}. Frame it, {O}. It may never happen again.","Lost to {O} by {m}. The bench is a crime scene; check Recap."],
 bench_big:["{B} points left on the bench. The Weasel set that lineup blindfolded.","{B} bench points. Somewhere a benched tight end is laughing at you.","{B} points riding the pine. That's not a bench, that's a second team."],
 bench_small:["Only {B} on the bench. Lineup wizardry. Don't let it go to your head.","{B} bench points. Near-perfect. Suspiciously perfect."],
 bench_flip:["The optimal lineup would have WON. That loss is on the manager, not the players."]};
window.ROASTS={card:function(c,started){var L=c.L,me=c.me,op=c.op,O=ownerOf(L,L.opp).name,m=Math.abs(me.fin-op.fin),done=me.rem+op.rem<0.05,seed=L.id+':'+D.week;
  var k=done?(me.actSum>=op.actSum?'won':'lost'):started&&(me.live+op.live>0)?(me.fin>=op.fin?'live_up':'live_down'):(me.odds>=0.6?'pre_fav':me.odds<=0.4?'pre_dog':'pre_even');
  return fill(pick(R[k],seed+k),{O:O,op:f1(op.fin),m:f1(m)})},
 bench:function(b,flip,seed){var k=flip?'bench_flip':b>=20?'bench_big':'bench_small';return fill(pick(R[k],seed),{B:f1(b)})}};

// ---------- playoff odds sim ----------
var _fut={};
function futureMatchups(L){if(_fut[L.id])return _fut[L.id];var pws=(L.raw.settings||{}).playoff_week_start||15,fns=[];
  for(var w=D.week+1;w<pws;w++)(function(w){fns.push(function(){return SC(SAPI+'/v1/league/'+L.id+'/matchups/'+w,6*36e5).then(function(m){return {w:w,m:m}}).catch(function(){return {w:w,m:[]}})})})(w);
  var out=[],i=0;function next(){if(i>=fns.length)return Promise.resolve(out);return fns[i++]().then(function(r){out.push(r);return next()})}
  return (_fut[L.id]=Promise.all([next(),next(),next()]).then(function(){return out.sort(function(a,b){return a.w-b.w})}))}
function simOdds(L,fut,N){var st=standings(L),rids=Object.keys(L.rosters).map(Number),pt=(L.raw.settings||{}).playoff_teams||Math.floor(rids.length/2);
  var str={};rids.forEach(function(r){var s=st[r],g=Math.max(1,s.w+s.l+s.t),ppg=s.pf/g,side=L.sides&&L.sides[r],pj=side?side.proj:ppg;str[r]={mu:g>=2?0.65*ppg+0.35*pj:0.4*ppg+0.6*pj}});
  var lm=rids.reduce(function(a,r){return a+str[r].mu},0)/rids.length;rids.forEach(function(r){str[r].mu=0.7*str[r].mu+0.3*lm});// regress to the mean
  var mm={};Object.keys(L.sides||{}).forEach(function(k){var s=L.sides[k];(mm[s.mid]=mm[s.mid]||[]).push(s)});
  var made={},top={},rnd=rng(L.id+':'+D.week+':'+Math.floor(Date.now()/36e5));rids.forEach(function(r){made[r]=0;top[r]=0});
  for(var n=0;n<N;n++){var W={},PF={},MU={};rids.forEach(function(r){MU[r]=str[r].mu*(1+0.08*gauss(rnd))});rids.forEach(function(r){W[r]=st[r].w+st[r].t/2;PF[r]=st[r].pf});
    // this week: use live/projected finals
    Object.keys(mm).forEach(function(k){var p=mm[k];if(p.length!==2)return;var a=p[0],b=p[1],sa=a.fin+gauss(rnd)*Math.max(1,0.09*a.proj*Math.sqrt(Math.max(0,a.rem)/Math.max(1,a.proj))),sb=b.fin+gauss(rnd)*Math.max(1,0.09*b.proj*Math.sqrt(Math.max(0,b.rem)/Math.max(1,b.proj)));PF[a.rid]+=sa;PF[b.rid]+=sb;if(sa>sb)W[a.rid]++;else W[b.rid]++});
    fut.forEach(function(f){var g={};(f.m||[]).forEach(function(m){if(m.matchup_id!=null)(g[m.matchup_id]=g[m.matchup_id]||[]).push(m.roster_id)});
      Object.keys(g).forEach(function(k){var p=g[k];if(p.length!==2)return;var a=p[0],b=p[1],sa=MU[a]*(1+0.20*gauss(rnd)),sb=MU[b]*(1+0.20*gauss(rnd));PF[a]+=sa;PF[b]+=sb;if(sa>sb)W[a]++;else W[b]++})});
    var ord=rids.slice().sort(function(a,b){return W[b]-W[a]||PF[b]-PF[a]});ord.slice(0,pt).forEach(function(r){made[r]++});top[ord[0]]++}
  var o={};rids.forEach(function(r){o[r]={po:made[r]/N,top:top[r]/N}});return o}

// ---------- HOME: league snapshot ----------
function renderHome(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No active leagues.</div>';return}
  if(!D.M)D.M=computeAll();
  function card(L,odds){var st=standings(L),me=st[L.me],n=Object.keys(L.rosters).length,pt=(L.raw.settings||{}).playoff_teams||6,c=D.M.cards.filter(function(x){return x.L===L})[0];
    var live='';if(c){var started=c.me.ytp<c.me.lines.length||c.op.ytp<c.op.lines.length,anyLive=c.me.live+c.op.live>0;
      live='<div class="small" style="margin-top:4px">Wk '+D.week+' vs <b>'+esc(ownerOf(L,L.opp).name)+'</b>: '+(started?f1(c.me.actSum)+'–'+f1(c.op.actSum)+' · ':'')+'proj '+f1(c.me.fin)+'–'+f1(c.op.fin)+' · <b style="color:'+(c.me.odds>=0.5?'var(--for)':'var(--ag)')+'">'+pct(c.me.odds)+'</b> '+(anyLive?'<span class="live">● LIVE</span>':started?'<span class="muted">'+bankLabel(c.me,c.op)+'</span>':'')+'</div>'}
    var o=odds&&odds[L.me];
    return '<a class="box" style="display:block;color:inherit" href="#sunday"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:2px 0">'+esc(L.name)+'</h3><span class="small muted">'+esc(ownerOf(L,L.me).name)+'</span></div>'+
     '<div class="mini"><div><b>'+me.w+'-'+me.l+(me.t?'-'+me.t:'')+'</b><small>RECORD</small></div><div><b>#'+me.rank+'</b><small>OF '+n+'</small></div><div><b>'+(o?pct(o.po):'…')+'</b><small>PLAYOFFS</small></div><div><b>'+(o?pct(o.top):'…')+'</b><small>#1 SEED</small></div></div>'+
     '<div class="small muted">'+f1(me.pf)+' PF (#'+me.pfRank+') · top '+pt+' make it</div>'+live+(L.calls?'<div class="small" style="margin-top:3px">🧠 '+(L.calls.calls.length?'<b style="color:var(--gold)">'+callsSummary(L.calls)+'</b>':callsSummary(L.calls))+'</div>':'')+'</a>'}
  var odds={};
  function draw(){var tot={w:0,l:0};D.leagues.forEach(function(L){var s=standings(L)[L.me];tot.w+=s.w;tot.l+=s.l});
    var exp=D.M.cards.reduce(function(a,c){return a+c.me.odds},0);
    el.innerHTML='<section class="panel"><h2>🏠 Snapshot <small>'+tot.w+'-'+tot.l+' OVERALL · WK '+D.week+' EXP '+f1(exp)+' W</small></h2><div class="grid2">'+D.leagues.map(function(L){return card(L,odds[L.id])}).join('')+'</div><div class="hint" style="margin-top:6px">Tap a league for the Sunday view. Playoff odds: 3,000-season Monte Carlo on the real remaining Sleeper schedule (this week from live projections, later weeks from points-per-game blended with this week\'s projection); seeds by wins then PF, divisions ignored.</div></section>'+
    rivalsHTML()}
  draw();
  D.leagues.forEach(function(L){futureMatchups(L).then(function(f){odds[L.id]=simOdds(L,f,3000);if(curTab()[0]==='home')draw()})})}
function rivalsHTML(){var rows=[];D.leagues.forEach(function(L){(L.rivals||[]).filter(function(x){return x.rid!==L.opp}).forEach(function(x){var o=ownerOf(L,x.rid),s=L.sides&&L.sides[x.rid],vs=s&&s.vs?(s.vs.rid===L.me?'YOU':ownerOf(L,s.vs.rid).name):'—';
    rows.push('<div class="flag"><div class="ic">👀</div><div class="fx"><div class="ft">'+esc(o.name)+' <span class="muted small">'+esc(L.name)+'</span></div><div class="small muted">'+x.w+'-'+x.l+(x.t?'-'+x.t:'')+' · #'+x.rank+' · '+f1(x.pf)+' PF</div><div class="small">This week vs '+esc(vs)+(s&&s.vs&&s.vs.rid!==L.me?' · '+pct(1-s.odds)+' chance they lose':'')+'. You want them to lose (tracked here only; not part of the Sunday Rooting Guide).</div></div></div>')})});
  return rows.length?'<section class="panel"><h2>👀 Rival Watch</h2><div class="hint">Teams within a game of you in the standings.</div>'+rows.join('')+'</section>':''}

// ---------- SCOUT: leaguemate scouting ----------
var _tx={};
function txns(L){if(_tx[L.id])return _tx[L.id];var fns=[];for(var w=1;w<=D.week;w++)(function(w){fns.push(function(){return SC(SAPI+'/v1/league/'+L.id+'/transactions/'+w,w<D.week?6*36e5:6e5).catch(function(){return []})})})(w);
  return (_tx[L.id]=Promise.all(fns.map(function(f){return f()})).then(function(a){return [].concat.apply([],a).filter(function(t){return t.status==='complete'})}))}
function renderScout(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No leagues.</div>';return}
  el.innerHTML='<section class="panel"><div class="spin">Scouting the league…</div></section>';
  Promise.all([window.WH_ensure()].concat(D.leagues.map(txns))).then(function(r){if(curTab()[0]!=='scout')return;var T=r.slice(1);
    el.innerHTML='<section class="panel"><h2>🕵️ Leaguemate Scouting</h2><div class="hint">Every manager: buy/sell read (contender score = record 45%, starting-lineup value 35%, points-for 20%; age sets direction), what they need, what they can sell you, and how active they are. Use it to target trades.</div>'+
    D.leagues.map(function(L,i){var tx=T[i]||[],M=L.model,bud=(L.raw.settings||{}).waiver_budget||0,act={};
      tx.forEach(function(t){(t.roster_ids||[]).forEach(function(rid){var a=act[rid]=act[rid]||{tr:0,mv:0,last:0};if(t.type==='trade')a.tr++;else a.mv++;a.last=Math.max(a.last,t.status_updated||t.created||0)})});
      var ts=Object.keys(M.teams).map(function(k){return M.teams[k]}).filter(function(t){return t.rid!==L.me}).sort(function(a,b){return b.cs-a.cs});
      var myNeed=M.me.holes.length?M.me.holes:['QB','RB','WR','TE'].slice().sort(function(a,b){return M.me.ratio[a]-M.me.ratio[b]}).slice(0,1);
      return '<h3>'+esc(L.name)+'</h3>'+ts.map(function(t){var a=act[t.rid]||{tr:0,mv:0,last:0},rr=L.rosters[t.rid].settings||{},faab=bud?bud-(rr.waiver_budget_used||0):null;
        var fit=t.surplus.filter(function(p){return myNeed.indexOf(p)>=0});var wantsMine=t.holes.filter(function(p){return M.me.surplus.indexOf(p)>=0});
        var tag=a.tr>=2?'<span class="pill y">TRADER</span>':a.mv===0&&a.tr===0?'<span class="pill">GHOST</span>':'';
        return '<div class="flag"><div class="ic">'+(ownerOf(L,t.rid).av?'<img class="av" style="width:24px;height:24px;border-radius:50%" src="'+ownerOf(L,t.rid).av+'" alt="">':'')+'</div><div class="fx"><div class="ft">'+esc(ownerOf(L,t.rid).name)+' '+pill(t.mode)+' '+tag+(fit.length&&wantsMine.length?' <span class="pill g">TRADE FIT</span>':'')+'</div>'+
          '<div class="small muted">'+t.st.w+'-'+t.st.l+' · score '+t.cs+' · core age '+t.cAge.toFixed(1)+' · value #'+t.vRank+' · '+a.tr+' trades, '+a.mv+' moves this season'+(faab!=null?' · $'+faab+' FAAB':'')+(a.last?' · last move '+new Date(a.last).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'')+'</div>'+
          '<div class="small">Read: '+esc(t.read)+'. Needs '+(t.holes.join(', ')||'nothing')+'; deep at '+(t.surplus.join(', ')||'nothing')+'.'+(fit.length?' Deep where you\'re thin ('+fit.join(', ')+').':'')+(wantsMine.length?' Wants what you have ('+wantsMine.join(', ')+').':'')+'</div></div></div>'}).join('')}).join('')+'</section>'}).catch(function(e){el.innerHTML='<div class="panel err">'+esc(e.message)+'</div>'})}
function pill(mode){return '<span class="pill '+(mode==='CONTENDER'?'g':mode==='REBUILD'?'r':'y')+'">'+mode+'</span>'}

// ---------- BYE planner (rendered inside Rosters) ----------
var _sched=null;
function schedule(){if(_sched)return _sched;return (_sched=SC(SAPI+'/schedule/nfl/regular/'+D.season,864e5).then(function(all){var played={};all.forEach(function(g){(played[g.week]=played[g.week]||{})[g.home]=1;played[g.week][g.away]=1});return played}).catch(function(){return null}))}
window.byePlannerHTML=function(){return schedule().then(function(played){if(!played)return '<div class="hint">Schedule unavailable.</div>';
  return D.leagues.map(function(L){var r=L.rosters[L.me],pws=(L.raw.settings||{}).playoff_week_start||15,ids=(r.players||[]).filter(function(id){return (r.reserve||[]).indexOf(id)<0}),start=L.model.me.starters;
    var cells=[];for(var w=D.week;w<pws&&w<=18;w++){var pw=played[w]||{};var out=start.filter(function(id){var t=pinfo(id).team;return t&&!pw[t]});
      // can we still fill every starting slot with players who play that week?
      var avail=ids.filter(function(id){var t=pinfo(id).team;return t&&pw[t]}),left=avail.slice(),empty=0;
      L.slots.map(function(s){return ELIG[s]||[s]}).sort(function(a,b){return a.length-b.length}).forEach(function(e){var i=-1,bv=-1;left.forEach(function(id,j){var fp=pinfo(id).fp||[];var v=(L.V&&L.V.p[id])||projFor(L,id)||1;if(fp.some(function(x){return e.indexOf(x)>=0})&&v>bv){bv=v;i=j}});if(i>=0)left.splice(i,1);else empty++});
      cells.push('<div class="'+(empty?'bad':out.length>=3?'warn':'')+'" title="'+esc(out.map(function(id){return pinfo(id).n}).join(', '))+'"><b>W'+w+'</b>'+(out.length?out.length+' starter'+(out.length>1?'s':'')+' out':'clear')+(empty?'<br><span style="color:var(--ag)">'+empty+' hole'+(empty>1?'s':'')+'</span>':'')+'</div>')}
    var worst=[];for(var w2=D.week;w2<pws&&w2<=18;w2++){var p2=played[w2]||{};var o2=start.filter(function(id){var t=pinfo(id).team;return t&&!p2[t]});if(o2.length)worst.push('W'+w2+': '+o2.map(function(id){return esc(pinfo(id).n)}).join(', '))}
    return '<h3>'+esc(L.name)+'</h3><div class="byeg">'+cells.join('')+'</div>'+(worst.length?'<div class="small muted" style="margin-top:4px">'+worst.join(' · ')+'</div>':'')}).join('')})};

window.TAB_ORDER=[['home','sunday','news','recap'],['rosters','exposure','picks'],['trade','waivers','scout']];
TABS.unshift(['home','🏠','HOME',renderHome]);
EXTRA_TABS.push(['scout','🕵️','SCOUT',renderScout]);
$('#tabs').innerHTML=navHTML();
})();

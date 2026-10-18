'use strict';
// Weasel Hub round 2: Sunday Morning Briefing (Home), Trade-Value Tracker (Exposure; daily snapshots from .github/workflows/values.yml).
(function(){
function int(n){return Math.round(+n||0).toLocaleString('en-US')}
var ETP=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',hour12:false});
function etNow(){var o={};ETP.formatToParts(new Date()).forEach(function(p){o[p.type]=p.value});return {wd:o.weekday,h:+o.hour%24}}
var BADI={Out:'OUT',Doubtful:'DOUBTFUL',Questionable:'QUESTIONABLE',Inactive:'INACTIVE',IR:'IR',PUP:'PUP',Sus:'SUSPENDED',NA:'N/A',DNR:'DNR',COV:'COVID'};
// ---------------- SUNDAY MORNING BRIEFING ----------------
var TR=null,TRat=0;function trend(){if(TR&&Date.now()-TRat<30*6e4)return TR;TRat=Date.now();
  return (TR=SC(SAPI+'/v1/players/nfl/trending/add?lookback_hours=24&limit=40',30*6e4).then(function(a){var o={};(a||[]).forEach(function(x){o[x.player_id]=x.count});BRIEF.tr=o;if(curTab()[0]==='home')rerender();return o}).catch(function(){return {}}))}
function brief(L){var r=L.rosters[L.me],m=L.mu.filter(function(x){return x.roster_id===L.me})[0];if(!r||!m)return null;
  var st=m.starters||[],inS={},ex={};st.forEach(function(x){inS[x]=1});(r.reserve||[]).forEach(function(x){ex[x]=1});(r.taxi||[]).forEach(function(x){ex[x]=1});
  function ln(id){return playerLine(L,id,m.players_points)}
  function bad(l){var pi=l.pi;if(!pi.team)return 'NO TEAM';if(D.gamesOk&&!l.g)return 'BYE';return pi.inj&&BADI[pi.inj]?BADI[pi.inj]:null}
  var bench=(r.players||[]).filter(function(x){return !inS[x]&&!ex[x]}).map(ln).filter(function(b){return b.state==='pre'&&!(b.g&&+b.g.kick<=Date.now())&&!bad(b)});
  var used={},items=[];
  L.slots.forEach(function(slot,i){var id=st[i],el=ELIG[slot]||[slot];
    function best(){return bench.filter(function(b){return !used[b.id]&&(b.pi.fp||[]).some(function(p){return el.indexOf(p)>=0})}).sort(function(a,b){return b.proj-a.proj})[0]}
    if(!id||id==='0'){var c=best();if(c)used[c.id]=1;items.push({sev:3,slot:slot,t:'Empty '+slot+' slot',sw:c,kick:null});return}
    var l=ln(id);if(l.state!=='pre'&&l.state!=='none')return;var b=bad(l);if(!b)return;
    var sev=b==='QUESTIONABLE'?1:b==='DOUBTFUL'?2:3,c=best();if(sev===1&&l.g){var lk=+l.g.kick,late=bench.filter(function(x){return !used[x.id]&&x.g&&+x.g.kick>=lk&&(x.pi.fp||[]).some(function(p){return el.indexOf(p)>=0})}).sort(function(a,b){return b.proj-a.proj})[0];if(late&&(!c||late.proj>=c.proj*0.6))c=late}if(c&&sev>=2)used[c.id]=1;
    items.push({sev:sev,slot:slot,l:l,b:b,sw:c,kick:l.g&&+l.g.kick,body:l.pi.body})});
  // pure upgrades the start/sit engine calls Strong/Lean that aren't already covered above
  var cs=L.calls,up=[];if(cs&&cs.calls)cs.calls.forEach(function(c){if(c.lvl<1||!c.y||used[c.x.id])return;if(items.some(function(it){return it.l&&it.l.id===c.y.id}))return;up.push(c)});
  var wv=[];if(BRIEF.tr){var taken={};Object.keys(L.rosters).forEach(function(k){(L.rosters[k].players||[]).forEach(function(p){taken[p]=1})});
    var ok={};L.slots.forEach(function(s){(ELIG[s]||[s]).forEach(function(p){ok[p]=1})});
    wv=Object.keys(BRIEF.tr).filter(function(id){var pi=pinfo(id);return !taken[id]&&pi.team&&ok[pi.pos]&&!(pi.inj&&BADI[pi.inj]&&pi.inj!=='Questionable')}).map(function(id){return {id:id,n:BRIEF.tr[id],pr:projFor(L,id),pi:pinfo(id)}}).filter(function(x){return x.pr>=3}).sort(function(a,b){return b.n-a.n}).slice(0,3)}
  items.sort(function(a,b){return b.sev-a.sev});return {L:L,items:items,up:up.slice(0,2),wv:wv}}
function swapTxt(it){var s=it.sw;if(!s)return '<span class="muted">No healthy eligible bench option.</span>';
  var a='<b style="color:var(--for)">'+esc(s.pi.n)+'</b> '+posChip(s.pi.pos)+' '+f1(s.proj)+' proj'+(s.g?' · '+ETTIME.format(s.g.kick)+' ET':'');
  if(!it.l)return 'Fill with '+a;if(it.sev===1)return 'Backup plan if he sits: '+a+' <span class="muted">(vs his '+f1(it.l.proj)+')</span>'+(s.g&&it.kick&&+s.g.kick<it.kick?' <span style="color:var(--warn)">⚠ locks first: decide before '+ETTIME.format(s.g.kick)+' ET</span>':' <span class="muted">· plays same time or later, so you can wait for inactives</span>');return 'Swap in '+a+' <span class="muted">(vs '+f1(it.l.proj)+')</span>'}
var SEVC={3:'r',2:'r',1:'y'};
window.BRIEF={tr:null,html:function(){if(!D.leagues||!D.leagues.length)return '';trend();var now=Date.now(),et=etNow();
  var mine={};D.leagues.forEach(function(L){var m=L.mu.filter(function(x){return x.roster_id===L.me})[0];((m&&m.starters)||[]).forEach(function(id){var g=gameOf(pinfo(id).team);if(g&&g.state==='pre')mine[g.id]=+g.kick})});
  var nk=Object.keys(mine).map(function(k){return mine[k]}).sort(function(a,b){return a-b})[0];
  var hot=QS.get('brief')==='hot'||(et.wd==='Sun'&&et.h>=5&&et.h<13)||(nk&&nk-now<3*36e5&&nk>now);
  var B=D.leagues.map(brief).filter(Boolean),nIss=B.reduce(function(a,b){return a+b.items.filter(function(i){return i.sev>=2}).length},0),nQ=B.reduce(function(a,b){return a+b.items.filter(function(i){return i.sev===1}).length},0);
  var title=et.wd==='Sun'&&et.h<13?'☕ SUNDAY MORNING BRIEFING':'📋 LINEUP BRIEFING';
  var sum=nIss?'<b style="color:var(--ag)">'+nIss+' lineup fix'+(nIss>1?'es':'')+' needed</b>':'<b style="color:var(--for)">No Out, Doubtful, bye or empty starters</b>';if(nQ)sum+=' · <b style="color:var(--gold)">'+nQ+' Questionable</b>';
  if(nk)sum+=' · next of your kickoffs '+ETTIME.format(new Date(nk))+' ET';
  var body=B.map(function(b){var L=b.L,link='https://sleeper.com/leagues/'+L.id+'/team';
    var rows=b.items.map(function(it){var nm=it.l?esc(it.l.pi.n):'';return '<div class="flag"><div class="ic">'+(it.l?head(it.l.id):'⛔')+'</div><div class="fx"><div class="ft">'+(it.l?nm+' <span class="pill '+SEVC[it.sev]+'">'+esc(it.b)+'</span> <span class="muted small">'+esc(it.slot)+(it.body?' · '+esc(it.body):'')+(it.kick?' · '+ETTIME.format(new Date(it.kick))+' ET':'')+'</span>':esc(it.t))+'</div><div class="small">'+swapTxt(it)+'</div></div></div>'}).join('');
    rows+=b.up.map(function(c){return '<div class="flag"><div class="ic">🔁</div><div class="fx"><div class="ft">Start '+esc(c.x.pi.n)+' over '+esc(c.y.pi.n)+' <span class="pill '+(c.lvl===2?'g':'y')+'">'+c.conf.toUpperCase()+'</span></div><div class="small muted">'+f1(c.x.proj)+' vs '+f1(c.y.proj)+' proj (+'+f1(c.gain)+') · '+esc(c.slot)+'</div></div></div>'}).join('');
    var wv=b.wv.length?'<div class="small" style="margin-top:4px">🔥 <span class="muted">Trending free agents:</span> '+b.wv.map(function(x){return esc(x.pi.n)+' '+posChip(x.pi.pos)+' <span class="muted">'+esc(x.pi.team)+' · '+f1(x.pr)+' proj · '+(x.n>=1000?(x.n/1000).toFixed(1)+'k':x.n)+' adds</span>'}).join(' · ')+'</div>':'';
    return '<div class="box bf-l'+(b.items.some(function(i){return i.sev>=2})?' bad':'')+'"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:2px 0">'+esc(L.name)+hq(L)+'</h3><a class="small" href="'+link+'" target="_blank" rel="noopener">Set lineup ↗</a></div>'+(rows||'<div class="small" style="color:var(--for)">✅ Starters all healthy and playing.</div>')+wv+'</div>'}).join('');
  return '<section class="panel brief'+(hot?' hot':'')+'" id="brief"><h2>'+title+' <small>WK '+D.week+'</small></h2><div class="small" style="margin-bottom:6px">'+sum+'</div>'+(hot?'<div class="bfg">'+body+'</div>':'<details'+(nIss||nQ?' open':'')+'><summary class="small" style="cursor:pointer;color:var(--gold)">Per-league details</summary><div class="bfg">'+body+'</div></details>')+stampHTML()+
    '<div class="hint">Only starters whose games haven\'t kicked off. Status: Sleeper live feed + players file, plus ESPN game-day inactives inside 2.5 h of kickoff (ESPN can only add an Out). Swaps use Sleeper projections scored with each league\'s settings.</div></section>'}};
// ---------------- TRADE-VALUE TRACKER ----------------
var VH=null;function vhist(){if(VH)return VH;return (VH=J('data/values_history.json?_='+Math.floor(Date.now()/36e5)).catch(function(){VH=null;return {days:[]}}))}
function spark(pts,W,H,col){if(pts.length<2)return '';var mn=Math.min.apply(null,pts.map(function(p){return p[1]})),mx=Math.max.apply(null,pts.map(function(p){return p[1]}));if(mx===mn){mx+=1;mn-=1}
  var t0=pts[0][0],t1=pts[pts.length-1][0]||t0+1,P=pts.map(function(p){return [5+(p[0]-t0)/Math.max(1,t1-t0)*(W-10),H-6-(p[1]-mn)/(mx-mn)*(H-12)]});
  return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="'+col+'" stroke-width="2" vector-effect="non-scaling-stroke" points="'+P.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ')+'"/><circle cx="'+P[P.length-1][0].toFixed(1)+'" cy="'+P[P.length-1][1].toFixed(1)+'" r="3" fill="'+col+'"/></svg>'}
function cliff(pos,a){return a&&((pos==='RB'&&a>=26.5)||(pos==='WR'&&a>=28.5)||(pos==='TE'&&a>=29.5)||(pos==='QB'&&a>=32))}
function trackerHTML(H){var days=(H&&H.days)||[],now=Date.now(),DAY=864e5;
  // live point: today's in-browser values (same FantasyCalc format per league as the snapshot job)
  var live={},tot=0;D.leagues.forEach(function(L){var t=L.model&&L.model.me;if(!t)return;live[L.id]=Math.round(t.tot);tot+=t.tot});
  // implied point 30 days ago from FantasyCalc's own 30-day trend (until the daily snapshots have a month of history)
  var imp={},impT=0;D.leagues.forEach(function(L){var me=L.model&&L.model.me;if(!me)return;var v=me.pl.reduce(function(a,id){return a+((L.V.p[id]||0)-(L.V.t[id]||0))},0)+me.kv;imp[L.id]=v;impT+=v});
  var series=function(lid){var a=days.filter(function(d){return lid?d.lg[lid]:1}).map(function(d){return [Date.parse(d.d+'T12:00:00Z'),lid?d.lg[lid].tot:Object.keys(d.lg).filter(function(k){return live[k]!=null}).reduce(function(s,k){return s+d.lg[k].tot},0)]});
    var first=a.length?a[0][0]:now;if(first>now-25*DAY)a.unshift([now-30*DAY,lid?imp[lid]:impT]);a.push([now,lid?live[lid]:tot]);return a};
  var all=series(null),d7=function(s){var t=now-7*DAY,p=s.filter(function(x){return x[0]<=t}).pop()||s[0];return s[s.length-1][1]-p[1]},d30=function(s){return s[s.length-1][1]-s[0][1]};
  var lgRows=D.leagues.map(function(L){var s=series(L.id),c=s[s.length-1][1],ch=d30(s);return '<div class="vt-l"><div class="vt-h"><b>'+esc(L.name)+'</b><span>'+int(c)+' <small class="'+(ch>=0?'pe':'ne')+'">'+(ch>=0?'+':'')+int(ch)+'</small></span></div>'+spark(s,240,34,ch>=0?'#7dffb0':'#ff6b6b')+'</div>'}).join('');
  // risers / fallers on Brett's rosters: vs the snapshot ~7 days back (else oldest snapshot ≥2 days old), else FantasyCalc 30-day trend
  var base=null;for(var i=days.length-1;i>=0;i--){if(now-Date.parse(days[i].d+'T12:00:00Z')>=6.5*DAY){base=days[i];break}}if(!base)for(i=0;i<days.length;i++){if(now-Date.parse(days[i].d+'T12:00:00Z')>=2*DAY){base=days[i];break}}
  var P={};D.leagues.forEach(function(L){var me=L.model&&L.model.me,fk=(function(){var q=L.rp.filter(function(p){return p==='QB'}).length,sf=L.rp.indexOf('SUPER_FLEX')>=0;return ((q>=2||sf)?2:1)+':'+Object.keys(L.rosters).length+':'+(L.ppr>=1?1:L.ppr>=0.5?0.5:0)})();if(!me)return;
    me.pl.forEach(function(id){var v=L.V.p[id]||0;if(v<500)return;var then=base&&base.v[fk]&&base.v[fk][id],src;var d;if(then){d=v-then;src='since '+base.d}else{d=L.V.t[id]||0;src='FantasyCalc 30-day'}
      var x=P[id]=P[id]||{id:id,v:v,d:d,src:src,lg:[],pos:pinfo(id).pos,age:(L.V.a[id]||null)};x.lg.push(L)})});
  var arr=Object.keys(P).map(function(k){var x=P[k];x.pct=x.d/Math.max(1,x.v-x.d);return x}).filter(function(x){return x.v-x.d>=600});
  var up=arr.filter(function(x){return x.d>0}).sort(function(a,b){return b.d-a.d}).slice(0,6),dn=arr.filter(function(x){return x.d<0}).sort(function(a,b){return a.d-b.d}).slice(0,6);
  function buyer(x){var out=[];x.lg.forEach(function(L){var M=L.model;if(!M)return;Object.keys(M.teams).forEach(function(k){var t=M.teams[k];if(t.rid!==L.me&&t.mode==='CONTENDER'&&t.holes.indexOf(x.pos)>=0)out.push(ownerOf(L,t.rid).name+' ('+L.name+')')})});return out.slice(0,2)}
  function row(x,isUp){var sell=isUp&&(x.pct>=0.08||cliff(x.pos,x.age)),b=sell?buyer(x):[];
    return '<div class="flag"><div class="ic">'+head(x.id)+'</div><div class="fx"><div class="ft">'+esc(pinfo(x.id).n)+' '+posChip(x.pos)+(sell?' <span class="pill g">SELL-HIGH</span>':'')+(!isUp&&x.pct<=-0.1&&!cliff(x.pos,x.age)?' <span class="pill y">HOLD / BUY-LOW</span>':'')+'</div><div class="small muted">'+(x.d>=0?'+':'')+int(x.d)+' ('+(x.pct>=0?'+':'')+Math.round(x.pct*100)+'%, '+esc(x.src)+') · now '+int(x.v)+(x.age?' · age '+x.age:'')+' · '+x.lg.length+' lg</div>'+
      (sell?'<div class="small">'+(cliff(x.pos,x.age)?'Riding high at an age where '+esc(x.pos)+' values usually slide. ':'Value spike. ')+(b.length?'Contenders thin at '+esc(x.pos)+': <b>'+esc(b.join(', '))+'</b>.':'Shop him to a contender.')+'</div>':'')+'</div></div>'}
  return '<section class="panel vtrack"><h2>📈 Trade-Value Tracker <small>'+int(tot)+' NOW</small></h2>'+
   '<div class="vt-big">'+spark(all,360,90,'#ffc72c')+'<div class="small muted">'+(days.length?'Daily snapshots since '+esc(days[0].d)+' ('+days.length+')':'Daily snapshots start today')+(all.length&&days.length<25?'; first point is implied from FantasyCalc 30-day trends':'')+' · 7d '+(d7(all)>=0?'+':'')+int(d7(all))+' · 30d '+(d30(all)>=0?'+':'')+int(d30(all))+'</div></div>'+
   '<div class="vt-g">'+lgRows+'</div><div class="grid2" style="margin-top:8px"><div><h3>📈 Biggest risers</h3>'+(up.map(function(x){return row(x,true)}).join('')||'<div class="empty">Nobody up.</div>')+'</div><div><h3>📉 Biggest fallers</h3>'+(dn.map(function(x){return row(x,false)}).join('')||'<div class="empty">Nobody down.</div>')+'</div></div>'+
   '<div class="hint">Roster value = FantasyCalc dynasty values for each league\'s format (QB/superflex, size, PPR) on players + owned future picks. A GitHub Action snapshots it every morning into <code>data/values_history.json</code>; the last point is live.</div></section>'}
EXTRA_TABS.forEach(function(t){if(t[0]!=='exposure')return;var orig=t[3];t[3]=function(el){orig(el);WH_ensure().then(function(){return vhist()}).then(function(H){if(curTab()[0]!=='exposure')return;var x=$('#vtrk',el);if(!x){x=document.createElement('div');x.id='vtrk';el.insertBefore(x,el.firstChild)}x.innerHTML=trackerHTML(H)}).catch(function(e){console.warn('tracker',e)})}});
window.resetTabCaches2=function(){VH=null;TR=null};
})();

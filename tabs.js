'use strict';
// Weasel Hub, Priority 2/3 tabs: Rosters, Exposure, Trade Desk, Waivers, Picks, Recap, News.
// All client-side & free: Sleeper public API, FantasyCalc dynasty values, ESPN public fantasy news.
(function(){
var ORD=['','1st','2nd','3rd','4th','5th','6th','7th'];
var NEEDS=['QB','RB','WR','TE'];
function int(n){return Math.round(+n||0).toLocaleString('en-US')}
function ago(t){var m=Math.round((Date.now()-t)/6e4);if(m<1)return 'just now';if(m<60)return m+'m ago';var h=Math.round(m/60);if(h<48)return h+'h ago';return Math.round(h/24)+'d ago'}
function tstr(t){return new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET'}
function spin(t){return '<div class="spin">'+esc(t||'Loading…')+'</div>'}
function pool(fns,n){var out=new Array(fns.length),i=0;function w(){if(i>=fns.length)return Promise.resolve();var k=i++;return fns[k]().then(function(v){out[k]=v},function(){out[k]=null}).then(w)}
  var ws=[];for(var j=0;j<Math.min(n||4,fns.length);j++)ws.push(w());return Promise.all(ws).then(function(){return out})}

// ---------- FantasyCalc values per league format (cached 24h) ----------
function fcParams(L){var qb=L.rp.filter(function(p){return p==='QB'}).length,sf=L.rp.indexOf('SUPER_FLEX')>=0;return {q:(qb>=2||sf)?2:1,n:Object.keys(L.rosters).length,ppr:L.ppr>=1?1:L.ppr>=0.5?0.5:0}}
var _fc={};
function values(L){var p=fcParams(L),key='wh:fc:'+p.q+':'+p.n+':'+p.ppr;if(_fc[key])return _fc[key];
  var c=LS.get(key);if(c&&Date.now()-c.at<864e5)return (_fc[key]=Promise.resolve(c));
  return (_fc[key]=J('https://api.fantasycalc.com/values/current?isDynasty=true&numQbs='+p.q+'&numTeams='+p.n+'&ppr='+p.ppr).then(function(d){
    var v={at:Date.now(),p:{},a:{},t:{},e:{},pk:{}};d.forEach(function(x){var pl=x.player||{};if(pl.position==='PICK'){v.pk[pl.name]=x.value;return}if(!pl.sleeperId)return;
      v.p[pl.sleeperId]=x.value;if(pl.maybeAge)v.a[pl.sleeperId]=Math.round(pl.maybeAge*10)/10;if(x.trend30Day)v.t[pl.sleeperId]=x.trend30Day;if(pl.espnId)v.e[pl.sleeperId]=pl.espnId});
    LS.set(key,v);return v}).catch(function(e){D.errors.push('FantasyCalc unavailable: '+e.message);return c||{at:0,p:{},a:{},t:{},e:{},pk:{}}}))}
function pickValue(V,season,round,slot,n){var tier=slot?(slot<=n/3?' (Early)':slot>2*n/3?' (Late)':' (Mid)'):'';
  return V.pk[season+' '+ORD[round]+tier]||V.pk[season+' '+ORD[round]]||V.pk[season+' '+ORD[round]+' (Mid)']||(V.pk[(season-1)+' '+ORD[round]]||0)*0.9||0}

// ---------- shared extra data ----------
var X=null;
function ensure(){if(X)return X;
  X=Promise.all([loadPlayers().then(function(p){D.players=p}).catch(function(e){D.errors.push('Players DB: '+e.message)})].concat((D.allLeagues||D.leagues).map(function(L){return values(L).then(function(v){L.V=v})}))).then(function(){
    (D.allLeagues||D.leagues).forEach(function(L){L.model=teamModel(L)});return D}).catch(function(e){X=null;throw e});
  return X}
window.WH_ensure=function(){return ensure()};
function pos(id){var pi=pinfo(id);return pi.pos==='?'&&D.players&&D.players[id]?D.players[id].p[0]:pi.pos}
function age(L,id){return (L.V&&L.V.a[id])||(D.players&&D.players[id]&&D.players[id].a)||null}
function val(L,id){return (L.V&&L.V.p[id])||0}
function needCount(L){var sf=L.rp.indexOf('SUPER_FLEX')>=0||L.rp.filter(function(p){return p==='QB'}).length>=2;return {QB:sf?2:1,RB:3,WR:4,TE:1}}
// pick ownership: every future pick (season+1..+3) with current owner
function pickOwnership(L){var yr=+L.raw.season,rounds=(L.raw.settings||{}).draft_rounds||4,own={},rids=Object.keys(L.rosters).map(Number);
  for(var s=yr+1;s<=yr+3;s++)for(var r=1;r<=rounds;r++)rids.forEach(function(o){own[s+'-'+r+'-'+o]={season:s,round:r,orig:o,owner:o}});
  (L.traded||[]).forEach(function(t){var k=t.season+'-'+t.round+'-'+t.roster_id;if(own[k])own[k].owner=t.owner_id});
  return Object.keys(own).map(function(k){return own[k]})}
function teamModel(L){var st=standings(L),n=Object.keys(L.rosters).length,NC=needCount(L),picks=pickOwnership(L),teams={};
  Object.keys(L.rosters).forEach(function(k){var r=L.rosters[k],rid=+k,pl=(r.players||[]).filter(function(p){return !(r.taxi||[]).length||true});
    var by={};NEEDS.forEach(function(p){by[p]=pl.filter(function(id){return pos(id)===p}).sort(function(a,b){return val(L,b)-val(L,a)})});
    var sv={};NEEDS.forEach(function(p){sv[p]=by[p].slice(0,NC[p]).reduce(function(a,id){return a+val(L,id)},0)});
    var pv=pl.reduce(function(a,id){return a+val(L,id)},0);
    var mp=picks.filter(function(p){return p.owner===rid}).map(function(p){var s=st[p.orig]||{};return Object.assign({},p,{v:pickValue(L.V,p.season,p.round,p.season===+L.raw.season+1?s.slot:null,n)})});
    var kv=mp.reduce(function(a,p){return a+p.v},0);
    var core=pl.filter(function(id){return val(L,id)>0}).sort(function(a,b){return val(L,b)-val(L,a)}).slice(0,12);
    var cAge=core.reduce(function(a,id){return a+(age(L,id)||26)},0)/Math.max(1,core.length);
    var m=L.mu.filter(function(x){return x.roster_id===rid})[0],starters=(m&&m.starters||r.starters||[]).filter(function(x){return x&&x!=='0'});
    var sAge=starters.filter(function(id){return !isNaN(+id)}).map(function(id){return age(L,id)}).filter(Boolean);
    teams[rid]={rid:rid,r:r,st:st[rid]||{},by:by,sv:sv,pv:pv,kv:kv,tot:pv+kv,picks:mp,cAge:cAge,sAge:sAge.length?sAge.reduce(function(a,b){return a+b},0)/sAge.length:null,starters:starters,pl:pl}});
  var avg={};NEEDS.forEach(function(p){avg[p]=Object.keys(teams).reduce(function(a,k){return a+teams[k].sv[p]},0)/n||1});
  var byVal=Object.keys(teams).map(function(k){return teams[k]}).sort(function(a,b){return b.tot-a.tot});byVal.forEach(function(t,i){t.vRank=i+1});
  var byStart=Object.keys(teams).map(function(k){return teams[k]}).sort(function(a,b){return (NEEDS.reduce(function(x,p){return x+b.sv[p]},0))-(NEEDS.reduce(function(x,p){return x+a.sv[p]},0))});byStart.forEach(function(t,i){t.sRank=i+1});
  Object.keys(teams).forEach(function(k){var t=teams[k],s=t.st,g=Math.max(1,s.w+s.l+s.t),wp=(s.w+s.t/2)/g;
    t.ratio={};NEEDS.forEach(function(p){t.ratio[p]=t.sv[p]/avg[p]});
    t.holes=NEEDS.filter(function(p){return t.ratio[p]<0.8}).sort(function(a,b){return t.ratio[a]-t.ratio[b]});
    t.surplus=NEEDS.filter(function(p){return t.ratio[p]>=1.15}).sort(function(a,b){return t.ratio[b]-t.ratio[a]});
    // contender score 0-100: record (45%), starting-lineup value rank (35%), points-for rank (20%)
    var sPct=1-(t.sRank-1)/Math.max(1,n-1),pfPct=1-((s.pfRank||n)-1)/Math.max(1,n-1);
    t.cs=Math.round(100*(0.45*wp+0.35*sPct+0.20*pfPct));
    t.mode=t.cs>=60?'CONTENDER':t.cs<=40?'REBUILD':'TWEENER';
    t.read=t.cs>=60?(t.cAge>=26.5?'BUY now: window is open, vets age fast':'BUY: young core and winning'):t.cs<=40?(t.cAge>=26?'SELL vets 26+ for picks/youth':'HOLD youth, buy cheap picks'):(t.cAge>=26.5?'Lean SELL: aging middle of the pack':'HOLD: one move from contending')});
  return {teams:teams,me:teams[L.me],n:n,avg:avg,picks:picks,st:st}}

// ---------- render helpers ----------
function pill(mode){return '<span class="pill '+(mode==='CONTENDER'?'g':mode==='REBUILD'?'r':'y')+'">'+mode+'</span>'}
function pname(id){return esc(pinfo(id).n)}
function needData(el,f){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No active leagues.</div>';return}
  el.innerHTML='<section class="panel">'+spin('Crunching values…')+'</section>';var tab=curTab()[0];
  ensure().then(function(){if(curTab()[0]!==tab)return;try{f(el)}catch(e){console.error(e);el.innerHTML='<div class="panel err">'+esc(e.message)+'</div>'}}).catch(function(e){el.innerHTML='<div class="panel err">Could not load: '+esc(e.message)+'</div>'})}
var CREDIT='<div class="hint" style="margin-top:8px">Values: <a href="https://fantasycalc.com" target="_blank" rel="noopener">FantasyCalc</a> dynasty (matched to each league\'s QB format, size and PPR), refreshed daily.</div>';

// ---------- MY ROSTERS ----------
function renderRosters(el){needData(el,function(){
  var html='<section class="panel"><h2>👥 My Rosters <small>'+D.leagues.length+' TEAMS</small></h2><div class="grid2">'+D.leagues.map(function(L){var t=L.model.me,s=t.st,n=L.model.n;
    var top=t.pl.slice().sort(function(a,b){return val(L,b)-val(L,a)}).slice(0,8);
    return '<div class="box"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:2px 0">'+esc(L.name)+'</h3>'+pill(t.mode)+'</div>'+
    '<div class="small muted">'+esc(ownerOf(L,L.me).name)+' · '+s.w+'-'+s.l+(s.t?'-'+s.t:'')+' · #'+s.rank+' of '+n+'</div>'+
    '<table style="margin-top:6px"><tr><td>Dynasty value</td><td><b>'+int(t.tot)+'</b> <span class="muted">(#'+t.vRank+')</span></td></tr><tr><td>Players / picks</td><td>'+int(t.pv)+' / '+int(t.kv)+'</td></tr><tr><td>Avg starter age</td><td>'+(t.sAge?t.sAge.toFixed(1):'–')+' <span class="muted">(core '+t.cAge.toFixed(1)+')</span></td></tr><tr><td>Contender score</td><td><b>'+t.cs+'</b>/100</td></tr><tr><td>Read</td><td class="w" style="text-align:right">'+esc(t.read)+'</td></tr><tr><td>Positional holes</td><td class="w" style="text-align:right">'+(t.holes.length?t.holes.map(function(p){return '<span class="pill r">'+p+' '+Math.round(t.ratio[p]*100)+'%</span>'}).join(' '):'<span class="pill g">none</span>')+'</td></tr><tr><td>Strengths</td><td class="w" style="text-align:right">'+(t.surplus.map(function(p){return '<span class="pill g">'+p+' '+Math.round(t.ratio[p]*100)+'%</span>'}).join(' ')||'–')+'</td></tr></table>'+
    '<h3>Top assets</h3>'+top.map(function(id){return '<div class="lu p" style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--line);font-size:12.5px"><span>'+posChip(pos(id))+' '+pname(id)+(age(L,id)?' <span class="muted">'+age(L,id)+'</span>':'')+'</span><b>'+int(val(L,id))+'</b></div>'}).join('')+
    '<a class="small" href="https://sleeper.com/leagues/'+L.id+'/team" target="_blank" rel="noopener">Open in Sleeper ↗</a></div>'}).join('')+'</div><div class="hint" style="margin-top:8px">Position strength = value of your top QB'+'/RB/WR/TE starters vs the league average (100%). Holes are under 80%.</div>'+CREDIT+'</section>';
  html+='<section class="panel"><h2>🗓️ Bye Planner</h2><div class="hint">Your <b>core lineup</b> = best starters from the whole roster (season points per game in this league\'s scoring, blended with this week\'s projection; FantasyCalc value breaks ties), ignoring byes and short injuries. Each week: 🛌 core starters on bye, 🚑 injured (Out/Doubtful this week; IR/PUP treated as out for the next 4 weeks until activated), and the points lost vs the best fill-in lineup. Red = unfillable slot or a big loss; gold = moderate loss or 3+ out. Past weeks dimmed (byes only). Tap a week for the slot-by-slot fill-ins. Full league buy/sell reads now live on <a href="#scout">Scout</a>.</div><div id="byep"><div class="spin">Loading schedule…</div></div></section>';
  el.innerHTML=html;if(window.byePlannerHTML)byePlannerHTML().then(function(h){var b=$('#byep');if(b){b.innerHTML=h;if(window.byeBind)byeBind(b)}})})}

// ---------- EXPOSURE (+ value alerts, portfolio chart) ----------
function renderExposure(el){needData(el,function(){
  var agg={},total=0,pickTot=0;D.leagues.forEach(function(L){var t=L.model.me;pickTot+=t.kv;t.pl.forEach(function(id){var v=val(L,id);total+=v;var a=agg[id]=agg[id]||{id:id,v:0,lg:[],start:0,tr:0};a.v+=v;a.lg.push(L.name);if(t.starters.indexOf(id)>=0)a.start++;a.tr+=(L.V.t[id]||0)})});
  var list=Object.keys(agg).map(function(k){return agg[k]}).sort(function(a,b){return b.v-a.v||b.lg.length-a.lg.length});
  var multi=list.filter(function(a){return a.lg.length>1}).length;
  // portfolio snapshot (one per day)
  var hist=LS.get('wh:port')||[],today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  var cur={d:today,v:Math.round(total+pickTot),p:Math.round(pickTot)};if(hist.length&&hist[hist.length-1].d===today)hist[hist.length-1]=cur;else hist.push(cur);hist=hist.slice(-180);LS.set('wh:port',hist);
  // injury concentration
  var injV=0,injL=[],oldV=0;list.forEach(function(a){var pi=pinfo(a.id);if(pi.inj&&pi.inj!=='Active'){injV+=a.v;injL.push(a)}var ag=age(D.leagues[0],a.id),p=pos(a.id);if(ag&&((p==='RB'&&ag>=27)||(p!=='RB'&&ag>=30)))oldV+=a.v});
  var teamV={};list.forEach(function(a){var t=pinfo(a.id).team||'FA';teamV[t]=(teamV[t]||0)+a.v});var teamL=Object.keys(teamV).map(function(k){return [k,teamV[k]]}).sort(function(a,b){return b[1]-a[1]}).slice(0,5);
  // value alerts: compare to snapshot (>=6 days old), else FantasyCalc 30-day trend
  var snap=LS.get('wh:valsnap');var base=null;if(snap&&Date.now()-snap.at>=6*864e5)base=snap;
  if(!snap||Date.now()-snap.at>=7*864e5){var o={};list.forEach(function(a){o[a.id]=a.v});LS.set('wh:valsnap',{at:Date.now(),v:o,prev:snap&&snap.v,prevAt:snap&&snap.at})}
  else if(snap.prev){base={at:snap.prevAt,v:snap.prev}}
  var alerts=list.filter(function(a){return a.v>=1500}).map(function(a){var d,src;if(base&&base.v[a.id]){d=(a.v-base.v[a.id])/base.v[a.id];src='since '+new Date(base.at).toLocaleDateString()}else{var tr=a.tr,pv=a.v-tr;d=pv>0?tr/pv:0;src='30-day trend'}return {a:a,d:d,src:src}}).filter(function(x){return Math.abs(x.d)>=0.08}).sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d)}).slice(0,12);
  function chart(){if(hist.length<2)return '<div class="hint">Chart fills in as you visit (one snapshot per day). Today: <b>'+int(cur.v)+'</b>.</div>';var W=360,H=110,mn=Math.min.apply(null,hist.map(function(h){return h.v})),mx=Math.max.apply(null,hist.map(function(h){return h.v}));if(mx===mn){mx+=1;mn-=1}
    var pts=hist.map(function(h,i){return [(i/(hist.length-1))*(W-10)+5,H-8-(h.v-mn)/(mx-mn)*(H-24)]});
    return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="Portfolio value"><polyline fill="none" stroke="#ffc72c" stroke-width="2.5" points="'+pts.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' ')+'"/>'+pts.map(function(p,i){return i===pts.length-1?'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#ffc72c"/>':''}).join('')+'<text x="5" y="12" fill="#8d97aa" font-size="10">'+int(mx)+'</text><text x="5" y="'+(H-1)+'" fill="#8d97aa" font-size="10">'+int(mn)+'</text></svg><div class="small muted">'+esc(hist[0].d)+' → '+esc(today)+' · now '+int(cur.v)+'</div>'}
  el.innerHTML='<section class="panel"><h2>📊 Portfolio <small>'+int(total+pickTot)+' TOTAL</small></h2>'+chart()+'<div class="small muted">Players '+int(total)+' · picks '+int(pickTot)+' across '+D.leagues.length+' leagues.</div></section>'+
  '<section class="panel"><h2>🧲 Exposure <small>'+list.length+' PLAYERS · '+multi+' IN 2+</small></h2><div class="tw"><table><tr><th>Player</th><th>Lg</th><th>Value</th><th>Share</th></tr>'+list.slice(0,30).map(function(a){var pi=pinfo(a.id);return '<tr><td class="w">'+posChip(pos(a.id))+' '+esc(pi.n)+(pi.inj?' <span class="inj">'+esc(pi.inj.slice(0,4).toUpperCase())+'</span>':'')+'<span class="muted small" style="display:block">'+esc(a.lg.join(', '))+'</span></td><td>'+a.lg.length+'</td><td>'+int(a.v)+'</td><td><b>'+(a.v/Math.max(1,total)*100).toFixed(1)+'%</b></td></tr>'}).join('')+'</table></div></section>'+
  '<section class="panel"><h2>🚑 Risk Concentration</h2><table><tr><td>Value on the injury report (incl. Q)</td><td><b style="color:'+(injV/total>0.15?'var(--ag)':'var(--ink)')+'">'+(injV/Math.max(1,total)*100).toFixed(1)+'%</b></td></tr><tr><td>Value in age-cliff players (RB 27+, others 30+)</td><td><b>'+(oldV/Math.max(1,total)*100).toFixed(1)+'%</b></td></tr>'+teamL.map(function(t){return '<tr><td>'+esc(t[0])+' stack</td><td>'+(t[1]/Math.max(1,total)*100).toFixed(1)+'%</td></tr>'}).join('')+'</table>'+(injL.length?'<div class="small" style="margin-top:6px">Injured: '+injL.slice(0,12).map(function(a){var pi=pinfo(a.id);return esc(pi.n)+' ('+esc(pi.inj)+', '+a.lg.length+' lg)'}).join(', ')+'</div>':'')+'</section>'+
  '<section class="panel"><h2>💹 Value Alerts</h2><div class="hint">Big FantasyCalc moves on your players. Rising = sell-high window; falling = buy-low (don\'t panic-sell, maybe add more).</div>'+(alerts.length?alerts.map(function(x){var up=x.d>0;return '<div class="flag"><div class="ic">'+(up?'📈':'📉')+'</div><div class="fx"><div class="ft">'+pname(x.a.id)+' <span class="pill '+(up?'g':'r')+'">'+(up?'SELL-HIGH':'BUY-LOW')+'</span></div><div class="small muted">'+(up?'+':'')+Math.round(x.d*100)+'% ('+esc(x.src)+') · now '+int(x.a.v)+' · '+esc(x.a.lg.join(', '))+'</div></div></div>'}).join(''):'<div class="empty">No big moves.</div>')+CREDIT+'</section>'})}

// ---------- TRADE DESK (Fleece-Factory-style, Brett's side only) ----------
function combos(arr,n){var out=[];(function f(i,cur){if(cur.length)out.push(cur);if(cur.length===n)return;for(var j=i;j<arr.length;j++)f(j+1,cur.concat([arr[j]]))})(0,[]);return out}
function tradeIdeas(L){var M=L.model,A=M.me,ideas=[];var top={};Object.keys(M.teams).forEach(function(k){M.teams[k].pl.forEach(function(id){top[id]=val(L,id)})});
  var ranked=Object.keys(top).filter(function(id){return NEEDS.indexOf(pos(id))>=0}).sort(function(a,b){return top[b]-top[a]}),big={};ranked.slice(0,Math.round(M.n*5)).forEach(function(id){big[id]=1});
  function asset(id){return {k:'p',id:id,v:val(L,id),pos:pos(id),age:age(L,id)||26,big:!!big[id]}}
  var need=A.holes.length?A.holes:NEEDS.slice().sort(function(a,b){return A.ratio[a]-A.ratio[b]}).slice(0,1);var surplus=A.surplus.filter(function(p){return need.indexOf(p)<0});
  var give=[];surplus.forEach(function(p){A.by[p].slice(A.ratio[p]>1.3?0:1).forEach(function(id){if(val(L,id)>=800)give.push(asset(id))})});
  NEEDS.forEach(function(p){if(need.indexOf(p)<0&&surplus.indexOf(p)<0)A.by[p].slice(Math.max(1,needCount(L)[p])).forEach(function(id){if(val(L,id)>=800)give.push(asset(id))})});
  A.picks.filter(function(p){return p.v>=800}).forEach(function(p){give.push({k:'k',id:p.season+'-'+p.round+'-'+p.orig,v:p.v,pos:'PICK',s:p.season,r:p.round,o:p.orig,age:21,big:p.round===1})});
  give=give.sort(function(a,b){return b.v-a.v}).slice(0,8);
  Object.keys(M.teams).forEach(function(k){var B=M.teams[k];if(B.rid===L.me)return;
    var anchors=[];need.forEach(function(p){B.by[p].forEach(function(id,i){if(big[id]&&(B.ratio[p]>=1||(B.mode==='REBUILD'&&(age(L,id)||26)>=27)||i>=needCount(L)[p]))anchors.push(asset(id))})});
    anchors.slice(0,3).forEach(function(an){combos(give,3).forEach(function(g){if(g.length<2)return;var gv=g.reduce(function(a,x){return a+x.v},0),d=Math.abs(gv-an.v)/Math.max(gv,an.v);if(d>0.10)return;
      var fits=g.some(function(x){return x.k==='k'?B.mode!=='CONTENDER':B.holes.indexOf(x.pos)>=0||B.ratio[x.pos]<1});if(!fits)return;
      var sc=an.v/3000+(1.1-A.ratio[an.pos])*2-d*3-(g.length-1)*0.3;var ga=g.reduce(function(a,x){return a+x.age},0)/g.length;
      if(A.mode==='CONTENDER'&&B.mode!=='CONTENDER'&&an.age>ga)sc+=1;if(A.mode==='REBUILD'&&B.mode==='CONTENDER'&&an.age<ga)sc+=1;
      ideas.push({B:B,get:[an],give:g,gv:gv,d:d,sc:sc})})})});
  ideas.sort(function(a,b){return b.sc-a.sc});var out=[],used={};ideas.forEach(function(c){if(out.length>=3)return;if(out.some(function(o){return o.B===c.B}))return;if(c.give.concat(c.get).some(function(x){return used[x.id]}))return;out.push(c);c.give.concat(c.get).forEach(function(x){used[x.id]=1})});
  return {need:need,surplus:surplus,out:out}}
var PITCH=["{B} has {Y} sitting at a spot they're deep at. You need a {pa}. Send it.","Within {d}% on value. Nobody gets fleeced. Allegedly.","{B} needs {pb} help; you need a {pa}. This is a real trade, not a lowball.","Fair on paper. Someone will still cry about it in the group chat."];
function renderTrade(el){needData(el,function(){
  el.innerHTML='<section class="panel"><h2>🧶 Trade Desk</h2><div class="hint">Value-balanced ideas (within 10% on FantasyCalc) that fill <b>your</b> weakest spot with a top asset from a team that can spare it, paid with your surplus and picks. Same logic as the league site\'s Fleece Factory.</div>'+D.leagues.map(function(L){var T=tradeIdeas(L),A=L.model.me;
    function lab(x){return x.k==='p'?posChip(x.pos)+' '+pname(x.id)+' <span class="muted small">'+(x.age?x.age+' · ':'')+int(x.v)+'</span>':'<span class="pill y">PICK</span> '+x.s+' '+ORD[x.r]+(x.o!==L.me?' <span class="muted small">('+esc(ownerOf(L,x.o).name)+')</span>':'')+' <span class="muted small">'+int(x.v)+'</span>'}
    return '<h3>'+esc(L.name)+' '+pill(A.mode)+'</h3><div class="small muted">Need: '+T.need.join(', ')+' · surplus: '+(T.surplus.join(', ')||'none')+'</div>'+(T.out.length?T.out.map(function(c,i){var line=PITCH[(i+(+L.id.slice(-2)))%PITCH.length].replace(/\{(\w+)\}/g,function(m,q){return '<b>'+esc({B:ownerOf(L,c.B.rid).name,Y:pinfo(c.get[0].id).n,pa:c.get[0].pos,pb:(c.B.holes[0]||c.give[0].pos),d:Math.round(c.d*100)}[q])+'</b>'});
      return '<div class="box" style="margin:6px 0"><div class="grid2" style="grid-template-columns:1fr 1fr;gap:8px"><div><div class="small" style="color:var(--for)">YOU GET · '+int(c.get[0].v)+'</div>'+c.get.map(function(x){return '<div>'+lab(x)+'</div>'}).join('')+'</div><div><div class="small" style="color:var(--ag)">'+esc(ownerOf(L,c.B.rid).name)+' GETS · '+int(c.gv)+'</div>'+c.give.map(function(x){return '<div>'+lab(x)+'</div>'}).join('')+'</div></div><div class="small" style="margin-top:4px">'+line+'</div></div>'}).join(''):'<div class="empty">No balanced fit right now.</div>')}).join('')+CREDIT+'</section>'})}

// ---------- WAIVERS ----------
var _trend=null;
function trending(){if(_trend)return _trend;return (_trend=Promise.all([SC(SAPI+'/v1/players/nfl/trending/add?lookback_hours=24&limit=50',30*6e4),SC(SAPI+'/v1/players/nfl/trending/drop?lookback_hours=24&limit=50',30*6e4)]).then(function(r){var a={},d={};(r[0]||[]).forEach(function(x){a[x.player_id]=x.count});(r[1]||[]).forEach(function(x){d[x.player_id]=x.count});return {add:a,drop:d}}).catch(function(){return {add:{},drop:{}}}))}
function renderWaivers(el){needData(el,function(){trending().then(function(TR){
  el.innerHTML='<section class="panel"><h2>🧺 Waivers</h2><div class="hint">Best available free agents per league, weak positions first. Score blends dynasty value with this week\'s projection; 🔥 = trending adds on Sleeper (24h).</div>'+D.leagues.map(function(L){var taken={};Object.keys(L.rosters).forEach(function(k){(L.rosters[k].players||[]).forEach(function(p){taken[p]=1})});
    var A=L.model.me,cand={};Object.keys(L.V.p).forEach(function(id){cand[id]=1});Object.keys(D.proj).forEach(function(id){if((D.proj[id].s||{}).pts_ppr>=3)cand[id]=1});
    var okPos={};L.slots.forEach(function(sl){(ELIG[sl]||[sl]).forEach(function(p){okPos[p]=1})});
    var fa=Object.keys(cand).filter(function(id){return !taken[id]&&okPos[pos(id)]&&(NEEDS.indexOf(pos(id))>=0||pos(id)==='K'||pos(id)==='DEF')&&pinfo(id).team}).map(function(id){var pr=projFor(L,id),v=val(L,id);return {id:id,v:v,pr:pr,sc:v/150+pr+(A.holes.indexOf(pos(id))>=0?4:0)+(TR.add[id]?Math.min(4,TR.add[id]/2500):0)}}).filter(function(x){return x.v>0||x.pr>=4}).sort(function(a,b){return b.sc-a.sc});var seenKD={};fa=fa.filter(function(x){var p=pos(x.id);if(p!=='K'&&p!=='DEF')return true;if(seenKD[p])return false;seenKD[p]=1;return true}).slice(0,8);
    var bud=(L.raw.settings||{}).waiver_budget||0,used=((L.rosters[L.me].settings||{}).waiver_budget_used)||0;
    return '<h3>'+esc(L.name)+'</h3><div class="small muted">Holes: '+(A.holes.join(', ')||'none')+(bud?' · FAAB $'+(bud-used)+' of $'+bud:'')+' · <a href="https://sleeper.com/leagues/'+L.id+'/players" target="_blank" rel="noopener">Sleeper players ↗</a></div><div class="tw"><table><tr><th>Player</th><th>Value</th><th>Wk '+D.week+'</th></tr>'+fa.map(function(x){var pi=pinfo(x.id);return '<tr><td class="w">'+posChip(pos(x.id))+' '+esc(pi.n)+' <span class="muted small">'+esc(pi.team||'')+'</span>'+(A.holes.indexOf(pos(x.id))>=0?' <span class="pill g">FILLS HOLE</span>':'')+(TR.add[x.id]?' 🔥':'')+(pi.inj?' <span class="inj">'+esc(pi.inj.slice(0,4).toUpperCase())+'</span>':'')+'</td><td>'+int(x.v)+'</td><td>'+f1(x.pr)+'</td></tr>'}).join('')+'</table></div>'}).join('')+'<div id="byew">'+spin('Checking bye weeks…')+'</div>'+CREDIT+'</section>';byeTargets(el,TR)})})}
// bye-aware targets: for each league's worst upcoming week (or the week linked from the Bye Planner), FAs at the needed spots whose team plays that week
function byeTargets(el,TR){var hp=(location.hash||'').slice(1).split('/'),fl=hp[1],fw=+hp[2]||0;
  var need=D.leagues.some(function(L){return !window.BYEP||!BYEP[L.id]});
  Promise.all([need&&window.byePlannerHTML?byePlannerHTML():null,window.BYESCHED?BYESCHED():null]).then(function(r){var played=r[1],box=$('#byew',el);if(!box||curTab()[0]!=='waivers')return;if(!played){box.innerHTML='';return}
    box.innerHTML='<h2 style="margin-top:16px">🛌 Bye-Week Targets</h2><div class="hint">From the Bye Planner: each league\'s worst upcoming week (most unfillable slots, then most points lost). Free agents at the positions you\'re short that week whose team actually plays; unfillable slots first, then this week\'s projection + dynasty value.</div>'+D.leagues.map(function(L){var B=BYEP[L.id];if(!B)return '';
      var wk=fl===L.id&&fw&&B.weeks[fw]?B.weeks[fw]:Object.keys(B.weeks).map(function(k){return B.weeks[k]}).filter(function(x){return x.w>=D.week}).sort(function(a,b){return b.holes-a.holes||b.loss-a.loss})[0];
      if(!wk||(!wk.holes&&wk.loss<3))return '<h3>'+esc(L.name)+'</h3><div class="small muted">No real bye trouble ahead ✅</div>';
      var pw=played[wk.w]||{},posNeed={},why=[];
      wk.F.by.forEach(function(id,i){if(!id){(ELIG[L.slots[i]]||[L.slots[i]]).forEach(function(p){posNeed[p]=(posNeed[p]||0)+2});why.push(L.slots[i]+' unfillable')}});
      wk.out.forEach(function(o){var p=pinfo(o.id).pos;posNeed[p]=(posNeed[p]||0)+1});
      var taken={};Object.keys(L.rosters).forEach(function(k){(L.rosters[k].players||[]).forEach(function(p){taken[p]=1})});
      var cand={};Object.keys(L.V.p).forEach(function(id){cand[id]=1});Object.keys(D.proj).forEach(function(id){cand[id]=1});
      var fa=Object.keys(cand).filter(function(id){var pi=pinfo(id);return !taken[id]&&pi.team&&pw[pi.team]&&posNeed[pi.pos]&&!HARD_INJ[pi.inj]}).map(function(id){var pr=projFor(L,id),v=val(L,id);return {id:id,pr:pr,v:v,sc:pr+v/400+posNeed[pinfo(id).pos]*4+(TR.add[id]?1:0)}}).filter(function(x){return x.pr>0.5||x.v>0}).sort(function(a,b){return b.sc-a.sc});
      var per={},top=fa.filter(function(x){var p=pinfo(x.id).pos;per[p]=(per[p]||0)+1;return per[p]<=3}).slice(0,6);
      var outs=wk.out.map(function(o){return esc(pinfo(o.id).n.split(' ').slice(-1)[0])+(o.u.k==='bye'?' (bye)':' ('+esc(o.u.t.split(' ')[0])+')')}).join(', ');
      return '<h3 id="bw-'+L.id+'">'+esc(L.name)+' · W'+wk.w+'</h3><div class="small muted">'+(why.length?'<b style="color:var(--ag)">'+esc(why.join(', '))+'</b> · ':'')+'−'+f1(wk.loss)+' pts vs core · out: '+outs+'</div>'+
        (top.length?'<div class="tw"><table><tr><th>Free agent</th><th>Value</th><th>Wk '+D.week+' proj</th></tr>'+top.map(function(x){var pi=pinfo(x.id);return '<tr><td class="w">'+posChip(pi.pos)+' '+esc(pi.n)+' <span class="muted small">'+esc(pi.team)+' plays W'+wk.w+'</span>'+(TR.add[x.id]?' 🔥':'')+(pi.inj?' <span class="inj">'+esc(pi.inj.slice(0,4).toUpperCase())+'</span>':'')+'</td><td>'+int(x.v)+'</td><td>'+f1(x.pr)+'</td></tr>'}).join('')+'</table></div>':'<div class="small muted">No free agents at '+Object.keys(posNeed).join('/')+' who play W'+wk.w+'.</div>')}).join('');
    if(fl){var tg=$('#bw-'+fl,el);if(tg)tg.scrollIntoView({block:'start'})}}).catch(function(e){console.warn('byeTargets',e);var b=$('#byew',el);if(b)b.innerHTML=''})}

// ---------- PICKS (+ full Pick Watch, rookie watch) ----------
function renderPicks(el){needData(el,function(){
  var all=[];D.leagues.forEach(function(L){L.model.me.picks.forEach(function(p){all.push({L:L,p:p})})});
  var tot=all.reduce(function(a,x){return a+x.p.v},0);
  var pw=(D.M||(D.M=computeAll())).picks;
  el.innerHTML='<section class="panel"><h2>🎯 Pick Watch</h2><div class="hint">Other teams\' 1sts/2nds you own. Projected slot uses the league rule (checked against last May\'s drafts): non-playoff teams pick by <b>lowest max PF</b> (Sleeper potential points), playoff teams after. Max PF is projected to season end: total so far + this week\'s best lineup + the remaining weeks at each team\'s average. Early/Mid/Late values follow that slot. You want these teams to score <b>low potential points</b>, bench included; their W/L only matters if they\'re near the playoff line. Reference only: the Sunday Rooting Guide covers just your own matchups.</div>'+(pw.length?(window.PWV?(function(){var cs=PWV.cards();return '<div class="small" style="margin:4px 0 8px">'+PWV.summary(cs)+'</div><div class="pwg">'+cs.map(function(t){return PWV.card(t,true)}).join('')+'</div>'})():pw.slice().sort(function(a,b){return b.p.w-a.p.w}).map(pickRow).join('')):'<div class="empty">Open the Sunday tab first, or you own no other teams\' 1sts/2nds.</div>')+'</section>'+pickRootHTML(pw)+
  '<section class="panel"><h2>🎟️ All My Picks <small>'+all.length+' PICKS · '+int(tot)+'</small></h2>'+D.leagues.map(function(L){var ps=L.model.me.picks.slice().sort(function(a,b){return a.season-b.season||a.round-b.round});
    return '<h3>'+esc(L.name)+'</h3><div class="tw"><table><tr><th>Pick</th><th>From</th><th>Max PF</th><th>Proj</th><th>Value</th></tr>'+ps.map(function(p){var s=L.model.st[p.orig]||{},near=p.season===+L.raw.season+1;return '<tr><td>'+p.season+' '+ORD[p.round]+'</td><td class="w">'+(p.orig===L.me?'<span class="muted">own</span>':esc(ownerOf(L,p.orig).name))+'</td><td>'+(near&&s.mpf!=null?int(s.mpf):'–')+'</td><td>'+(near&&s.slot?'#'+p.round+'.'+String(s.slot).padStart(2,'0'):'–')+'</td><td>'+int(p.v)+'</td></tr>'}).join('')+'</table></div>'}).join('')+CREDIT+'</section>'+
  '<section class="panel"><h2>🍼 Rookie Watch</h2><div id="rook">'+spin('Loading your drafts…')+'</div></section>';
  rookieWatch().then(function(h){var r=$('#rook');if(r)r.innerHTML=h}).catch(function(e){var r=$('#rook');if(r)r.innerHTML='<div class="err">'+esc(e.message)+'</div>'})})}
var _sp={};
function seasonPts(L){if(_sp[L.id])return _sp[L.id];var last=D.week-1,fns=[];for(var w=1;w<=last;w++)(function(w){fns.push(function(){return SC(SAPI+'/v1/league/'+L.id+'/matchups/'+w,36e5)})})(w);
  return (_sp[L.id]=pool(fns,3).then(function(arr){var t={};arr.forEach(function(ms){(ms||[]).forEach(function(m){var pp=m.players_points||{};for(var k in pp)t[k]=(t[k]||0)+(+pp[k]||0)})});return t}))}
function rookieWatch(){return Promise.all(D.leagues.map(function(L){var ids=[L.id];if(L.raw.previous_league_id&&L.raw.previous_league_id!=='0')ids.push(L.raw.previous_league_id);
  return Promise.all([Promise.all(ids.map(function(id){return SC(SAPI+'/v1/league/'+id+'/drafts',864e5).catch(function(){return []})})),seasonPts(L)]).then(function(r){
    var drafts=[].concat.apply([],r[0]).filter(function(d){return d.status==='complete'&&(d.settings||{}).rounds<=6});
    return Promise.all(drafts.map(function(d){return SC(SAPI+'/v1/draft/'+d.draft_id+'/picks',864e5).then(function(p){return {d:d,p:p}})})).then(function(ds){return {L:L,ds:ds,pts:r[1]}})})})).then(function(arr){
    var rows=[];arr.forEach(function(x){var L=x.L;x.ds.forEach(function(dd){var picks=dd.p.slice().sort(function(a,b){return a.pick_no-b.pick_no});
      picks.forEach(function(p,i){if(p.picked_by!==D.user.user_id)return;var next=picks.slice(i+1,i+3);
        rows.push({L:L,season:dd.d.season,p:p,next:next,pts:x.pts})})})});
    if(!rows.length)return '<div class="empty">No completed rookie drafts with your picks found.</div>';
    function nm(p){var m=p.metadata||{};return esc(((m.first_name||'')+' '+(m.last_name||'')).trim()||pinfo(p.player_id).n)}
    function line(L,p,pts){var v=val(L,p.player_id),tr=(L.V.t||{})[p.player_id]||0;return nm(p)+' <span class="muted small">'+esc((p.metadata||{}).position||'')+' · '+int(v)+(tr?' ('+(tr>0?'+':'')+int(tr)+' 30d)':'')+' · '+f1(pts[p.player_id]||0)+' pts</span>'}
    return rows.sort(function(a,b){return b.season-a.season||a.p.pick_no-b.p.pick_no}).map(function(r){var L=r.L,mv=val(L,r.p.player_id),best=r.next.slice().sort(function(a,b){return val(L,b.player_id)-val(L,a.player_id)})[0],bv=best?val(L,best.player_id):0;
      var verdict=!best?'':mv>=bv?'<span class="pill g">GOOD CALL</span>':bv>mv*1.25?'<span class="pill r">PASSED ON BETTER</span>':'<span class="pill y">CLOSE</span>';
      return '<div class="flag"><div class="ic">'+r.p.round+'.'+String(r.p.draft_slot||'').padStart(2,'0')+'</div><div class="fx"><div class="ft">'+line(L,r.p,r.pts)+' '+verdict+'</div><div class="small muted">'+esc(L.name)+' '+esc(r.season)+' · next off the board: '+r.next.map(function(n){return line(L,n,r.pts)}).join(' · ')+'</div></div></div>'}).join('')+'<div class="hint">Points = this season in that league\'s scoring (rostered weeks only).</div>'})}

// ---------- WEEKLY RECAP ----------
function optimal(L,slots,ids,pts){var left=ids.slice(),order=slots.map(function(s){return {s:s,e:ELIG[s]||[s]}}).sort(function(a,b){return a.e.length-b.e.length}),tot=0,lu=[];
  order.forEach(function(o){var best=-1,bp=-1;left.forEach(function(id,i){var fp=pinfo(id).fp||[];if(fp.some(function(x){return o.e.indexOf(x)>=0})&&(pts[id]||0)>bp){bp=pts[id]||0;best=i}});if(best>=0){lu.push(left[best]);tot+=bp;left.splice(best,1)}});return {tot:tot,lu:lu}}
// ---------- weekly report card: lineup efficiency, bench left, luck (all-play), start/sit calls followed ----------
var RC_ROAST={A:["Straight A's. The Weasel would like to formally request your lineup notes.","Honor roll. Somebody tell the group chat, because you will anyway."],
  B:["Solid B. Like a good mid-round pick: nobody's impressed, nobody's mad.","B work. One fewer bench blunder and you'd have been insufferable."],
  C:["C. The fantasy equivalent of a participation trophy with a dent in it.","Average. The Weasel has seen better lineups from autodraft."],
  D:["D. Your bench outscored your decision-making.","D work. Sleeper should make you watch a tutorial before Thursday."],
  F:["F. The lineup was set by a raccoon in a trench coat.","Failing grade. The bench is filing a formal complaint."]};
function letter(s){return s>=90?'A':s>=80?'B':s>=70?'C':s>=60?'D':'F'}
function gradeChip(g){var c={A:'var(--for)',B:'#9be7ff',C:'var(--gold)',D:'#ff9f5a',F:'var(--ag)'}[g];return '<b style="font:700 22px/1 var(--disp);color:'+c+'">'+g+'</b>'}
function reportCard(L,ms,me,op,act,opt,pts,w){var cl=function(x){return Math.max(0,Math.min(100,x))};
  var eff=opt>0?act/opt*100:100,effS=cl((eff-70)*10/3),left=Math.max(0,opt-act),benchS=cl(100-left*2);
  var others=ms.filter(function(m){return m.roster_id!==L.me}),aw=others.filter(function(m){return (+m.points||0)<act}).length,al=others.filter(function(m){return (+m.points||0)>act}).length,ap=others.length?aw/others.length:0.5;
  var res=op?(act>op.points?'W':act<op.points?'L':'T'):'-',oppRank=op?ms.filter(function(m){return (+m.points||0)>(+op.points||0)}).length+1:null;
  var luck=res==='W'&&ap<0.5?{t:'🍀 Lucky',c:'var(--gold)',d:'won with a '+aw+'-'+al+' all-play'}:res==='L'&&ap>0.5?{t:'🌧️ Unlucky',c:'#9be7ff',d:'lost despite a '+aw+'-'+al+' all-play'+(oppRank===1?' (ran into the week\'s top score)':oppRank<=2?' (opponent scored #'+oppRank+')':'')}:{t:'⚖️ Earned it',c:'var(--mute)',d:aw+'-'+al+' all-play'+(oppRank?' · opponent #'+oppRank+' of '+ms.length:'')};
  var log=LS.get('wh:calls:'+D.season+':'+w+':'+L.id)||{},st=me.starters||[],calls=Object.keys(log).map(function(k){var e=log[k],f=st.indexOf(e.x)>=0&&st.indexOf(e.y)<0;return {e:e,f:f,net:(pts[e.x]||0)-(pts[e.y]||0)}});
  var fol=calls.filter(function(c){return c.f}),ign=calls.filter(function(c){return !c.f}),good=fol.filter(function(c){return c.net>=0}).length+ign.filter(function(c){return c.net<0}).length;
  var callS=calls.length?cl(good/calls.length*100):null,score=callS==null?0.7*effS+0.3*benchS:0.5*effS+0.2*benchS+0.3*callS,G=letter(score);
  var ro=RC_ROAST[G][(L.id.length+w)%RC_ROAST[G].length];
  function sub(lab,g,d){return '<div class="rcg"><span class="muted">'+lab+'</span> <b>'+g+'</b> <span class="small muted">'+d+'</span></div>'}
  return '<div class="rc"><div class="rch">'+gradeChip(G)+'<span class="small muted">WEEK '+w+' REPORT CARD</span></div>'+
    sub('Lineup',letter(effS),f1(eff)+'% of optimal')+sub('Bench',letter(benchS),f1(left)+' pts left')+
    sub('Calls',callS==null?'–':letter(callS),calls.length?fol.length+'/'+calls.length+' followed · '+(fol.length?'followed net '+(fol.reduce(function(a,c){return a+c.net},0)>=0?'+':'−')+f1(Math.abs(fol.reduce(function(a,c){return a+c.net},0))):'')+(ign.length?(fol.length?' · ':'')+'ignored would have '+(ign.reduce(function(a,c){return a+c.net},0)>=0?'gained ':'lost ')+f1(Math.abs(ign.reduce(function(a,c){return a+c.net},0))):''):'no calls logged on this device')+
    '<div class="rcg"><span class="muted">Luck</span> <b style="color:'+luck.c+'">'+luck.t+'</b> <span class="small muted">'+luck.d+' (not graded)</span></div><div class="roast">'+esc(ro)+'</div></div>'}
function renderRecap(el){var w=+(QS.get('rw')||0)||(D.games&&Object.keys(D.games).length&&Object.keys(D.games).every(function(k){return D.games[k].state==='post'})?D.week:D.week-1);
  if(w<1){el.innerHTML='<div class="panel empty">No completed week yet.</div>';return}
  el.innerHTML='<section class="panel">'+spin('Loading week '+w+'…')+'</section>';
  Promise.all(D.leagues.map(function(L){return SC(SAPI+'/v1/league/'+L.id+'/matchups/'+w,36e5).then(function(ms){return {L:L,ms:ms}})})).then(function(arr){
    if(curTab()[0]!=='recap')return;var W=0,Lo=0,T=0,left=0;
    var cards=arr.map(function(x){var L=x.L,me=x.ms.filter(function(m){return m.roster_id===L.me})[0];if(!me)return '';var op=x.ms.filter(function(m){return m.matchup_id===me.matchup_id&&m.roster_id!==L.me})[0];
      var pts=me.players_points||{},st=(me.starters||[]).filter(function(i){return i&&i!=='0'}),r=L.rosters[L.me],bench=(me.players||[]).filter(function(i){return st.indexOf(i)<0});
      var opt=optimal(L,L.slots,me.players||[],pts),act=+me.points||0,res=op?(act>op.points?'W':act<op.points?'L':'T'):'-';if(res==='W')W++;else if(res==='L')Lo++;else if(res==='T')T++;left+=Math.max(0,opt.tot-act);
      var miss=[];bench.forEach(function(b){var bp=pts[b]||0,fp=pinfo(b).fp||[];(me.starters||[]).forEach(function(s,i){var sl=L.slots[i],e=ELIG[sl]||[sl];if(s&&s!=='0'&&fp.some(function(z){return e.indexOf(z)>=0})&&bp>(pts[s]||0))miss.push({b:b,s:s,g:bp-(pts[s]||0)})})});
      miss.sort(function(a,b){return b.g-a.g});var worst=miss[0];
      var bestS=st.map(function(s){var alt=0;bench.forEach(function(b){var fp=pinfo(b).fp||[],sl=L.slots[(me.starters||[]).indexOf(s)],e=ELIG[sl]||[sl];if(fp.some(function(z){return e.indexOf(z)>=0}))alt=Math.max(alt,pts[b]||0)});return {s:s,g:(pts[s]||0)-alt}}).sort(function(a,b){return b.g-a.g})[0];
      var flip=op&&res==='L'&&opt.tot>op.points;
      return '<div class="box"><div style="display:flex;justify-content:space-between"><h3 style="margin:2px 0">'+esc(L.name)+hq(L)+'</h3><span class="pill '+(res==='W'?'g':res==='L'?'r':'y')+'">'+res+'</span></div><div class="small">'+f1(act)+' – '+(op?f1(op.points):'?')+' vs '+(op?esc(ownerOf(L,op.roster_id).name):'?')+'</div>'+reportCard(L,x.ms,me,op,act,opt.tot,pts,w)+'<div class="small muted">Optimal lineup: '+f1(opt.tot)+' · left on bench: <b style="color:'+(opt.tot-act>15?'var(--ag)':'var(--ink)')+'">'+f1(Math.max(0,opt.tot-act))+'</b>'+(flip?' · <b style="color:var(--ag)">optimal lineup would have WON</b>':'')+'</div>'+(window.ROASTS?'<div class="roast">'+ROASTS.bench(Math.max(0,opt.tot-act),flip,L.id+':r'+w)+'</div>':'')+
      (bestS&&bestS.g>0?'<div class="small" style="margin-top:4px">✅ Best call: '+pname(bestS.s)+' ('+f1(pts[bestS.s]||0)+', +'+f1(bestS.g)+' over bench)</div>':'')+(worst?'<div class="small">❌ Worst call: benched '+pname(worst.b)+' ('+f1(pts[worst.b]||0)+') for '+pname(worst.s)+' ('+f1(pts[worst.s]||0)+')</div>':'<div class="small">🧠 Perfect lineup. No points left on the table.</div>')+'</div>'}).join('');
    var weeks='';for(var i=1;i<=Math.max(1,D.week);i++)weeks+='<a class="chip'+(i===w?' on':'')+'" style="display:inline-flex;align-items:center" href="?'+(QS.get('u')?'u='+encodeURIComponent(USER)+'&':'')+'rw='+i+'#recap">W'+i+'</a>';
    el.innerHTML='<section class="panel"><h2>📰 Week '+w+' Recap <small>'+W+'-'+Lo+(T?'-'+T:'')+' OVERALL</small></h2><div class="chips">'+weeks+'</div><div class="ticker" style="font:700 20px var(--disp);margin:4px 0 10px">'+(W>Lo?'Went <b style="color:var(--gold)">'+W+'-'+Lo+'</b>. The weasel eats.':W<Lo?'Went <b style="color:var(--gold)">'+W+'-'+Lo+'</b>. Shoeys owed.':'Went '+W+'-'+Lo+'. Perfectly mid.')+' '+f1(left)+' pts left on benches.</div><div class="grid2">'+cards+'</div></section>'}).catch(function(e){el.innerHTML='<div class="panel err">'+esc(e.message)+'</div>'})}

// ---------- NEWS ----------
var NEWSK='wh:news:v1';
function myIds(){var o={};D.leagues.forEach(function(L){var r=L.rosters[L.me];(r.players||[]).forEach(function(id){o[id]=o[id]||{lg:[],start:[]};o[id].lg.push(L.name)});var m=L.mu.filter(function(x){return x.roster_id===L.me})[0];(m&&m.starters||[]).forEach(function(id){if(o[id])o[id].start.push(L.name)})});return o}
function injuryItems(){var mine=myIds(),snap=LS.get('wh:injsnap2'),chg=LS.get('wh:injchg2')||[],now=Date.now(),cur={},pfc={},items=[];
  Object.keys(mine).forEach(function(id){if(isNaN(+id))return;var pi=pinfo(id),db=D.players&&D.players[id];cur[id]={i:pi.inj||null,pr:db&&db.pr||null,b:pi.body||null};if(db)pfc[id]={i:db.i||(db.s==='Inactive'?'Inactive':null),pr:db.pr||null,b:db.b||null}});
  var pfNew=D.pfAt&&(!snap||snap.at!==D.pfAt);
  if(pfNew&&snap&&snap.p){Object.keys(pfc).forEach(function(id){var a=snap.p[id],b=pfc[id];if(!a)return;if((a.i||null)!==(b.i||null))chg.push({id:id,at:now,from:a.i,to:b.i,b:b.b});else if((a.pr||null)!==(b.pr||null)&&b.pr)chg.push({id:id,at:now,pr:b.pr})})}
  if(0&&snap&&snap.p){Object.keys(cur).forEach(function(id){var a=snap.p[id],b=cur[id];if(!a)return;if((a.i||null)!==(b.i||null))chg.push({id:id,at:now,from:a.i,to:b.i,b:b.b});else if((a.pr||null)!==(b.pr||null)&&b.pr)chg.push({id:id,at:now,pr:b.pr})})}
  chg=chg.filter(function(c){return now-c.at<7*864e5}).slice(-80);LS.set('wh:injchg2',chg);if(pfNew)LS.set('wh:injsnap2',{at:D.pfAt,p:pfc});
  chg=chg.filter(function(c){var pi=pinfo(c.id);return (c.to||null)===(pi.inj||null)||c.pr});
  chg.forEach(function(c){var m=mine[c.id];if(!m)return;items.push({kind:'inj',id:c.id,at:c.at,t:c.to?'Now '+c.to+(c.b?' ('+c.b+')':''):c.pr?'Practice: '+c.pr:'Back to healthy (was '+c.from+')',bad:!!c.to&&c.to!=='Questionable'||c.to==='Questionable',m:m})});
  // current injury statuses (first visit has no diff): timestamp from Sleeper news_updated
  Object.keys(cur).forEach(function(id){var c=cur[id];if(!c.i)return;if(items.some(function(x){return x.id===id&&x.kind==='inj'}))return;var pr=D.proj[id],t=pr&&pr.pl&&pr.pl.news_updated||null;items.push({kind:'inj',id:id,at:t||0,t:c.i+(c.b?' ('+c.b+')':''),bad:true,m:mine[id],cur:true})});
  return items}
function espnIds(){var mine=myIds(),o={};Object.keys(mine).forEach(function(id){var e=(D.players&&D.players[id]&&D.players[id].e)||null;if(!e)D.leagues.some(function(L){return (e=L.V&&L.V.e[id])});if(e)o[id]=String(e)});return o}
function newsTTL(){return statusEvery()<=5*6e4?2*6e4:10*6e4}
function espnNews(force){var c=LS.get(NEWSK);if(!force&&c&&Date.now()-c.at<newsTTL()){D.newsAt=c.at;return Promise.resolve(c.items)}var t0=Date.now();
  var mine=myIds(),ids=espnIds(),list=Object.keys(ids).sort(function(a,b){return mine[b].start.length-mine[a].start.length||mine[b].lg.length-mine[a].lg.length}).slice(0,40);
  return pool(list.map(function(id){return function(){return J('https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=3&playerId='+ids[id]+'&_='+t0).then(function(d){return (d.feed||[]).map(function(x){return {kind:'espn',id:id,at:Date.parse(x.published)||0,t:x.headline,story:x.story,na:(x.categories||[]).filter(function(c){return c.type==='athlete'}).length,link:x.links&&x.links.mobile&&x.links.mobile.href}})})}}),4).then(function(arr){
    var items=[].concat.apply([],arr.filter(Boolean)).filter(function(x){return Date.now()-x.at<10*864e5});LS.set(NEWSK,{at:Date.now(),items:items});D.newsAt=Date.now();D.newsOk=true;return items}).catch(function(e){D.errors.push('ESPN news unavailable: '+e.message);return []})}
// ESPN round-up columns ("Fantasy football buzz: ...") get tagged with dozens of players; they aren't news about this player
function roundup(x){var last=String(pinfo(x.id).n||'').split(' ').slice(-1)[0].toLowerCase();if(last&&String(x.t||'').toLowerCase().indexOf(last)>=0)return false;return (x.na||0)>2||/<photo\d|^\s*<p>/i.test(x.story||'')}
function cleanStory(x){if(x.story&&/[<&]/.test(x.story)){var d=new DOMParser().parseFromString(String(x.story).replace(/<photo\d*>/gi,''),'text/html');x.story=(d.body.textContent||'').replace(/\s+/g,' ').trim()}return x}
function allNews(force){return Promise.all([ensure(),trending()]).then(function(r){var TR=r[1];return espnNews(force).then(function(en){var mine=myIds(),items=injuryItems().concat(en.filter(function(x){return mine[x.id]&&!roundup(x)}).map(cleanStory).map(function(x){x.m=mine[x.id];return x}));
  Object.keys(TR.drop).forEach(function(id){if(mine[id])items.push({kind:'trend',id:id,at:Date.now(),t:'Trending DROP on Sleeper ('+int(TR.drop[id])+' drops/24h)',m:mine[id],bad:true})});
  items.forEach(function(x){x.starter=x.m&&x.m.start.length>0;x.rank=(x.kind==='inj'&&x.starter&&x.bad?0:x.starter?1:2)});
  items.sort(function(a,b){return b.at-a.at});
  var seen={};items.forEach(function(x){if(x.kind==='trend')return;if(seen[x.id]){x.old=true;seen[x.id].older=(seen[x.id].older||0)+1}else seen[x.id]=x});
  // available trending adds in Brett's leagues
  var avail=[];Object.keys(TR.add).forEach(function(id){var lgs=D.leagues.filter(function(L){return !Object.keys(L.rosters).some(function(k){return (L.rosters[k].players||[]).indexOf(id)>=0})}).map(function(L){return L.name});if(lgs.length&&NEEDS.concat(['K','DEF']).indexOf(pos(id))>=0)avail.push({id:id,n:TR.add[id],lgs:lgs})});
  avail.sort(function(a,b){return b.n-a.n});return {items:items,avail:avail.slice(0,10)}})})}
function playedPts(id){var v=null;(D.allLeagues||D.leagues).forEach(function(L){(L.mu||[]).forEach(function(m){var p=m.players_points&&m.players_points[id];if(p!=null&&p!==0)v=p})});return v}
function curStatus(id){var pi=pinfo(id);if(isNaN(+id))return '';var g=gameOf(pi.team);
  // a Questionable/Doubtful tag is moot once he has actually played this week (Sleeper keeps the tag until midweek)
  if(pi.inj&&/^(Questionable|Doubtful)$/i.test(pi.inj)&&g&&g.state!=='pre'&&playedPts(id)!=null)return ' <span class="pill g" title="Has points this week">'+(g.state==='post'?'PLAYED':'PLAYING')+' ✓</span> <span class="small muted">(was '+esc(pi.inj[0])+')</span>';
  if(pi.inj)return ' <span class="pill r" title="'+esc(pi.stsrc||'Sleeper')+'">NOW: '+esc(String(pi.inj).toUpperCase())+'</span>';
  return pi.active?' <span class="pill g" title="'+esc(pi.stsrc||'')+'">NOW: ACTIVE ✅</span>':''}
function newsStamp(){return D.newsAt?'<div class="small muted" style="margin:-4px 0 6px">News updated '+ETTIME.format(new Date(D.newsAt))+' ET · statuses '+(D.statAt&&D.statAt.sleeper?ETTIME.format(new Date(D.statAt.sleeper))+' ET':'…')+'</div>':''}
function newsRow(x){return '<div class="news"'+(x.old?' style="opacity:.5"':'')+'>'+head(x.id)+'<div style="flex:1;min-width:0"><div class="nt">'+pname(x.id)+curStatus(x.id)+' '+(x.old?'<span class="pill">OLDER</span> ':'')+(x.starter?'<span class="pill y">STARTER</span>':'')+(x.kind==='inj'?' <span class="pill '+(x.bad?'r':'g')+'">'+(x.cur?'INJURY':'STATUS CHANGE')+'</span>':x.kind==='trend'?' <span class="pill">TRENDING</span>':' <span class="pill">ESPN</span>')+'</div><div>'+esc(x.t)+'</div>'+(x.story?'<div class="small muted">'+esc(String(x.story).slice(0,220))+(String(x.story).length>220?'…':'')+'</div>':'')+'<div class="nm2">'+(x.at?tstr(x.at)+' · '+ago(x.at)+' · ':'')+esc((x.m&&x.m.lg||[]).join(', '))+(x.starter?' · starting in '+x.m.start.length:'')+'</div></div></div>'}
function renderNews(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No leagues.</div>';return}el.innerHTML='<section class="panel">'+spin('Checking the wire…')+'</section>';
  allNews().then(function(N){if(curTab()[0]!=='news')return;
    el.innerHTML='<section class="panel"><h2>🗞️ News on Your Guys <small>'+N.items.filter(function(x){return !x.old}).length+' PLAYERS</small></h2>'+newsStamp()+'<div class="hint">Newest first. One headline per player; older updates about the same player are dimmed underneath (tap to show). "NOW:" is the live status (Sleeper, refreshed every minute near kickoff, overridden by ESPN game-day inactives). Sources: Sleeper status changes, ESPN fantasy news, Sleeper trending drops.</div>'+(N.items.length?newsGrouped(N.items.filter(function(x){return x.kind!=='trend'}).slice(0,90))+(function(tr){return tr.length?'<h3>📉 Trending drops on your guys</h3>'+tr.map(newsRow).join(''):''})(N.items.filter(function(x){return x.kind==='trend'})):'<div class="empty">Quiet out there.</div>')+'</section>'+
    '<section class="panel"><h2>🔥 Trending Adds Available</h2>'+(N.avail.length?N.avail.map(function(a){var pi=pinfo(a.id);return '<div class="flag"><div class="ic">'+posChip(pos(a.id))+'</div><div class="fx"><div class="ft">'+esc(pi.n)+' <span class="muted small">'+esc(pi.team||'')+'</span></div><div class="small muted">'+int(a.n)+' adds/24h · free in '+esc(a.lgs.join(', '))+'</div></div></div>'}).join(''):'<div class="empty">None of the hot adds are free in your leagues.</div>')+'</section>'}).catch(function(e){el.innerHTML='<div class="panel err">'+esc(e.message)+'</div>'})}
function newsGrouped(items){var h=items.filter(function(x){return !x.old}),out='';h.forEach(function(x){out+=newsRow(x);if(x.older){var o=items.filter(function(y){return y.old&&y.id===x.id});if(o.length)out+='<details style="margin:-4px 0 6px 46px"><summary class="small muted">'+o.length+' older update'+(o.length>1?'s':'')+'</summary>'+o.map(newsRow).join('')+'</details>'}});return out}
// Sunday strip: 3-5 freshest items (from cache; filled in background)
window.NEWS={items:null,strip:function(){var it=this.items;if(!it||!it.length)return '';var top=it.filter(function(x){return x.kind!=='trend'&&!x.old}).slice().sort(function(a,b){return b.at-a.at}).slice(0,5);if(!top.length)return '';
  return '<section class="panel"><h2>🗞️ Latest on Your Guys <small><a href="#news">ALL NEWS →</a></small></h2>'+newsStamp()+top.map(newsRow).join('')+'</section>'}};

EXTRA_TABS.push(['rosters','👥','ROSTERS',renderRosters],['exposure','🧲','EXPOSURE',renderExposure],['trade','🧶','TRADE',renderTrade],['waivers','🧺','WAIVERS',renderWaivers],['picks','🎯','PICKS',renderPicks],['recap','📰','RECAP',renderRecap],['news','🗞️','NEWS',renderNews]);
$('#tabs').innerHTML=navHTML();
window.resetTabCaches=function(){X=null;_trend=null};
NEWS.reload=function(force){if(!D.leagues.length)return Promise.resolve();return allNews(force).then(function(N){NEWS.items=N.items;var t=curTab()[0];if(t==='sunday'||t==='news')rerender()}).catch(function(e){console.warn(e)})};
(window.afterBoot=window.afterBoot||[]).push(function(){setTimeout(function(){NEWS.reload(true)},2500);
  (function loop(){setTimeout(function(){if(!document.hidden&&Date.now()-(D.newsAt||0)>=newsTTL()-3000)NEWS.reload(true).then(loop,loop);else loop()},20000)})()});
})();

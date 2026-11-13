'use strict';
// Weasel Hub round 5, features: Standings & playoff odds (#standings), Player Finder across all leagues (#find/<id>),
// key dates / trade-deadline countdown (Standings, Trade, Home alert). Read-only: nothing here posts to Sleeper.
(function(){
function int(n){return Math.round(+n||0).toLocaleString('en-US')}
function pad2(n){return (n<10?'0':'')+n}
function S_(L){return L.raw.settings||{}}
function nTeams(L){return Object.keys(L.rosters).length}
function ptOf(L){return S_(L).playoff_teams||Math.floor(nTeams(L)/2)}
function pwsOf(L){return S_(L).playoff_week_start||15}
function pctT(p){if(p==null)return '…';if(p>=0.995)return '<b class="pe">&gt;99%</b>';if(p<=0.005)return '<span class="ne">&lt;1%</span>';var v=Math.round(p*100);return (v<1?'<1':v>99?'>99':v)+'%'}
// ---------- key dates ----------
function deadline(L){var dl=+S_(L).trade_deadline||0;if(!dl)return {w:0,txt:'No trade deadline',cls:''};var d=dl-D.week;
  return {w:dl,d:d,txt:d<0?'Trade deadline passed (Week '+dl+')':d===0?'Trade deadline is THIS WEEK (Week '+dl+')':d===1?'Trade deadline next week (Week '+dl+')':'Trade deadline Week '+dl+' · '+d+' weeks away',cls:d<0?'muted':d<=1?'ne':d<=3?'gold':''}}
function rounds(pt){var r=0,s=1;while(s<pt){s*=2;r++}return r}
function datesHTML(Ls,compact){var rows=Ls.map(function(L){var dl=deadline(L),p=pwsOf(L),pt=ptOf(L),rt=+S_(L).playoff_round_type||0,rn=rounds(pt),last=p+(rt===2?rn*2:rt===1?rn+1:rn)-1;
    return '<div class="kd"><b>'+esc(L.name)+'</b><span class="'+dl.cls+'">'+(dl.cls==='ne'?'⏰ ':'')+esc(dl.txt)+'</span><span class="muted">Regular season ends Week '+(p-1)+' · playoffs Weeks '+p+'–'+last+' ('+pt+' teams)</span></div>'}).join('');
  return '<section class="panel" id="whdates"><h2>📅 Key dates <small>WEEK '+D.week+'</small></h2>'+rows+'</section>'}
window.WH_DATES={html:datesHTML,deadline:deadline};
// ---------- STANDINGS ----------
function myPicksFrom(L){var o={},yr=+L.raw.season+1;(L.traded||[]).forEach(function(t){if(t.owner_id===L.me&&t.roster_id!==L.me&&+t.season===yr&&t.round<=2)(o[t.roster_id]=o[t.roster_id]||[]).push(t.round)});return o}
function leagueTable(L){var st=standings(L),n=nTeams(L),pt=ptOf(L),mine=myPicksFrom(L),R=window.WHMC&&WHMC.get(L);
  var rows=Object.keys(st).map(function(k){return st[k]}).sort(function(a,b){return a.rank-b.rank});
  var dl=deadline(L);
  return '<div class="box stbox"><div class="sth"><h3>'+esc(L.name)+(window.hq?hq(L):'')+'</h3><span class="small muted">'+n+' teams · top '+pt+' make it · <span class="'+dl.cls+'">'+esc(dl.txt.replace('Trade deadline','Deadline'))+'</span></span></div>'+
   '<div class="tw"><table class="stt"><thead><tr><th>#</th><th class="w">Team</th><th>W-L</th><th>PF</th><th class="dsk">Max PF</th><th>Playoffs</th><th class="dsk">#1 seed</th><th>Pick</th></tr></thead><tbody>'+
   rows.map(function(x,i){var o=ownerOf(L,x.rid),me=x.rid===L.me,pk=mine[x.rid],sl=x.slot?'1.'+pad2(x.slot):'–',rg=x.mc&&x.slotLo&&x.slotHi&&x.slotLo!==x.slotHi?'<small class="muted"> '+x.slotLo+'–'+x.slotHi+'</small>':'';
      return '<tr class="'+(me?'me':'')+(i===pt-1?' pline':'')+'"><td>'+x.rank+'</td><td class="w"><span class="stn">'+esc(o.name)+'</span>'+(pk?' <span class="pill y" title="You own their '+pk.map(function(r){return r===1?'1st':'2nd'}).join(' + ')+'">🎯 '+pk.map(function(r){return r===1?'1st':'2nd'}).join('+')+'</span>':'')+'</td>'+
        '<td>'+x.w+'-'+x.l+(x.t?'-'+x.t:'')+'</td><td>'+int(x.pf)+'</td><td class="dsk">'+int(x.mpf)+'</td><td>'+(x.mc?pctT(x.poOdds):'…')+'</td><td class="dsk">'+(x.mc?(x.topOdds<0.005?'<span class="muted">–</span>':pctT(x.topOdds)):'…')+'</td><td>'+sl+rg+'</td></tr>'}).join('')+'</tbody></table></div>'+
   (R?'':'<div class="small muted">Simulating the rest of the season…</div>')+'</div>'}
function renderStandings(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No active leagues.</div>';return}
  el.innerHTML='<section class="panel"><h2>📊 Standings & odds <small>WEEK '+D.week+'</small></h2><div class="hint">Every team in every league. Playoffs / #1 seed = share of '+int(window.WHMC?WHMC.N:3000)+' simulated seasons (live scores this week, the real remaining Sleeper schedule, wins then PF for seeding). Pick = projected '+(+D.season+1)+' rookie slot from the same simulation: non-playoff teams by lowest max PF, playoff teams by simulated playoff finish (small numbers = likely range). 🎯 = you own that team\'s pick. The gold line is the playoff cut.</div>'+
    D.leagues.map(leagueTable).join('')+'</section>'+datesHTML(D.leagues);
  if(window.WHMC&&D.leagues.some(function(L){return !WHMC.get(L)}))WHMC.ready().then(function(){if(curTab()[0]==='standings')rerender()})}
// ---------- PLAYER FINDER ----------
var IDX=null;
function index(){if(IDX)return IDX;var seen={};(D.allLeagues||D.leagues).forEach(function(L){Object.keys(L.rosters).forEach(function(k){(L.rosters[k].players||[]).forEach(function(p){seen[p]=1})});Object.keys((L.V&&L.V.p)||{}).forEach(function(p){seen[p]=1})});
  var arr=Object.keys(seen).map(function(id){var pi=pinfo(id),v=0;(D.allLeagues||D.leagues).forEach(function(L){v=Math.max(v,(L.V&&L.V.p[id])||0)});return {id:id,n:pi.n,pos:pi.pos,team:pi.team||'FA',v:v,u:pi.unknown}}).filter(function(x){return !x.u&&x.pos&&x.pos!=='?'}).sort(function(a,b){return b.v-a.v});
  return (IDX=arr)}
function tval(L,id){var v=(L.V&&L.V.p[id])||0,b=+(L.ss&&L.ss.bonus_rec_te)||0;return pinfo(id).pos==='TE'?v*(1+0.25*Math.min(1,b)):v}// same TE-premium bump as the Trade Finder
function who(L,id){var o=null;Object.keys(L.rosters).forEach(function(k){if((L.rosters[k].players||[]).indexOf(id)>=0)o=+k});return o}
function routeIdea(L,id,rid){var M=L.model;if(!M||!M.teams[rid]||!M.me)return '';var B=M.teams[rid],A=M.me,tv=tval(L,id);if(tv<300)return '';
  var needs=B.holes.length?B.holes:['QB','RB','WR','TE'].filter(function(p){return B.ratio[p]<1});
  var sf=L.rp&&(L.rp.indexOf('SUPER_FLEX')>=0||L.rp.filter(function(x){return x==='QB'}).length>=2),NC={QB:sf?2:1,RB:3,WR:4,TE:1},core={};['QB','RB','WR','TE'].forEach(function(p){((A.by&&A.by[p])||[]).slice(0,NC[p]).forEach(function(x){core[x]=1})});
  var mine=(L.rosters[L.me].players||[]).filter(function(p){var pp=pinfo(p).pos;return needs.indexOf(pp)>=0&&(A.surplus.indexOf(pp)>=0||!core[p])}).map(function(p){return {id:p,v:tval(L,p)}}).filter(function(x){return x.v>=tv*0.8&&x.v<=tv*1.3}).sort(function(a,b){return Math.abs(a.v-tv)-Math.abs(b.v-tv)});
  var lead='They\'re '+({CONTENDER:'contending',REBUILD:'rebuilding',TWEENER:'in the middle'}[B.mode]||B.mode.toLowerCase())+(needs.length?', light at '+needs.slice(0,2).join('/'):'')+'.';
  return '<div class="small">'+lead+(mine.length?' Opening idea: your <b>'+esc(pinfo(mine[0].id).n)+'</b> ('+int(mine[0].v)+', '+pinfo(mine[0].id).pos+' they need, not one of your starters) for him ('+int(tv)+'). Value-only idea; check fit before sending.':' No clean 1-for-1 from your surplus; see the Trade Finder with him as the target.')+'</div>'}
function card(id){var pi=pinfo(id),Ls=D.allLeagues||D.leagues,own=0;
  var rows=Ls.map(function(L){var rid=who(L,id),v=tval(L,id),pr=projFor(L,id),me=rid===L.me;if(me)own++;
    var tag=rid==null?'<span class="pill">FREE AGENT</span>':me?'<span class="pill g">YOURS</span>':'<b>'+esc(ownerOf(L,rid).name)+'</b>'+(L.model&&L.model.teams[rid]?' <span class="pill '+(L.model.teams[rid].mode==='CONTENDER'?'g':L.model.teams[rid].mode==='REBUILD'?'r':'y')+'">'+L.model.teams[rid].mode+'</span>':'');
    var act=rid==null?'<div class="small"><a href="https://sleeper.com/leagues/'+L.id+'/players" target="_blank" rel="noopener">Add in Sleeper ↗</a></div>':me?'':routeIdea(L,id,rid)+'<div class="small"><a href="#trade" onclick="try{sessionStorage.setItem(\'wh:tf:tgt\',\''+id+'\')}catch(e){}">Trade Finder ↗</a></div>';
    return '<div class="box pfrow"><div class="pfh"><b>'+esc(L.name)+'</b><span class="small muted">value '+int(v)+' · wk '+D.week+' proj '+f1(pr)+'</span></div><div>'+tag+'</div>'+act+'</div>'}).join('');
  return '<div class="pfc"><div class="pft">'+head(id)+'<div><div class="ft">'+esc(pi.n)+' '+posChip(pi.pos)+' <span class="muted small">'+esc(pi.team||'FA')+'</span>'+(pi.inj?' <span class="inj">'+esc(String(pi.inj).toUpperCase())+'</span>':'')+(window.faBadge?faBadge(id):'')+'</div><div class="small muted">On your roster in <b>'+own+' of '+Ls.length+'</b> leagues · values are FantasyCalc in each league\'s format</div></div></div>'+rows+'</div>'}
function renderFind(el){el.innerHTML='<section class="panel">'+'<div class="spin">Loading players…</div></section>';
  (window.WH_ensure?WH_ensure():Promise.resolve()).then(function(){if(curTab()[0]!=='find')return;var arr=index(),cur=(location.hash.split('/')[1]||'');
    var top=arr.filter(function(x){return (D.allLeagues||D.leagues).some(function(L){return (L.rosters[L.me].players||[]).indexOf(x.id)>=0})}).slice(0,10);
    el.innerHTML='<section class="panel"><h2>🔍 Player finder <small>ALL LEAGUES</small></h2><div class="hint">Type any player: who owns him in each of your leagues, his value in that league\'s format, and a trade route if someone else has him. Read-only; nothing is sent to Sleeper.</div>'+
      '<input id="pfq" class="pfq" type="search" list="pfl" placeholder="Search a player…" autocomplete="off" enterkeyhint="search"><datalist id="pfl">'+arr.slice(0,1500).map(function(x){return '<option value="'+esc(x.n+' · '+x.pos+' '+x.team)+'">'}).join('')+'</datalist>'+
      '<div class="chips" style="margin:8px 0">'+top.map(function(x){return '<button class="chip" data-pf="'+x.id+'">'+esc(x.n)+'</button>'}).join('')+'</div><div id="pfout">'+(cur?card(cur):'<div class="small muted">Tip: tap one of your most valuable players above, or search anyone.</div>')+'</div></section>';
    var q=$('#pfq',el);function go(id){location.hash='#find/'+id}
    q.addEventListener('change',function(){var v=q.value.toLowerCase(),m=arr.filter(function(x){return (x.n+' · '+x.pos+' '+x.team).toLowerCase()===v})[0]||arr.filter(function(x){return x.n.toLowerCase().indexOf(v.split(' · ')[0])>=0})[0];if(m)go(m.id)});
    q.addEventListener('keydown',function(e){if(e.key==='Enter'){var v=q.value.toLowerCase().split(' · ')[0],m=arr.filter(function(x){return x.n.toLowerCase().indexOf(v)>=0})[0];if(m)go(m.id)}});
    $$('[data-pf]',el).forEach(function(b){b.onclick=function(){go(b.getAttribute('data-pf'))}})}).catch(function(e){el.innerHTML='<div class="panel err">Couldn\'t load players: '+esc(e.message)+'</div>'})}
// ---------- register tabs ----------
EXTRA_TABS.push(['standings','📊','STANDINGS',renderStandings],['find','🔍','FIND',renderFind]);
if(window.TAB_ORDER){var g1=TAB_ORDER[1];if(g1.indexOf('standings')<0)g1.unshift('standings');var g2=TAB_ORDER[2];if(g2.indexOf('find')<0)g2.splice(1,0,'find')}
$('#tabs').innerHTML=navHTML();
// ---------- injected panels: deadline alert on Home, key dates on Trade ----------
function inject(){var t=curTab()[0],v=$('#view');if(!v||!D.leagues||!D.leagues.length)return;
  if(t==='home'&&!$('#whdl',v)){var soon=D.leagues.filter(function(L){var d=deadline(L);return d.w&&d.d>=0&&d.d<=2});
    if(soon.length){var first=v.querySelector('section.panel');var h='<div class="box dlalert" id="whdl">⏰ '+soon.map(function(L){return '<b>'+esc(L.name)+'</b>: '+esc(deadline(L).txt.replace('Trade deadline','deadline'))}).join(' · ')+' <a href="#trade">Trade tools →</a></div>';
      if(first)first.insertAdjacentHTML('beforebegin',h)}}
  if(t==='trade'&&!$('#whdates',v)&&v.querySelector('section.panel')){v.insertAdjacentHTML('afterbegin',datesHTML(D.leagues).replace('📅 Key dates','📅 Deadlines'))}}
var mo=new MutationObserver(function(){mo.disconnect();try{inject()}catch(e){console.warn('inject',e)}mo.observe($('#view'),{childList:true})});
mo.observe($('#view'),{childList:true});addEventListener('hashchange',function(){setTimeout(inject,50)});
// Trade Finder deep link from the Player Finder
(window.afterBoot=window.afterBoot||[]).push(function(){});
})();

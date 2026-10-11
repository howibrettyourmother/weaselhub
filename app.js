'use strict';
// Weasel Hub: Brett's private command center. Everything is computed in the browser from free public APIs
// (Sleeper, ESPN public scoreboard/news, FantasyCalc). No login, no server, no paid anything.
var SAPI='https://api.sleeper.app';
var QS=new URLSearchParams(location.search);
var USER=QS.get('u')||'Howibrettyourmother';
var $=function(s,el){return (el||document).querySelector(s)};
var $$=function(s,el){return Array.prototype.slice.call((el||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function f1(n){return (Math.round((+n||0)*10)/10).toFixed(1)}
function pct(x){return Math.round(x*100)+'%'}
var LS={get:function(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};
function J(u){return fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error(r.status+' '+u.replace(/\?.*/,''));return r.json()})}
function S(u){return J(SAPI+u)}
// cache a JSON fetch in sessionStorage (per page session) for slow-changing data
function SC(u,ttl){var k='wh:sc:'+u;try{var c=JSON.parse(sessionStorage.getItem(k)||'null');if(c&&Date.now()-c.at<(ttl||6e5))return Promise.resolve(c.d)}catch(e){}
  return J(u).then(function(d){try{sessionStorage.setItem(k,JSON.stringify({at:Date.now(),d:d}))}catch(e){}return d})}
var ELIG={QB:['QB'],RB:['RB'],WR:['WR'],TE:['TE'],K:['K'],DEF:['DEF'],FLEX:['RB','WR','TE'],WRRB_FLEX:['RB','WR'],REC_FLEX:['WR','TE'],SUPER_FLEX:['QB','RB','WR','TE'],IDP_FLEX:['DL','LB','DB'],DL:['DL'],LB:['LB'],DB:['DB']};
var NONSTART={BN:1,IR:1,TAXI:1};
var BAD_INJ={Out:'OUT',Doubtful:'DOUBTFUL',IR:'IR',PUP:'PUP',Sus:'SUSP',NA:'N/A',DNR:'DNR',COV:'COVID'};
function phi(z){return Math.exp(-z*z/2)/2.5066282746}
function Phi(z){var t=1/(1+0.2316419*Math.abs(z)),d=0.3989423*Math.exp(-z*z/2),p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
var ESPN_FIX={WSH:'WAS',LA:'LAR',JAC:'JAX'};

// ---------------- global state ----------------
var D={user:null,season:null,week:null,leagues:[],skipped:[],proj:{},games:{},byes:{},players:null,errors:[],at:0};
var UI={slot:'all',open:{},openCards:{},all:{}};

// ---------------- players DB (big; slimmed + cached daily in localStorage) ----------------
var PKEY='wh:players:v1';
function playersCached(){var c=LS.get(PKEY);return c&&c.p?c:null}
var _pl=null;
function loadPlayers(force){
  var c=playersCached();
  if(c&&!force&&Date.now()-c.at<864e5)return Promise.resolve(c.p);
  if(_pl)return _pl;
  _pl=J(SAPI+'/v1/players/nfl').then(function(all){var m={},want={QB:1,RB:1,WR:1,TE:1,K:1,DEF:1};
    for(var id in all){var p=all[id];var fp=(p.fantasy_positions&&p.fantasy_positions.length?p.fantasy_positions:[p.position]).filter(Boolean);
      if(!fp.some(function(x){return want[x]}))continue;if(!p.team&&!D.rostered[id]&&!(D.anyRostered&&D.anyRostered[id]))continue;
      m[id]={n:p.position==='DEF'?(p.first_name+' '+p.last_name):(p.full_name||((p.first_name||'')+' '+(p.last_name||'')).trim()),p:fp,t:p.team||null,i:p.injury_status||null,b:p.injury_body_part||null,pr:p.practice_participation||null,e:p.espn_id||null,a:p.age||null,y:p.years_exp}}
    var prev=playersCached();
    if(prev&&prev.p)LS.set('wh:players:prev',{at:prev.at,p:slimInj(prev.p)});
    if(!LS.set(PKEY,{at:Date.now(),p:m})){var r={};for(var k in D.rostered)if(m[k])r[k]=m[k];LS.set(PKEY,{at:Date.now(),p:r})}
    all=null;_pl=null;return m}).catch(function(e){_pl=null;throw e});
  return _pl}
function slimInj(p){var o={};for(var k in p)if(D.rostered[k])o[k]={i:p[k].i,pr:p[k].pr,t:p[k].t};return o}

function pinfo(id){
  var pr=D.proj[id],pl=pr&&pr.pl,db=D.players&&D.players[id];
  if(isNaN(+id)){return {id:id,n:id+' D/ST',pos:'DEF',fp:['DEF'],team:id,inj:null}}
  if(pl)return {id:id,n:((pl.first_name||'')+' '+(pl.last_name||'')).trim(),pos:pl.position,fp:pl.fantasy_positions||[pl.position],team:pr.team||pl.team||(db&&db.t),inj:pl.injury_status||(db&&db.i)||null,body:pl.injury_body_part||(db&&db.b)};
  if(db)return {id:id,n:db.n,pos:db.p[0],fp:db.p,team:db.t,inj:db.i,body:db.b};
  return {id:id,n:'Player '+id,pos:'?',fp:[],team:null,inj:null,unknown:true}}
function head(id,cls){var pi=pinfo(id);
  if(pi.pos==='DEF')return '<img class="hs def '+(cls||'')+'" loading="lazy" alt="" src="https://sleepercdn.com/images/team_logos/nfl/'+String(id).toLowerCase()+'.png">';
  return '<img class="hs '+(cls||'')+'" loading="lazy" alt="" src="https://sleepercdn.com/content/nfl/players/thumb/'+id+'.jpg" onerror="this.style.visibility=\'hidden\'">'}
function posChip(pos){var c=/^(QB|RB|WR|TE|K|DEF)$/.test(pos)?pos:'IDP';return '<span class="pos '+c+'">'+esc(pos||'?')+'</span>'}

// ---------------- schedule (ESPN public scoreboard; CORS *) ----------------
var ETFMT=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',hour12:false});
var ETTIME=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'2-digit'});
function slotOf(d){var parts=ETFMT.formatToParts(d),wd='',h=0;parts.forEach(function(p){if(p.type==='weekday')wd=p.value;if(p.type==='hour')h=+p.value%24});
  if(wd==='Thu')return 'thu';if(wd==='Fri')return 'fri';if(wd==='Sat')return 'sat';
  if(wd==='Sun'){if(h<12)return 'sunam';if(h<15)return 'early';if(h<19)return 'late';return 'snf'}
  if(wd==='Mon')return 'mon';return 'oth'}
var SLOTS=[['thu','Thursday'],['fri','Friday'],['sat','Saturday'],['sunam','Sun AM (Intl)'],['sun','Sunday'],['early','Sun Early'],['late','Sun Late'],['snf','Sun Night'],['mon','Monday'],['oth','Other'],['bye','Bye/None']];
var SLOTNAME={};SLOTS.forEach(function(s){SLOTNAME[s[0]]=s[1]});
function loadGames(){
  return J('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week='+D.week+'&seasontype=2&dates='+D.season).then(function(sb){
    var g={},byes={};(sb.week&&sb.week.teamsOnBye||[]).forEach(function(t){byes[ESPN_FIX[t.abbreviation]||t.abbreviation]=1});
    (sb.events||[]).forEach(function(ev){var c=ev.competitions[0],st=c.status||ev.status,kick=new Date(ev.date);
      var state=st.type.state,per=st.period||0,clk=st.clock||0,frac=1;
      if(state==='in'){var el=per<=4?((per-1)*900+(900-clk))/3600:0.985;frac=Math.max(0.015,Math.min(1,1-el))}else if(state==='post')frac=0;
      var tms=c.competitors.map(function(x){return {ab:ESPN_FIX[x.team.abbreviation]||x.team.abbreviation,score:+x.score||0,ha:x.homeAway}});
      var info={id:ev.id,kick:kick,slot:slotOf(kick),state:state,frac:frac,detail:st.type.shortDetail,teams:tms,name:ev.shortName};
      tms.forEach(function(t){g[t.ab]=info})});
    D.games=g;D.byes=byes;D.gamesOk=true;D.gamesSrc='ESPN'}).catch(function(e){
    // fallback: Sleeper schedule (dates + status only, no kickoff times)
    return J(SAPI+'/schedule/nfl/regular/'+D.season).then(function(all){var g={};all.filter(function(x){return +x.week===+D.week}).forEach(function(x){
        var dt=new Date(x.date+'T17:00:00Z'),wd=new Date(x.date+'T12:00:00Z').getUTCDay(),slot=['sun','mon','oth','oth','thu','fri','sat'][wd];
        var state=x.status==='complete'?'post':(x.status==='pre_game'||x.status==='scheduled'||!x.status)?'pre':'in';
        var info={id:x.game_id,kick:dt,slot:slot,state:state,frac:state==='in'?0.5:state==='pre'?1:0,detail:state==='in'?'live':state,teams:[{ab:x.away,ha:'away',score:0},{ab:x.home,ha:'home',score:0}],name:x.away+' @ '+x.home};
        g[x.home]=info;g[x.away]=info});
      if(!Object.keys(g).length)throw new Error('empty');D.games=g;D.gamesOk=true;D.gamesSrc='Sleeper';D.errors.push('ESPN scoreboard unavailable; using Sleeper schedule (no kickoff times, so Sunday slots are merged and live progress is approximate).')})
    .catch(function(){D.gamesOk=false;D.errors.push('Schedule unavailable ('+e.message+'); slot grouping/live status degraded.')})})}
function gameOf(team){return team?D.games[team]:null}

// ---------------- projections (Sleeper unofficial; CORS *) ----------------
function loadProj(){
  var u=SAPI+'/projections/nfl/'+D.season+'/'+D.week+'?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF';
  return SC(u,15*6e4).then(function(arr){var m={};arr.forEach(function(x){m[x.player_id]={s:x.stats||{},pl:x.player||{},team:x.team}});D.proj=m})
    .catch(function(e){D.errors.push('Projections unavailable ('+e.message+').');D.proj={}})}
function scoreStats(s,ss){var t=0;for(var k in ss){var w=ss[k];if(!w)continue;var v=s[k];
    if(v==null){if(k==='fgmiss'){v=(s.fgmiss_0_19||0)+(s.fgmiss_20_29||0)+(s.fgmiss_30_39||0)+(s.fgmiss_40_49||0)+(s.fgmiss_50p||0)}else continue}
    t+=v*w}return t}
function projFor(L,id){if(L.pc[id]!=null)return L.pc[id];var pr=D.proj[id],v=0;
  if(pr&&pr.s){v=scoreStats(pr.s,L.ss);if(!isFinite(v)||(v===0&&pr.s.pts_ppr)){v=L.ppr>=1?pr.s.pts_ppr:L.ppr>=0.5?pr.s.pts_half_ppr:pr.s.pts_std;v=v||0}}
  return (L.pc[id]=v)}

// ---------------- leagues ----------------
function ownerOf(L,rid){var r=L.rosters[rid],u=r&&L.users[r.owner_id];return {name:u?(u.metadata&&u.metadata.team_name)||u.display_name:'Team '+rid,disp:u?u.display_name:'',av:u&&u.avatar?'https://sleepercdn.com/avatars/thumbs/'+u.avatar:''}}
function loadLeagues(){
  return S('/v1/user/'+D.user.user_id+'/leagues/nfl/'+D.season).then(function(ls){
    D.allLeagues=ls;D.skipped=[];
    var use=ls.filter(function(l){var s=l.settings||{};
      if(s.best_ball){D.skipped.push({name:l.name,why:'best ball'});return false}
      if(l.status==='pre_draft'||l.status==='drafting'){D.skipped.push({name:l.name,why:'not drafted yet'});return false}
      if(l.status==='complete'){D.skipped.push({name:l.name,why:'season complete'});return false}
      return true});
    return Promise.all(use.map(function(l){return Promise.all([S('/v1/league/'+l.league_id+'/rosters'),SC(SAPI+'/v1/league/'+l.league_id+'/users',36e5),S('/v1/league/'+l.league_id+'/matchups/'+D.week),SC(SAPI+'/v1/league/'+l.league_id+'/traded_picks',36e5).catch(function(){return []})]).then(function(r){
      var L={id:l.league_id,name:(l.name||'').trim(),raw:l,ss:l.scoring_settings||{},ppr:(l.scoring_settings||{}).rec||0,rp:l.roster_positions||[],rosters:{},users:{},pc:{},traded:r[3]||[]};
      r[0].forEach(function(x){L.rosters[x.roster_id]=x});r[1].forEach(function(u){L.users[u.user_id]=u});
      var mine=r[0].filter(function(x){return x.owner_id===D.user.user_id||(x.co_owners||[]).indexOf(D.user.user_id)>=0});
      if(!mine.length){D.skipped.push({name:L.name,why:'no roster for you'});return null}
      L.me=mine[0].roster_id;L.slots=L.rp.filter(function(p){return !NONSTART[p]});
      L.mu=r[2]||[];var mm=L.mu.filter(function(m){return m.roster_id===L.me})[0];
      if(!L.mu.length||!mm||mm.matchup_id==null){D.skipped.push({name:L.name,why:'no matchup in week '+D.week});return null}
      var om=L.mu.filter(function(m){return m.matchup_id===mm.matchup_id&&m.roster_id!==L.me})[0];
      if(!om){D.skipped.push({name:L.name,why:'no opponent this week'});return null}
      L.opp=om.roster_id;return L})}))}).then(function(arr){D.leagues=arr.filter(Boolean)})}
function refreshMatchups(){return Promise.all(D.leagues.map(function(L){return S('/v1/league/'+L.id+'/matchups/'+D.week).then(function(m){if(m&&m.length)L.mu=m}).catch(function(){})}))}

// ---------------- core model ----------------
function playerLine(L,id,actualMap){
  var pi=pinfo(id),g=gameOf(pi.team),proj=projFor(L,id),act=+(actualMap&&actualMap[id])||0;
  var state=g?g.state:'none',frac=g?g.frac:0,rem=state==='pre'?proj:state==='in'?proj*frac:0;
  var fin=state==='pre'?proj:(state==='none'?act:act+rem);
  return {id:id,pi:pi,g:g,proj:proj,act:act,rem:rem,fin:fin,state:state,slot:g?g.slot:'bye'}}
function teamSide(L,m){var lines=(m.starters||[]).filter(function(x){return x&&x!=='0'}).map(function(id){return playerLine(L,id,m.players_points)});
  var o={rid:m.roster_id,mid:m.matchup_id,lines:lines,proj:0,rem:0,fin:0,act:+m.points||0,ytp:0,live:0};
  lines.forEach(function(l){o.proj+=l.proj;o.rem+=l.rem;o.fin+=l.fin;if(l.state==='pre')o.ytp++;if(l.state==='in')o.live++});
  o.actSum=lines.reduce(function(a,l){return a+l.act},0);return o}
function pairOdds(A,B){var tot=Math.max(1,A.proj+B.proj),s0=Math.max(10,0.13*tot),rs=(A.rem+B.rem)/tot,sig=Math.max(1.5,s0*Math.sqrt(Math.max(0,rs))),m=A.fin-B.fin;
  if(A.rem+B.rem<0.05){var w=m>0?1:m<0?0:0.5;return {pA:w,lev:0,sig:sig,m:m}}
  return {pA:Phi(m/sig),lev:phi(m/sig)/sig,sig:sig,m:m}}
function preOdds(A,B){var s0=Math.max(10,0.13*Math.max(1,A.proj+B.proj)),m=A.proj-B.proj;return {lev:phi(m/s0)/s0,p:Phi(m/s0)}}

// Pick Watch: future 1st/2nd picks Brett holds from other teams
// ---------------- draft order: MAX PF (Sleeper "potential points") ----------------
// Verified against every league's last completed rookie draft: picks 1..N go to the NON-PLAYOFF teams by LOWEST max PF,
// then playoff teams (projected here by seed, worst seed first). Set DRAFT_ORDER='all' to rank the whole league by max PF.
var DRAFT_ORDER='nonplayoff';
function potLine(L,ids,val){// best possible lineup (greedy, most restrictive slot first) -> {tot, set}
  var left=ids.slice(),tot=0,set={};L.slots.map(function(sl){return ELIG[sl]||[sl]}).sort(function(a,b){return a.length-b.length}).forEach(function(e){var bi=-1,bv=-1;
    left.forEach(function(id,i){var fp=pinfo(id).fp||[];var v=val(id);if(fp.some(function(x){return e.indexOf(x)>=0})&&v>bv){bv=v;bi=i}});if(bi>=0){tot+=bv;set[left[bi]]=1;left.splice(bi,1)}});return {tot:tot,set:set}}
function standings(L){var key=D.at+':'+(L.mu&&L.mu.length);if(L._st&&L._stk===key)return L._st;
  var pws=(L.raw.settings||{}).playoff_week_start||15,pt=(L.raw.settings||{}).playoff_teams||Math.floor(Object.keys(L.rosters).length/2);
  var arr=Object.keys(L.rosters).map(function(k){var r=L.rosters[k],s=r.settings||{};var g=(s.wins||0)+(s.losses||0)+(s.ties||0),mpf=(s.ppts||0)+(s.ppts_decimal||0)/100;
    var m=(L.mu||[]).filter(function(x){return x.roster_id===+k})[0],wk={tot:0,rem:0,set:{}};
    if(m&&g<D.week&&D.week<pws){var lines={};(m.players||[]).filter(function(id){return (r.reserve||[]).indexOf(id)<0&&(r.taxi||[]).indexOf(id)<0}).forEach(function(id){lines[id]=playerLine(L,id,m.players_points)});
      var ids=Object.keys(lines),fin=potLine(L,ids,function(id){return lines[id].fin});wk={tot:fin.tot,set:fin.set,lines:lines,rem:ids.reduce(function(a,id){return a+(fin.set[id]?lines[id].rem:0)},0)}}
    var avg=g?mpf/g:wk.tot,after=Math.max(0,(pws-1)-Math.max(D.week,g));
    return {rid:+k,w:s.wins||0,l:s.losses||0,t:s.ties||0,g:g,pf:(s.fpts||0)+(s.fpts_decimal||0)/100,mpf:mpf,avg:avg,wk:wk,after:after,mpfEnd:mpf+wk.tot+after*avg,sdEnd:Math.max(8,0.12*avg*Math.sqrt(after+1))}});
  var pfr=arr.slice().sort(function(a,b){return b.pf-a.pf});pfr.forEach(function(x,i){x.pfRank=i+1});
  var mr=arr.slice().sort(function(a,b){return a.mpf-b.mpf});mr.forEach(function(x,i){x.mpfRank=i+1});// 1 = lowest max PF
  var desc=arr.slice().sort(function(a,b){return (b.w+b.t/2)-(a.w+a.t/2)||b.pf-a.pf});desc.forEach(function(x,i){x.rank=i+1;x.po=i<pt});
  var order=DRAFT_ORDER==='all'?arr.slice().sort(function(a,b){return a.mpfEnd-b.mpfEnd}):
    desc.filter(function(x){return !x.po}).sort(function(a,b){return a.mpfEnd-b.mpfEnd}).concat(desc.filter(function(x){return x.po}).reverse());
  order.forEach(function(x,i){x.slot=i+1});
  // how much is a team's draft slot still in play? pNon ~ chance they miss the playoffs; bubble ~ how much their W/L matters for that
  arr.forEach(function(x){var d=x.rank-(pt+0.5);x.pNon=DRAFT_ORDER==='all'?1:1/(1+Math.exp(-d/1.1));x.bubble=DRAFT_ORDER==='all'?0:Math.exp(-d*d/4)});
  var o={};arr.forEach(function(x){o[x.rid]=x});L._st=o;L._stk=key;return o}
function slotsPerPoint(st,rid){var me=st[rid],t=0;Object.keys(st).forEach(function(k){var x=st[k];if(+k===rid)return;var sp=Math.sqrt(me.sdEnd*me.sdEnd+x.sdEnd*x.sdEnd);t+=x.pNon*phi((me.mpfEnd-x.mpfEnd)/sp)/sp});return t}
function pickWatch(L){var yr=+L.raw.season,st=standings(L),n=Object.keys(L.rosters).length,pt=(L.raw.settings||{}).playoff_teams||Math.floor(n/2);
  var out=[];(L.traded||[]).forEach(function(t){if(t.owner_id!==L.me||t.roster_id===L.me)return;var s=+t.season;if(s<=yr||s>yr+2||t.round>2)return;
    var x=st[t.roster_id]||{};var near=s===yr+1;
    // leverage: 1sts > 2nds; more for teams near the bottom of the max-PF race; less for clear contenders (playoff teams pick late regardless)
    var pos=x.slot?(1-(x.slot-1)/Math.max(1,n-1)):0.5;// 1 = picks first
    var w=(t.round===1?1:0.4)*(near?1:0.5)*(0.3+0.7*pos);
    out.push({season:t.season,round:t.round,rid:t.roster_id,st:x,n:n,pt:pt,w:w,label:t.season+' '+(t.round===1?'1st':'2nd'),near:near,inPO:x.po,spp:near?slotsPerPoint(st,t.roster_id):0})});
  return out}

// Rival tracker: nearest standings competitors (within a game of Brett), excluding Brett
var RIVAL_K=0.12;
function rivals(L){var st=standings(L),me=st[L.me];if(!me)return [];var pt=(L.raw.settings||{}).playoff_teams||6;
  return Object.keys(st).map(function(k){return st[k]}).filter(function(x){return x.rid!==L.me&&Math.abs((x.w+x.t/2)-(me.w+me.t/2))<=1}).sort(function(a,b){return Math.abs(a.w-me.w)-Math.abs(b.w-me.w)||Math.abs(a.pf-me.pf)-Math.abs(b.pf-me.pf)}).slice(0,3).map(function(x){x.pt=pt;return x})}
// ---------------- impact aggregation ----------------
var PICK_K=0.35;// W/L part: a 1st-round team on the playoff bubble losing ~= 35% of your own win
var MPF_K=0.35;// max-PF part: value (in your-win units) of moving that 1st one full slot
function computeAll(){
  var players={},cards=[],flags=[],picks=[];
  D.leagues.forEach(function(L){
    var sides={};L.mu.forEach(function(m){if(m.matchup_id!=null)sides[m.roster_id]=teamSide(L,m)});L.sides=sides;
    var pw=pickWatch(L);L.picks=pw;
    // stake: value to Brett of roster X winning its matchup
    var stake={},why={};stake[L.me]=1;why[L.me]=['me'];
    pw.forEach(function(p){var b=p.near?(p.st&&p.st.bubble)||0:0;if(b>0.05){stake[p.rid]=(stake[p.rid]||0)-PICK_K*p.w*b;(why[p.rid]=why[p.rid]||[]).push('🎯 '+p.label+' (playoff bubble)')}});
    L.rivals=rivals(L);L.rivals.forEach(function(x){if(x.rid===L.opp)return;stake[x.rid]=(stake[x.rid]||0)-RIVAL_K;(why[x.rid]=why[x.rid]||[]).push('👀 playoff-race rival')});
    var pairs={};Object.keys(sides).forEach(function(k){var s=sides[k];(pairs[s.mid]=pairs[s.mid]||[]).push(s)});
    Object.keys(pairs).forEach(function(mid){var pr=pairs[mid];if(pr.length!==2)return;var A=pr[0],B=pr[1],od=pairOdds(A,B),o0=preOdds(A,B);
      A.odds=od.pA;B.odds=1-od.pA;A.vs=B;B.vs=A;
      var dA=(stake[A.rid]||0)-(stake[B.rid]||0);if(Math.abs(dA)<1e-9)return;
      [[A,dA],[B,-dA]].forEach(function(z){var side=z[0],d=z[1];side.lines.forEach(function(l){
        var imp=d*l.rem*od.lev,base=d*l.proj*o0.lev;
        var who=side.rid===L.me?'me':side.vs.rid===L.me?'opp':(stake[side.rid]?((why[side.rid]||[]).join().indexOf('🎯')>=0?'pick':'rival'):((why[side.vs.rid]||[]).join().indexOf('🎯')>=0?'pickopp':'rivalopp'));
        var tag=who==='me'?'Your starter':who==='opp'?'Starts vs you ('+ownerOf(L,side.rid).name+')'+(why[side.rid]?' + '+why[side.rid].join(', '):''):(who==='pick'||who==='rival')?ownerOf(L,side.rid).name+': '+(why[side.rid]||[]).join(', '):'Facing '+ownerOf(L,side.vs.rid).name+' ('+(why[side.vs.rid]||[]).join(', ')+')';
        var P=players[l.id]=players[l.id]||{id:l.id,line:l,ent:[],net:0,netBase:0};
        P.ent.push({L:L,imp:imp,base:base,who:who,tag:tag,proj:l.proj,act:l.act,state:l.state,winp:side.rid===L.me?side.odds:null});
        P.net+=imp;P.netBase+=base;if(l.state==='in')P.line=l})})});
    var stt=standings(L);pw.forEach(function(p){var x=stt[p.rid];if(!x||!x.wk.lines||!p.spp)return;var k=MPF_K*p.w*x.pNon*p.spp;if(k<1e-6)return;
      Object.keys(x.wk.lines).forEach(function(id){var l=x.wk.lines[id],wOpt=x.wk.set[id]?1:0.35,imp=-k*wOpt*l.rem,base=-k*wOpt*l.proj;if(Math.abs(base)<1e-4)return;
        var P=players[id]=players[id]||{id:id,line:l,ent:[],net:0,netBase:0};
        P.ent.push({L:L,imp:imp,base:base,who:'pick',tag:'🎯 for the pick ('+L.name+', '+p.label+') · max PF'+(x.wk.set[id]?'':' (bench counts)'),proj:l.proj,act:l.act,state:l.state});P.net+=imp;P.netBase+=base})});
    var me=sides[L.me],op=sides[L.opp];if(me&&op)cards.push({L:L,me:me,op:op});
    flags=flags.concat(startSit(L,me));
    pw.forEach(function(p){var s=sides[p.rid];picks.push({L:L,p:p,side:s,opp:s&&s.vs})});
  });
  var list=Object.keys(players).map(function(k){var P=players[k];P.conf=P.ent.some(function(e){return e.base>0.02})&&P.ent.some(function(e){return e.base<-0.02});
    P.leagues={};P.ent.forEach(function(e){P.leagues[e.L.id]=1});P.nL=Object.keys(P.leagues).length;
    var any=P.ent.some(function(e){return e.state==='pre'||e.state==='in'});P.done=!any;
    P.key=P.done?P.netBase:P.net;return P});
  return {players:list,cards:cards,flags:flags,picks:picks}}
function label(x){x=Math.abs(x);return x>=0.30?'Huge':x>=0.15?'Big':x>=0.06?'Moderate':'Small'}

// ---------------- start/sit check ----------------
function startSit(L,me){var out=[],r=L.rosters[L.me],m=L.mu.filter(function(x){return x.roster_id===L.me})[0];if(!m)return out;
  var starters=m.starters||[],set={};starters.forEach(function(s){set[s]=1});
  var excl={};(r.reserve||[]).forEach(function(x){excl[x]=1});(r.taxi||[]).forEach(function(x){excl[x]=1});
  var bench=(r.players||[]).filter(function(x){return !set[x]&&!excl[x]});
  var link='https://sleeper.com/leagues/'+L.id+'/team';
  function bad(l){var pi=l.pi;if(!pi.team)return 'no NFL team';if(D.gamesOk&&!l.g)return 'BYE';if(pi.inj&&BAD_INJ[pi.inj])return BAD_INJ[pi.inj]+(pi.body?' ('+pi.body+')':'');return null}
  var usedBench={};
  L.slots.forEach(function(slot,i){var id=starters[i];var el=ELIG[slot]||[slot];
    var cand=bench.map(function(b){return playerLine(L,b,m.players_points)}).filter(function(b){return b.state==='pre'&&!bad(b)&&b.pi.fp.some(function(p){return el.indexOf(p)>=0})}).sort(function(a,b){return b.proj-a.proj});
    if(!id||id==='0'){var c0=cand[0];out.push({L:L,sev:'hi',ic:'⛔',t:'Empty '+slot+' slot',d:c0?'Best bench option: '+esc(c0.pi.n)+' ('+f1(c0.proj)+' proj)':'No eligible bench player',link:link,kick:null});return}
    var l=playerLine(L,id,m.players_points);if(l.state!=='pre'&&l.state!=='none')return;
    var b=bad(l),c=cand.filter(function(x){return !usedBench[x.id]})[0];
    if(b){out.push({L:L,sev:'hi',ic:'🚑',t:esc(l.pi.n)+' is '+b,d:'Starting at '+slot+'. '+(c?'Swap in '+esc(c.pi.n)+' ('+f1(c.proj)+' proj).':'No healthy eligible bench option.'),link:link,kick:l.g&&l.g.kick});if(c)usedBench[c.id]=1;return}
    if(c&&c.proj>=l.proj+3&&c.proj>=l.proj*1.2){out.push({L:L,sev:'md',ic:'🔁',t:'Bench '+esc(c.pi.n)+' > '+esc(l.pi.n),d:slot+': '+f1(c.proj)+' vs '+f1(l.proj)+' proj (+'+f1(c.proj-l.proj)+')'+(l.pi.inj?' · '+esc(l.pi.n)+' '+esc(l.pi.inj):''),link:link,kick:l.g&&l.g.kick});usedBench[c.id]=1}
    else if(l.pi.inj==='Questionable'){out.push({L:L,sev:'lo',ic:'❓',t:esc(l.pi.n)+' is Questionable',d:'Check inactives ~90 min before kickoff ('+(l.g?ETTIME.format(l.g.kick):'')+' ET).',link:link,kick:l.g&&l.g.kick})}
  });
  return out}

// ---------------- render: Sunday ----------------
function slotState(slot){var gs={};for(var t in D.games){var g=D.games[t];if(g.slot===slot)gs[g.id]=g}var a=Object.keys(gs).map(function(k){return gs[k]});
  if(!a.length)return '';if(a.every(function(g){return g.state==='post'}))return 'fin';if(a.some(function(g){return g.state==='in'}))return 'live';return ''}
function gameTag(l){if(!l.g)return '<span class="tag">BYE</span>';if(l.state==='in')return '<span class="tag lv">LIVE '+esc(l.g.detail)+'</span>';if(l.state==='post')return '<span class="tag">FINAL</span>';return ''}
function oppStr(l){if(!l.g)return '';var me=l.pi.team,o=l.g.teams.filter(function(t){return t.ab!==me})[0],h=l.g.teams.filter(function(t){return t.ab===me})[0];return o?((h&&h.ha==='home')?'vs ':'@ ')+o.ab:''}
function rowHTML(P,side,max){var l=P.line,pi=l.pi,v=P.key,w=Math.max(4,Math.round(Math.abs(v)/max*100));
  var ents=P.ent.slice().sort(function(a,b){return Math.abs(b.base)-Math.abs(a.base)});
  var tags=(P.conf?'<span class="tag cf">CONFLICT</span>':'')+(P.ent.some(function(e){return e.who==='pick'})?'<span class="tag">🎯 pick</span>':'')+(P.ent.some(function(e){return e.who==='rival'})?'<span class="tag">👀 rival</span>':'');
  var live=l.state!=='pre'&&l.g?' · <b>'+f1(P.ent[0].act)+'</b> pts':'';
  return '<details class="row '+(P.done?'done':'')+'" data-k="r'+P.id+'"'+(UI.open['r'+P.id]?' open':'')+'><summary>'+head(P.id)+'<div class="mid"><div class="pn">'+esc(pi.n)+' '+(pi.inj?'<span class="inj">'+esc(pi.inj.toUpperCase().slice(0,4))+'</span>':'')+'</div><div class="meta">'+posChip(pi.pos)+'<span>'+esc(pi.team||'FA')+' '+esc(oppStr(l))+'</span>'+gameTag(l)+'<span class="lgs">'+P.nL+' league'+(P.nL>1?'s':'')+'</span>'+tags+'</div></div><div class="imp"><div class="lbl">'+(P.done?'Done':label(v))+'</div><div class="ibar"><i style="width:'+w+'%"></i></div><div class="pp">'+f1(l.proj)+' proj'+live+'</div></div></summary><div class="det">'+
    ents.map(function(e){var sg=(P.done?e.base:e.imp);return '<div><span><b>'+esc(e.L.name)+'</b> · '+esc(e.tag)+'</span><span class="'+(sg>=0?'pe':'ne')+'">'+(sg>=0?'+':'−')+f1(Math.abs(sg)*100)+'% swing</span></div>'}).join('')+'</div></details>'}
var SHORT={thu:'TNF',fri:'Friday',sat:'Saturday',sunam:'London',sun:'Sunday',early:'Early',late:'Late',snf:'SNF',mon:'MNF',oth:'Other'};
var SUNS={sunam:1,sun:1,early:1,late:1,snf:1};
function bankLabel(me,op){var order=SLOTS.map(function(s){return s[0]}),done={},pre={};me.lines.concat(op.lines).forEach(function(l){if(l.state==='post')done[l.slot]=1;else if(l.state==='pre')pre[l.slot]=1});
  var d=order.filter(function(k){return done[k]}),p=order.filter(function(k){return pre[k]});if(!p.length)return 'FINAL';
  var next=p[0],allBeforeSun=d.every(function(k){return !SUNS[k]&&k!=='mon'});
  var ahead=SUNS[next]&&allBeforeSun?'Sunday':SHORT[next]||next;
  return (d.length?d.map(function(k){return SHORT[k]||k}).join('+')+' banked · ':'')+ahead+' ahead'}
function scoreCard(c,prev){var L=c.L,me=c.me,op=c.op,mo=ownerOf(L,L.me),oo=ownerOf(L,L.opp),started=me.ytp<me.lines.length||op.ytp<op.lines.length,anyLive=me.live+op.live>0;
  var mp=started?me.actSum:me.proj,opp=started?op.actSum:op.proj,ch=prev&&(Math.abs(prev[0]-mp)>0.01||Math.abs(prev[1]-opp)>0.01);
  function tm(o,s,pts,lead){return '<div class="tm'+(lead?' lead':'')+'">'+(o.av?'<img class="av" loading="lazy" alt="" src="'+o.av+'">':'<span class="av"></span>')+'<div class="nm">'+esc(o.name)+'<small>'+s.ytp+' yet to play'+(s.live?' · '+s.live+' live':'')+'</small></div><div class="pts"><b>'+f1(pts)+'</b><small>'+(started?'proj '+f1(s.fin):'projected')+'</small></div></div>'}
  function lu(s){return s.lines.map(function(l){return '<div class="p '+l.state+'"><span><span class="slot">'+esc(l.pi.pos)+'</span>'+esc(l.pi.n)+'</span><b>'+(l.state==='pre'?f1(l.proj):f1(l.act))+'</b></div>'}).join('')}
  return '<details class="sc'+(ch?' flash':'')+'" data-k="c'+L.id+'"'+(UI.openCards[L.id]?' open':'')+'><summary><div class="ln"><span>'+esc(L.name)+'</span><span>'+(anyLive?'<span class="live">● LIVE</span>':started?(me.rem+op.rem<0.05?'FINAL':bankLabel(me,op)):'WK '+D.week)+'</span></div>'+tm(mo,me,mp,me.fin>=op.fin)+tm(oo,op,opp,op.fin>me.fin)+'<div class="wp"><b style="color:'+(me.odds>=0.5?'var(--for)':'var(--ag)')+'">'+pct(me.odds)+'</b><div class="bar"><i style="width:'+Math.round(me.odds*100)+'%"></i></div><span class="muted">win odds</span></div>'+(typeof ROASTS!=='undefined'?'<div class="roast">'+ROASTS.card(c,started)+'</div>':'')+'</summary><div class="lu"><div><h4>You</h4>'+lu(me)+'</div><div><h4>'+esc(oo.name)+'</h4>'+lu(op)+'</div></div></details>'}
var PREV={};
function renderSunday(el){
  if(!D.leagues.length){el.innerHTML='<section class="panel"><h2>Sunday</h2><div class="empty">No active leagues with matchups found for week '+D.week+'.</div>'+skippedHTML()+'</section>';return}
  var M=computeAll();D.M=M;var now=Date.now();
  // lock banner
  var next=Object.keys(D.games).map(function(k){return D.games[k]}).filter(function(g){return g.state==='pre'}).sort(function(a,b){return a.kick-b.kick})[0];
  var hi=M.flags.filter(function(f){return f.sev==='hi'});
  var banner='';if(next){var mins=Math.round((next.kick-now)/6e4),hh=Math.floor(mins/60),mm=mins%60;banner='<div class="box" style="margin-bottom:12px;border-color:'+(hi.length?'rgba(255,107,107,.5)':'rgba(255,199,44,.35)')+'"><b style="font-family:var(--disp);letter-spacing:.06em;color:var(--gold)">⏱ NEXT LOCK '+(mins>0?'IN '+(hh?hh+'h ':'')+mm+'m':'NOW')+'</b> <span class="muted">· '+esc(next.name)+' · '+ETTIME.format(next.kick)+' ET</span>'+(hi.length?'<div style="margin-top:4px;color:var(--ag);font-weight:700">'+hi.length+' lineup issue'+(hi.length>1?'s':'')+' to fix: '+hi.map(function(f){return f.t+' ('+esc(f.L.name)+')'}).join('; ')+'</div>':'<div class="small muted" style="margin-top:3px">No empty, Out, IR or bye starters 👍</div>')+'</div>'}
  // cards sorted by closeness (finished last)
  var cards=M.cards.slice().sort(function(a,b){var fa=a.me.rem+a.op.rem<0.05,fb=b.me.rem+b.op.rem<0.05;if(fa!==fb)return fa?1:-1;return Math.abs(a.me.odds-0.5)-Math.abs(b.me.odds-0.5)});
  var cardsH=cards.map(function(c){var h=scoreCard(c,PREV[c.L.id]);PREV[c.L.id]=[c.me.lines.some(function(l){return l.state!=='pre'})||c.op.lines.some(function(l){return l.state!=='pre'})?c.me.actSum:c.me.proj,c.me.lines.some(function(l){return l.state!=='pre'})||c.op.lines.some(function(l){return l.state!=='pre'})?c.op.actSum:c.op.proj];return h}).join('');
  var rec=cards.reduce(function(a,c){a.x+=c.me.odds;return a},{x:0});
  // slot chips
  var cnt={all:0};M.players.forEach(function(P){if(Math.abs(P.key)<1e-4)return;cnt.all++;cnt[P.line.slot]=(cnt[P.line.slot]||0)+1});
  var chips='<div class="chips" id="chips">'+[['all','All']].concat(SLOTS).filter(function(s){return s[0]==='all'||cnt[s[0]]}).map(function(s){var st=s[0]==='all'?'':slotState(s[0]);return '<button class="chip'+(UI.slot===s[0]?' on':'')+'" data-s="'+s[0]+'">'+s[1]+'<span class="c"> '+(cnt[s[0]]||0)+'</span>'+(st==='live'?'<span class="st">● LIVE</span>':st==='fin'?'<span class="st fin">✓</span>':'')+'</button>'}).join('')+'</div>';
  var inSlot=M.players.filter(function(P){return Math.abs(P.key)>=1e-4&&(UI.slot==='all'||P.line.slot===UI.slot)});
  var fr=inSlot.filter(function(P){return P.key>0}).sort(function(a,b){return (a.done-b.done)||b.key-a.key}),ag=inSlot.filter(function(P){return P.key<0}).sort(function(a,b){return (a.done-b.done)||a.key-b.key});
  var max=Math.max.apply(null,[0.01].concat(M.players.map(function(P){return Math.abs(P.key)})));
  function lst(arr,cls,title){var lim=UI.all[cls]?arr.length:15,more=arr.length-lim;return '<div class="list '+cls+'"><div class="lh '+cls+'">'+title+'<span>'+arr.length+' players</span></div>'+(arr.length?arr.slice(0,lim).map(function(P){return rowHTML(P,cls,max)}).join(''):'<div class="empty">Nobody in this slot.</div>')+(more>0?'<button class="chip more" data-more="'+cls+'" style="margin:8px auto;display:block">Show '+more+' more</button>':'')+'</div>'}
  var conf=M.players.filter(function(P){return P.conf}).sort(function(a,b){return Math.abs(b.key)-Math.abs(a.key)});
  var confH=conf.length?conf.map(function(P){return '<div class="flag"><div class="ic">'+head(P.id)+'</div><div class="fx"><div class="ft">'+esc(P.line.pi.n)+' <span class="pill '+(P.key>=0?'g':'r')+'">'+(P.key>=0?'ROOT FOR':'ROOT AGAINST')+'</span> <span class="muted small">net '+(P.key>=0?'+':'−')+f1(Math.abs(P.key)*100)+'%</span></div><div class="small muted">'+P.ent.map(function(e){var s=P.done?e.base:e.imp;return '<span class="'+(s>=0?'pe':'ne')+'">'+(s>=0?'+':'−')+f1(Math.abs(s)*100)+'%</span> '+esc(e.L.name)+' ('+esc(e.tag)+')'}).join(' · ')+'</div></div></div>'}).join(''):'<div class="empty">No conflicts this week. Clean conscience.</div>';
  var flags=M.flags.slice().sort(function(a,b){var o={hi:0,md:1,lo:2};return o[a.sev]-o[b.sev]});
  var flagH=flags.length?flags.map(function(f){return '<div class="flag sev-'+f.sev+'"><div class="ic">'+f.ic+'</div><div class="fx"><div class="ft">'+f.t+'</div><div class="small muted">'+f.d+'</div></div><a class="small" href="'+f.link+'" target="_blank" rel="noopener">'+esc(f.L.name)+' ↗</a></div>'}).join(''):'<div class="empty">All lineups look clean ✅</div>';
  var pk=M.picks.filter(function(x){return x.p.round<=2&&+x.p.season===+x.L.raw.season+1}).sort(function(a,b){return b.p.w-a.p.w});
  var pkH=pk.length?'<section class="panel"><h2>🎯 Pick Watch <small><a href="#picks">ALL PICKS →</a></small></h2><div class="hint">Rookie order = lowest <b>max PF</b> (potential points) first among non-playoff teams. Every point these teams score raises their max PF, <b>bench included</b>, so all their rostered players are folded into Root Against (bench guys at a discount, since only their best lineup counts). Their W/L only matters near the playoff line.</div>'+pk.slice(0,4).map(pickRow).join('')+(pk.length>4?'<a class="small" href="#picks">+'+(pk.length-4)+' more on Picks →</a>':'')+'</section>':'';
  el.innerHTML=banner+'<section class="panel"><h2>📺 Scoreboard <small>'+cards.length+' LEAGUES · EXP. WINS '+f1(rec.x)+'</small></h2><div class="sbs">'+cardsH+'</div><div class="hint" style="margin-top:6px">Tap a card for both lineups. Sorted by closest game. '+(isWindow()?'Auto-refreshing every 60s.':'Auto-refresh kicks in during game windows.')+'</div></section>'+
   newsStripHTML()+
   '<section class="panel"><h2>📣 Rooting Guide <small>WEEK '+D.week+'</small></h2>'+chips+'<div class="cols">'+lst(fr,'for','ROOT FOR')+lst(ag,'ag','ROOT AGAINST')+'</div><div class="hint">Impact = projected points still to come × how close the matchup is (win-probability swing), summed across leagues. Tap a player for per-league effects.</div></section>'+
   '<section class="panel"><h2>⚔️ Conflicts</h2>'+confH+'</section>'+
   '<section class="panel"><h2>🩺 Start/Sit Check</h2>'+flagH+'</section>'+pkH+skippedHTML();
  $$('#chips .chip',el).forEach(function(b){b.onclick=function(){UI.slot=b.getAttribute('data-s');renderSunday(el)}});
  $$('[data-more]',el).forEach(function(b){b.onclick=function(){UI.all[b.getAttribute('data-more')]=1;renderSunday(el)}});
  $$('details',el).forEach(function(d){d.addEventListener('toggle',function(){var k=d.getAttribute('data-k')||'';if(k[0]==='c')UI.openCards[k.slice(1)]=d.open;else UI.open[k]=d.open})});
}
var PROAST=['only {p} potential points this week. That pick just got shinier.','max PF pace of a team that forgot to set a lineup. Keep it up.','scored {p} even with a perfect lineup. The draft room is warming up.','the bench is as empty as the starting lineup. Love that for you (and your pick).'];
function pickRow(x){var L=x.L,p=x.p,o=ownerOf(L,p.rid),st=p.st||{},s=x.side,op=x.opp;var live='';
  var all=standings(L),avgWk=0,n=0;Object.keys(all).forEach(function(k){if(all[k].wk.tot){avgWk+=all[k].wk.tot;n++}});avgWk=n?avgWk/n:0;
  if(p.near&&st.wk&&st.wk.tot){var started=s&&(s.lines.some(function(l){return l.state!=='pre'})||(op&&op.lines.some(function(l){return l.state!=='pre'})));
    live='This week: best-lineup pts '+(started?'(live + proj) ':'proj ')+f1(st.wk.tot)+' (league avg '+f1(avgWk)+')';
    if(s&&op){var oo=op.rid===L.me?'YOU':ownerOf(L,op.rid).name;live+=' · vs '+esc(oo)+(st.bubble>0.05?' ('+pct(s.odds)+' to win, matters for the playoff line)':'')}
    if(s&&s.rem+(op?op.rem:0)<0.05&&st.wk.tot<avgWk*0.9)live+=' · <b style="color:var(--for)">'+fill1(PROAST[(+p.rid+D.week)%PROAST.length],{p:f1(st.wk.tot)})+'</b>'}
  var good=p.near&&st.wk&&st.wk.tot?st.wk.tot<avgWk:null;
  var arrow=good==null?'':good?'<span style="color:var(--for)" title="Below-average potential points this week: pick trending better">▲</span>':'<span style="color:var(--ag)" title="Above-average potential points this week: pick trending worse">▼</span>';
  return '<div class="flag"><div class="ic">'+arrow+'</div><div class="fx"><div class="ft">'+esc(o.name)+' <span class="pill y">'+esc(p.label)+'</span> <span class="muted small">'+esc(L.name)+'</span></div><div class="small muted">Max PF <b style="color:var(--ink)">'+f1(st.mpf)+'</b> ('+ordn(st.mpfRank)+' lowest of '+p.n+') · pace to '+int0(st.mpfEnd)+' · '+st.w+'-'+st.l+(st.t?'-'+st.t:'')+(p.near&&p.inPO?' (in a playoff spot, picks late)':'')+(p.near?' · proj pick <b style="color:var(--gold)">#'+st.slot+'</b>':' · <i>slot set by next season\'s max PF</i>')+'</div><div class="small">'+live+'</div></div></div>'}
function fill1(t,o){return t.replace(/\{(\w+)\}/g,function(m,k){return esc(o[k])})}
function ordn(n){var s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function int0(n){return Math.round(+n||0).toLocaleString('en-US')}
function rivalHTML(M){var rows=[];D.leagues.forEach(function(L){var sides={};L.mu.forEach(function(m){sides[m.roster_id]=m});(L.rivals||[]).forEach(function(x){var o=ownerOf(L,x.rid),m=sides[x.rid],om=m&&L.mu.filter(function(y){return y.matchup_id===m.matchup_id&&y.roster_id!==x.rid})[0];
    var vs=om?(om.roster_id===L.me?'YOU (already Root Against)':ownerOf(L,om.roster_id).name):'—';
    var c=M.cards.filter(function(c){return c.L===L})[0];
    rows.push('<div class="flag"><div class="ic">👀</div><div class="fx"><div class="ft">'+esc(o.name)+' <span class="muted small">'+esc(L.name)+'</span></div><div class="small muted">'+x.w+'-'+x.l+(x.t?'-'+x.t:'')+' · #'+x.rank+' of '+Object.keys(L.rosters).length+' (top '+x.pt+' make it) · '+f1(x.pf)+' PF</div><div class="small">This week vs '+esc(vs)+'. You want them to lose.</div></div></div>')})});
  return rows.length?'<section class="panel"><h2>👀 Rival Watch</h2><div class="hint">Teams within a game of you in the standings. Their starters count as mild Root Against.</div>'+rows.join('')+'</section>':''}
function skippedHTML(){var n=D.leagues.map(function(L){return esc(L.name)}).join(', ');
  return '<section class="panel"><h2>ℹ️ Notes</h2><div class="small">Leagues: '+n+'.'+(D.skipped.length?' <br>Skipped: '+D.skipped.map(function(s){return esc(s.name)+' ('+esc(s.why)+')'}).join(', ')+'.':'')+(D.errors.length?'<div class="err">'+D.errors.map(esc).join('<br>')+'</div>':'')+'</div><div class="hint" style="margin-top:6px">Projections: Sleeper\'s unofficial projections endpoint (Rotowire), scored with each league\'s own scoring settings. Live points from Sleeper matchups; game clock from ESPN. Win odds use a normal approximation on the projected margin. Updated '+new Date(D.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.</div></section>'}
function newsStripHTML(){return typeof NEWS!=='undefined'&&NEWS.strip?NEWS.strip():''}

// ---------------- refresh logic ----------------
function isWindow(){var now=Date.now();for(var t in D.games){var g=D.games[t];if(g.state==='in')return true;if(g.state==='pre'&&g.kick-now<20*6e4&&g.kick-now>-6*36e5)return true}return false}
var timer=null;
function schedule(){clearTimeout(timer);timer=setTimeout(function(){if(document.hidden){schedule();return}if(isWindow()||Date.now()-D.at>15*6e4)liveRefresh().then(schedule,schedule);else schedule()},60000)}
function liveRefresh(){return Promise.all([loadGames(),refreshMatchups()]).then(function(){D.at=Date.now();rerender()})}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&Date.now()-D.at>60000)liveRefresh()});

// ---------------- router ----------------
var TABS=[['sunday','🏈','SUNDAY',renderSunday]];
var EXTRA_TABS=[];// later modules push [key,icon,label,renderFn]
function navHTML(){var all=TABS.concat(EXTRA_TABS),ord=typeof TAB_ORDER!=='undefined'?TAB_ORDER:null,by={};all.forEach(function(t){by[t[0]]=t});
  if(!ord)return all.map(navA).join('');var out=[],seen={};ord.forEach(function(g,gi){if(gi)out.push('<i class="tsep"></i>');g.forEach(function(k){if(by[k]){out.push(navA(by[k]));seen[k]=1}})});all.forEach(function(t){if(!seen[t[0]])out.push(navA(t))});return out.join('')}
function navA(t){return '<a href="#'+t[0]+'" data-k="'+t[0]+'"><span>'+t[1]+'</span>'+t[2]+'</a>'}
function defaultTab(){var wd=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'}).format(new Date());var live=false;for(var t in D.games)if(D.games[t].state==='in')live=true;return (live||wd==='Sun'||wd==='Mon'||wd==='Thu')?'sunday':'home'}
function curTab(){var h=(location.hash||('#'+defaultTab())).slice(1).split('/')[0],all=TABS.concat(EXTRA_TABS);return all.filter(function(t){return t[0]===h})[0]||all[0]}
function rerender(){var t=curTab(),el=$('#view');$$('#tabs a').forEach(function(a){a.className=a.getAttribute('data-k')===t[0]?'on':''});
  try{t[3](el)}catch(e){console.error(e);el.innerHTML='<div class="panel err">Something broke rendering this tab: '+esc(e.message)+'</div>'}}
addEventListener('hashchange',function(){rerender();scrollTo(0,0)});

// ---------------- boot ----------------
function boot(){
  $('#tabs').innerHTML=navHTML();
  return Promise.all([S('/v1/user/'+encodeURIComponent(USER)),S('/v1/state/nfl')]).then(function(r){
    D.user=r[0];if(!D.user||!D.user.user_id)throw new Error('Sleeper user "'+USER+'" not found');
    var st=r[1];D.state=st;D.season=QS.get('season')||st.league_season||st.season;
    D.week=+(QS.get('w')||st.display_week||st.week||1);if(st.season_type!=='regular'&&!QS.get('w'))D.week=Math.max(1,D.week);
    $('#sub').innerHTML=esc(D.user.display_name.toUpperCase())+'<br>WEEK '+D.week;
    return Promise.all([loadLeagues(),loadProj(),loadGames()])}).then(function(){
    D.rostered={};D.anyRostered={};D.leagues.forEach(function(L){Object.keys(L.rosters).forEach(function(k){(L.rosters[k].players||[]).forEach(function(p){D.anyRostered[p]=1})})});D.leagues.forEach(function(L){Object.keys(L.rosters).forEach(function(k){var r=L.rosters[k];(r.players||[]).forEach(function(p){if(k==L.me)D.rostered[p]=1})});L.mu.forEach(function(m){(m.starters||[]).forEach(function(p){D.rostered[p]=1})})});
    var c=playersCached();if(c)D.players=c.p;
    D.at=Date.now();rerender();schedule();
    // background: fill names/injuries for players without projection rows, refresh daily
    var missing=Object.keys(D.rostered).some(function(id){return !D.proj[id]&&isNaN(+id)===false&&!(D.players&&D.players[id])});
    if(missing||!c||Date.now()-c.at>864e5)setTimeout(function(){loadPlayers().then(function(p){D.players=p;rerender()}).catch(function(e){console.warn('players',e)})},800);
    if(window.afterBoot)window.afterBoot.forEach(function(f){try{f()}catch(e){console.error(e)}});
  }).catch(function(e){console.error(e);$('#view').innerHTML='<div class="panel err">Could not load: '+esc(e.message)+'. <a href="javascript:location.reload()">Retry</a></div>'})}
$('#refresh').onclick=function(){var b=this;b.disabled=true;try{sessionStorage.clear()}catch(e){}
  Promise.all([loadProj(),liveRefresh()]).then(function(){b.disabled=false},function(){b.disabled=false})};
boot();

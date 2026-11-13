'use strict';
// Weasel Hub round 5 (Nov 2026). Canonical season simulator wiring (WHMC): every tab that shows playoff odds or a projected
// rookie pick reads the same Monte Carlo (core.js), so Home, Standings, Picks, Live Pick Watch, Draft and Trade pick values agree.
(function(){
var C=window.WHCORE,MC={},FUT={},VER=0,N=3000;
function lgSet(){return D.allLeagues||D.leagues||[]}
function pt(L){return (L.raw.settings||{}).playoff_teams||Math.floor(Object.keys(L.rosters).length/2)}
function pws(L){return (L.raw.settings||{}).playoff_week_start||15}
function fut(L){if(FUT[L.id])return FUT[L.id];var ws=[];for(var w=D.week+1;w<pws(L);w++)ws.push(w);
  return (FUT[L.id]=Promise.all(ws.map(function(w){return SC(SAPI+'/v1/league/'+L.id+'/matchups/'+w,6*36e5).then(function(m){var g={};(m||[]).forEach(function(x){if(x.matchup_id!=null)(g[x.matchup_id]=g[x.matchup_id]||[]).push(x.roster_id)});
      return Object.keys(g).map(function(k){return g[k]}).filter(function(p){return p.length===2})}).catch(function(){return []})})).then(function(a){FUT[L.id].v=a;return a}))}
function sd(s,pre){var base=pre?s.proj:s.rem;return Math.max(1,0.09*s.proj*Math.sqrt(Math.max(0,base)/Math.max(1,s.proj)))}
function inputs(L,pre){var st=WHMC.raw(L),rids=Object.keys(L.rosters).map(Number);
  var teams=rids.map(function(r){var s=st[r],g=Math.max(1,s.w+s.l+s.t),ppg=s.pf/g,side=L.sides&&L.sides[r],pj=side?side.proj:ppg;
    return {rid:r,w:s.w,t:s.t,pf:s.pf,mpf:s.mpf,mu:s.g>=2?0.65*ppg+0.35*pj:0.4*ppg+0.6*pj,ratio:s.pf>0?Math.max(1,Math.min(1.6,s.mpf/s.pf)):1.15,g:s.g,wk:s.wk}});
  var lm=teams.reduce(function(a,x){return a+x.mu},0)/Math.max(1,teams.length);teams.forEach(function(x){x.mu=0.7*x.mu+0.3*lm});
  var week=[],seen={};if(D.week<pws(L)&&teams.every(function(x){return x.g<D.week}))Object.keys(L.sides||{}).forEach(function(k){var a=L.sides[k];if(seen[a.rid])return;
    var b=Object.keys(L.sides).map(function(j){return L.sides[j]}).filter(function(o){return o.mid===a.mid&&o.rid!==a.rid})[0];if(!b)return;seen[a.rid]=seen[b.rid]=1;
    var ta=teams.filter(function(x){return x.rid===a.rid})[0],tb=teams.filter(function(x){return x.rid===b.rid})[0];
    var ma=pre?a.proj*ta.ratio:(ta.wk&&ta.wk.lines?ta.wk.tot:a.fin*ta.ratio),mb=pre?b.proj*tb.ratio:(tb.wk&&tb.wk.lines?tb.wk.tot:b.fin*tb.ratio);
    week.push({a:a.rid,b:b.rid,fa:pre?a.proj:a.fin,fb:pre?b.proj:b.fin,sa:pre?Math.max(8,0.13*a.proj):sd(a),sb:pre?Math.max(8,0.13*b.proj):sd(b),ma:ma,mb:mb})});
  return {teams:teams,week:week,future:FUT[L.id]&&FUT[L.id].v||[],pt:pt(L),N:N,seed:L.id+':'+D.week+(pre?':pre':'')}}
function key(L){var s=0;Object.keys(L.sides||{}).forEach(function(k){s+=(L.sides[k].fin||0)*(+k%7+1)});return D.at+':'+Math.round(s)+':'+(FUT[L.id]&&FUT[L.id].v?1:0)}
var busy=0;
function run(L){if(!C||busy||!L.sides||!FUT[L.id]||!FUT[L.id].v)return MC[L.id]||null;var k=key(L),R=MC[L.id];if(R&&R.k===k)return R;
  busy=1;try{R={k:k,live:C.simulate(inputs(L,false)),pre:C.simulate(inputs(L,true)),at:Date.now()};MC[L.id]=R;return R}catch(e){console.warn('mc',e);return MC[L.id]||null}finally{busy=0}}
var _ready=null;
window.WHMC={N:N,get ver(){return VER},
  raw:null,// original deterministic standings (set below)
  get:function(L){return run(L)},
  odds:function(L){var R=run(L);if(!R)return null;var o={};Object.keys(R.live).forEach(function(r){o[r]={po:R.live[r].po,top:R.live[r].top}});return o},
  ready:function(){if(_ready)return _ready;var all=Promise.all(lgSet().map(fut));
    _ready=Promise.race([all,new Promise(function(res){setTimeout(res,6000)})]).then(function(){VER++});
    all.then(function(){VER++;D.M=null;if(window.softRender)softRender()});return _ready}};
// wrap standings(): same object shape as before, but slot / slot0 / pNon / bubble come from the simulator once it has run
WHMC.raw=window.standings;
window.standings=function(L){var o=WHMC.raw(L),R=run(L);if(!R)return o;
  Object.keys(o).forEach(function(k){var x=o[k],a=R.live[k],b=R.pre[k];if(!a)return;if(x.slotDet==null)x.slotDet=x.slot;
    x.slot=a.slot;x.slot0=b?b.slot:a.slot;x.slotLo=a.slotLo;x.slotHi=a.slotHi;x.slotAvg=a.slotAvg;x.poOdds=a.po;x.topOdds=a.top;x.winsAvg=a.winsAvg;
    x.pNon=1-a.po;x.bubble=Math.min(1,4*a.po*(1-a.po));x.mc=1});return o};
(window.afterBoot=window.afterBoot||[]).push(function(){WHMC.ready()});
})();

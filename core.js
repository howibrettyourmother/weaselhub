'use strict';
// Weasel Hub core: pure season simulator, no DOM. One canonical model for playoff odds AND the projected rookie draft order,
// shared by Home, Standings, Picks, Live Pick Watch, Draft and pick values in Trade. Unit-tested in tests/core.test.js (node).
// Draft rule (Brett's leagues): non-playoff teams pick first by LOWEST max PF; playoff teams after them by playoff FINISH
// (champion picks last, runner-up next-to-last, then 3rd, 4th, then first-round losers, worse seed first).
(function(root){
function hash(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){var a=hash(seed)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function gauss(r){var u=r()||1e-9,v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v)}
// standard bracket order for a power-of-two field, e.g. 8 -> [1,8,4,5,2,7,3,6]
function seedOrder(size){var o=[1];while(o.length<size){var n=o.length*2,x=[];o.forEach(function(s){x.push(s,n+1-s)});o=x}return o}
// seeds: roster ids, best seed first. beat(a,b) -> true if a wins. Returns roster ids from champion down to the worst playoff finisher.
function bracketFinish(seeds,beat){var pt=seeds.length;if(pt<2)return seeds.slice();var size=1;while(size<pt)size*=2;
  var slots=seedOrder(size).map(function(s){return s<=pt?{rid:seeds[s-1],seed:s}:null}),tiers=[];
  while(slots.length>1){var next=[],lost=[];for(var i=0;i<slots.length;i+=2){var a=slots[i],b=slots[i+1];
      if(!a||!b){next.push(a||b);continue}if(beat(a.rid,b.rid)){next.push(a);lost.push(b)}else{next.push(b);lost.push(a)}}
    tiers.push(lost);slots=next}
  var champ=slots[0],out=[champ.rid],fin=tiers[tiers.length-1]||[];fin.forEach(function(x){out.push(x.rid)});
  var semi=tiers.length>=2?tiers[tiers.length-2]:[];
  if(semi.length===2){if(beat(semi[0].rid,semi[1].rid))out.push(semi[0].rid,semi[1].rid);else out.push(semi[1].rid,semi[0].rid)}
  else semi.slice().sort(function(a,b){return a.seed-b.seed}).forEach(function(x){out.push(x.rid)});
  for(var t=tiers.length-3;t>=0;t--)tiers[t].slice().sort(function(a,b){return a.seed-b.seed}).forEach(function(x){out.push(x.rid)});
  return out}
// draft order (first pick first) from final seeds, final max PF and the playoff finish
function draftOrder(seeds,pt,mpf,finish){var non=seeds.slice(pt).sort(function(a,b){return mpf[a]-mpf[b]});return non.concat(finish.slice().reverse())}
/* simulate(inp) inp = {
   teams:[{rid,w,t,pf,mpf,mu,ratio}]   current wins/ties/PF/max PF, scoring strength mu (pts/wk), max-PF-to-PF ratio
   week:[{a,b,fa,fb,sa,sb,ma,mb}]     this week's games not yet in the standings: projected finals fa/fb, sd sa/sb, best-lineup totals ma/mb
   future:[[ [a,b],... ], ...]         remaining regular-season weeks after this one (pairs of roster ids); [] for a week = no schedule known
   pt, N, seed }
   -> {rid:{po,top,slotAvg,slotLo,slotHi,slot,winsAvg}} with slot = canonical integer draft slot (1 = first pick)                       */
function simulate(inp){var T=inp.teams,rids=T.map(function(x){return x.rid}),n=rids.length,pt=Math.min(inp.pt||Math.floor(n/2),n),N=inp.N||3000,r=rng(inp.seed||'wh');
  var by={};T.forEach(function(x){by[x.rid]=x});
  var acc={};rids.forEach(function(id){acc[id]={po:0,top:0,slot:0,wins:0,hist:new Array(n+1).fill(0)}});
  for(var s=0;s<N;s++){var W={},PF={},M={},MU={};
    rids.forEach(function(id){var x=by[id];W[id]=x.w+(x.t||0)/2;PF[id]=x.pf;M[id]=x.mpf;MU[id]=x.mu*(1+0.08*gauss(r))});
    (inp.week||[]).forEach(function(g){var za=gauss(r),zb=gauss(r),sa=g.fa+za*g.sa,sb=g.fb+zb*g.sb;PF[g.a]+=sa;PF[g.b]+=sb;M[g.a]+=g.ma+za*g.sa;M[g.b]+=g.mb+zb*g.sb;
      if(sa>sb)W[g.a]++;else W[g.b]++});
    (inp.future||[]).forEach(function(wk){var played={};(wk||[]).forEach(function(p){var a=p[0],b=p[1];if(!by[a]||!by[b])return;var sa=MU[a]*(1+0.2*gauss(r)),sb=MU[b]*(1+0.2*gauss(r));
        PF[a]+=sa;PF[b]+=sb;M[a]+=sa*by[a].ratio;M[b]+=sb*by[b].ratio;played[a]=played[b]=1;if(sa>sb)W[a]++;else W[b]++});
      rids.forEach(function(id){if(!played[id]){var sx=MU[id]*(1+0.2*gauss(r));PF[id]+=sx;M[id]+=sx*by[id].ratio}})});
    var seeds=rids.slice().sort(function(a,b){return W[b]-W[a]||PF[b]-PF[a]});
    var fin=bracketFinish(seeds.slice(0,pt),function(a,b){return MU[a]*(1+0.2*gauss(r))>MU[b]*(1+0.2*gauss(r))});
    var ord=draftOrder(seeds,pt,M,fin);
    seeds.slice(0,pt).forEach(function(id){acc[id].po++});acc[seeds[0]].top++;
    ord.forEach(function(id,i){acc[id].slot+=i+1;acc[id].hist[i+1]++});rids.forEach(function(id){acc[id].wins+=W[id]})}
  var out={};rids.forEach(function(id){var a=acc[id],c=0,lo=null,hi=null;for(var k=1;k<=n;k++){c+=a.hist[k];if(lo==null&&c>=0.1*N)lo=k;if(hi==null&&c>=0.9*N)hi=k}
    out[id]={po:a.po/N,top:a.top/N,slotAvg:a.slot/N,slotLo:lo,slotHi:hi,winsAvg:a.wins/N,hist:a.hist.map(function(v){return v/N})}});
  rids.slice().sort(function(a,b){return out[a].slotAvg-out[b].slotAvg||by[a].mpf-by[b].mpf}).forEach(function(id,i){out[id].slot=i+1});
  return out}
var API={hash:hash,rng:rng,gauss:gauss,seedOrder:seedOrder,bracketFinish:bracketFinish,draftOrder:draftOrder,simulate:simulate};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.WHCORE=API})(typeof window!=='undefined'?window:this);

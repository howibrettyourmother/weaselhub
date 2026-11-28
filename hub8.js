'use strict';
// Weasel Hub Playoff Machine (#machine): pick remaining-game winners in each league and watch
// projected playoff + Toilet Bowl brackets update. Bracket format comes from that league's
// Sleeper settings (playoff_teams, playoff_week_start, playoff_round_type) plus the live
// winners_bracket / losers_bracket (rounds, byes, from-pointers, whether winners advance).
// There is no loser_bracket_type field in the Sleeper API. Seeding uses wins (ties as ½)
// then points for — the same tiebreak as Standings. Unlocked seeds show the likeliest team
// with a %. Same bracket component as SHADYNASTY HQ.
(function(){
function S_(L){return L.raw.settings||{}}
function nTeams(L){return Object.keys(L.rosters).length}
function ptOf(L){return +S_(L).playoff_teams||Math.floor(nTeams(L)/2)}
function pwsOf(L){return +S_(L).playoff_week_start||15}
function rec(t){return t.w+'-'+t.l+(t.t?'-'+t.t:'')}
function ppg(t){return t.pf/Math.max(1,t.w+t.l+(t.t||0))}
function pc(x){return x>=0.995?'>99%':x>0&&x<0.005?'<1%':Math.round(x*100)+'%'}
function LK(L){return 'wh:scen:'+L.id}
function enc(locks,G){return G.filter(function(g){return locks[g.k]!=null}).map(function(g){return g.w+'.'+g.a+'-'+g.b+'.'+locks[g.k]}).join(',')}
function dec(s,G){var L={};String(s||'').split(',').forEach(function(x){var m=/^(\d+)\.(\d+)-(\d+)\.(\d+)$/.exec(x);if(!m)return;var g=G.filter(function(g){return g.w===+m[1]&&((g.a===+m[2]&&g.b===+m[3])||(g.a===+m[3]&&g.b===+m[2]))})[0];if(g&&(+m[4]===g.a||+m[4]===g.b))L[g.k]=+m[4]});return L}
function poWeek(st,r){var pws=+st.playoff_week_start||15;return (+st.playoff_round_type||0)===2?pws+(r-1)*2:pws+r-1}
function seedRank(T){var ids=Object.keys(T).map(Number).sort(function(a,b){return (T[b].w+(T[b].t||0)/2)-(T[a].w+(T[a].t||0)/2)||T[b].pf-T[a].pf||a-b});var m={};ids.forEach(function(id,i){m[id]=i+1});return m}
function annotate(br,sm){return (br||[]).map(function(m){return {m:m.m,r:m.r,p:m.p,t1_from:m.t1_from,t2_from:m.t2_from,s1:m.t1!=null?sm[m.t1]:null,s2:m.t2!=null?sm[m.t2]:null}})}
function standardSix(start){return [{m:1,r:1,s1:start+3,s2:start+4},{m:2,r:1,s1:start+5,s2:start+2},{m:3,r:2,s1:start,t2_from:{w:1}},{m:4,r:2,s1:start+1,t2_from:{w:2}},{m:5,r:2,p:5,t1_from:{l:1},t2_from:{l:2}},{m:6,r:3,p:1,t1_from:{w:3},t2_from:{w:4}},{m:7,r:3,p:3,t1_from:{l:3},t2_from:{l:4}}]}
function standardFour(start){return [{m:1,r:1,s1:start,s2:start+3},{m:2,r:1,s1:start+1,s2:start+2},{m:3,r:2,p:1,t1_from:{w:1},t2_from:{w:2}},{m:4,r:2,p:3,t1_from:{l:1},t2_from:{l:2}}]}
function standardEight(start){return [{m:1,r:1,s1:start,s2:start+7},{m:2,r:1,s1:start+3,s2:start+4},{m:3,r:1,s1:start+1,s2:start+6},{m:4,r:1,s1:start+2,s2:start+5},{m:5,r:2,t1_from:{w:1},t2_from:{w:2}},{m:6,r:2,t1_from:{w:3},t2_from:{w:4}},{m:7,r:2,p:5,t1_from:{l:1},t2_from:{l:2}},{m:8,r:2,p:7,t1_from:{l:3},t2_from:{l:4}},{m:9,r:3,p:1,t1_from:{w:5},t2_from:{w:6}},{m:10,r:3,p:3,t1_from:{l:5},t2_from:{l:6}}]}
function standardBracket(n,start){start=start||1;if(n===6)return standardSix(start);if(n===4)return standardFour(start);if(n===8)return standardEight(start);return standardSix(start)}
function likelySeeds(T,S,CL,locked){var ids=Object.keys(T).map(Number),n=ids.length,out=[];
  if(locked){var ord=ids.slice().sort(function(a,b){return CL[b].W-CL[a].W||T[b].pf-T[a].pf||a-b});ord.forEach(function(id,i){out[i+1]={rid:id,p:1,locked:true}});return out}
  for(var s=1;s<=n;s++){var best=ids[0],p=-1;ids.forEach(function(i){var x=S[i]&&S[i].seed?S[i].seed[s-1]||0:0;if(x>p||(x===p&&best!=null&&(CL[i].W>CL[best].W||(CL[i].W===CL[best].W&&T[i].pf>T[best].pf)))){p=x;best=i}});out[s]={rid:best,p:p,locked:p>=0.995}}
  return out}
function avHTML(t){return t&&t.av?'<img class="av" src="'+esc(t.av)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':''}
function brLab(m,kind){return m.p===1?(kind==='tb'?'🚽 TOILET BOWL FINAL':'🏆 CHAMPIONSHIP'):m.p?(kind==='tb'?'Consolation · ':'')+m.p+(m.p===3?'rd':'th')+' place':''}
function byeSeedsOf(br){var seen={},byes=[];(br||[]).slice().sort(function(a,b){return a.r-b.r||a.m-b.m}).forEach(function(m){if(m.r>1){if(m.s1&&!m.t1_from&&!seen[m.s1])byes.push(m.s1);if(m.s2&&!m.t2_from&&!seen[m.s2])byes.push(m.s2)}if(m.s1)seen[m.s1]=1;if(m.s2)seen[m.s2]=1});return byes}
function winnersAdvance(br){return (br||[]).some(function(m){return (m.t1_from&&m.t1_from.w)||(m.t2_from&&m.t2_from.w)})}
function resolveSide(from,seed,br,seeds,T,picks,cache){
  if(from){var mid=from.w||from.l,src=(br||[]).filter(function(x){return x.m===mid})[0];if(!src)return null;
    var occ=resolveMatch(src,br,seeds,T,picks,cache);if(!occ.a||!occ.b)return null;
    var pick=picks[src.m];
    if(pick!=null){var w=occ.a.rid===pick?occ.a:occ.b.rid===pick?occ.b:null;if(!w)return null;var l=w===occ.a?occ.b:occ.a,x=from.w?w:l;return {rid:x.rid,seed:x.seed,chalk:false,t:T[x.rid]}}
    var hi=occ.a.seed<=occ.b.seed?occ.a:occ.b,lo=hi===occ.a?occ.b:occ.a,x=from.w?hi:lo;
    return {rid:x.rid,seed:x.seed,chalk:true,t:T[x.rid]}}
  if(seed){var s=seeds[seed],t=s&&T[s.rid];return t?{rid:t.rid,seed:seed,chalk:false,t:t,p:s.p,locked:s.locked}:null}
  return null}
function resolveMatch(m,br,seeds,T,picks,cache){if(cache[m.m])return cache[m.m];cache[m.m]={a:null,b:null,m:m};
  cache[m.m].a=resolveSide(m.t1_from,m.s1,br,seeds,T,picks,cache);cache[m.m].b=resolveSide(m.t2_from,m.s2,br,seeds,T,picks,cache);return cache[m.m]}
function prunePicks(br,seeds,T,picks){var cache={},order=(br||[]).slice().sort(function(a,b){return a.r-b.r||a.m-b.m});
  order.forEach(function(m){var occ=resolveMatch(m,br,seeds,T,picks,cache),w=picks[m.m];
    if(w!=null&&!((occ.a&&occ.a.rid===w)||(occ.b&&occ.b.rid===w)))delete picks[m.m]})}
function champOf(br,seeds,T,picks,adv){var fin=(br||[]).filter(function(m){return m.p===1})[0];if(!fin||picks[fin.m]==null)return null;
  var occ=resolveMatch(fin,br,seeds,T,picks,{}),w=picks[fin.m];
  var winner=(occ.a&&occ.a.rid===w)?occ.a:(occ.b&&occ.b.rid===w)?occ.b:null,loser=winner&&winner===occ.a?occ.b:occ.a;
  var champ=adv===false?loser:winner;return champ&&champ.t?champ:null}
function brPickRow(side,m,kind,picks,canPick){if(!side||!side.t)return '<div class="pm-bs tbd"><i>TBD</i></div>';
  var t=side.t,picked=picks[m.m],win=picked===t.rid,lose=picked!=null&&picked!==t.rid;
  var cls=['pm-bs',win?'win':'',lose?'lose':'',side.chalk&&picked==null?'chalk':'',t.me?'me':''].filter(Boolean).join(' ');
  var pct=!side.chalk&&side.p!=null&&!side.locked?'<small class="pm-bp">'+pc(side.p)+'</small>':'';
  var inner='<span class="pm-bn">'+avHTML(t)+'<b>'+esc(t.team)+'</b></span><span class="pm-bm"><em>#'+side.seed+'</em>'+pct+'</span>';
  return canPick?'<button type="button" class="'+cls+'" data-kind="'+kind+'" data-m="'+m.m+'" data-r="'+t.rid+'" aria-pressed="'+win+'">'+inner+'</button>':'<div class="'+cls+'">'+inner+'</div>'}
function drawBracket(el,br,seeds,T,st,kind,picks,adv){picks=picks||{};if(!(br||[]).length){el.innerHTML='<div class="hint">Sleeper hasn\'t published this bracket yet.</div>';return}
  var cache={},rounds={};br.forEach(function(m){(rounds[m.r]=rounds[m.r]||[]).push(m)});var byes=byeSeedsOf(br);
  el.innerHTML=Object.keys(rounds).sort(function(a,b){return a-b}).map(function(r){var wk=poWeek(st,+r);
    var games=rounds[r].sort(function(a,b){return (a.p||0)-(b.p||0)||a.m-b.m}).map(function(m){var occ=resolveMatch(m,br,seeds,T,picks,cache),can=!!(occ.a&&occ.a.t&&occ.b&&occ.b.t);
      var cr='';if(m.p===1&&picks[m.m]!=null&&occ.a&&occ.b){var w=picks[m.m],winner=occ.a.rid===w?occ.a:occ.b,loser=winner===occ.a?occ.b:occ.a,champ=adv===false?loser:winner;if(champ&&champ.t)cr=kind==='tb'?'<div class="pm-crown tb">🚽 '+esc(champ.t.team)+' '+(adv===false?'takes the Toilet Bowl':'wins the Toilet Bowl')+'</div>':'<div class="pm-crown">👑 '+esc(champ.t.team)+' is your projected champion</div>'}
      return '<div class="pm-brm'+(m.p===1?' fin':'')+'"><div class="pm-brh">M'+m.m+(brLab(m,kind)?' · '+brLab(m,kind):'')+'</div>'+brPickRow(occ.a,m,kind,picks,can)+brPickRow(occ.b,m,kind,picks,can)+cr+'</div>'}).join('');
    var byeBox=+r===1&&byes.length?'<div class="pm-bye"><strong>FIRST-ROUND BYES</strong>'+byes.map(function(s){var x=seeds[s],t=x&&T[x.rid];return t?'<div class="pm-bs'+(t.me?' me':'')+'">'+avHTML(t)+'<span class="pm-bn"><b>'+esc(t.team)+'</b></span><span class="pm-bm"><em>#'+s+'</em>'+(x.locked?'':'<small class="pm-bp">'+pc(x.p)+'</small>')+'<span class="pill y">BYE</span></span></div>':'<div class="pm-bs tbd"><i>TBD · #'+s+'</i></div>'}).join('')+'</div>':'';
    return '<div class="pm-brc"><h4>ROUND '+r+' · WEEK '+wk+'</h4><div class="pm-brg">'+games+byeBox+'</div></div>'}).join('')}
function paintChamp(el,br,seeds,T,picks,kind,adv){if(!el)return;var c=champOf(br,seeds,T,picks,adv);
  if(!c||!c.t){el.innerHTML='';el.hidden=true;return}el.hidden=false;
  if(kind==='tb'){el.className='pm-champ tb';el.innerHTML='🚽 <b>'+esc(c.t.team)+'</b> '+(adv===false?'takes the Toilet Bowl (losers advance)':'wins the Toilet Bowl')}
  else{el.className='pm-champ';el.innerHTML='👑 <b>'+esc(c.t.team)+'</b> is your projected champion'}}
function clinch(T,games,pt,locks){var ids=Object.keys(T).map(Number),W={},Rm={};ids.forEach(function(i){W[i]=T[i].w+(T[i].t||0)/2;Rm[i]=0});
  games.forEach(function(g){var L=locks&&locks[g.k];if(L!=null)W[+L]++;else{Rm[g.a]++;Rm[g.b]++}});
  var out={},ord=ids.slice().sort(function(a,b){return W[b]-W[a]||T[b].pf-T[a].pf});
  ids.forEach(function(i){var threats=ids.filter(function(j){return j!==i&&W[j]+Rm[j]>=W[i]}).length,ahead=ids.filter(function(j){return j!==i&&W[j]>W[i]+Rm[i]}).length;
    var o={W:W[i],R:Rm[i],po:threats<pt,bye:threats<2,one:threats<1,elim:ahead>=pt,pos:ord.indexOf(i)+1};
    var first=ord[pt],lastIn=ord[pt-1];
    if(!o.po&&!o.elim){if(o.pos<=pt&&first!=null){o.magic=Math.max(1,W[first]+Rm[first]-W[i]+1);o.vs=first}
      else if(lastIn!=null){o.tragic=Math.max(1,W[i]+Rm[i]-W[lastIn]+1);o.vs=lastIn}}
    out[i]=o});return out}
function chip(c,T){return c.one?'<span class="pill y" title="Clinched the #1 seed">#1 SEED</span>':c.bye?'<span class="pill y" title="Clinched a first-round bye">BYE</span>':c.po?'<span class="pill g" title="Clinched a playoff spot">IN</span>':c.elim?'<span class="pill r" title="Mathematically eliminated">OUT</span>':c.magic?'<span class="pill" title="Wins + their losses to lock a spot">Magic '+c.magic+'</span>':c.tragic?'<span class="pill" title="Losses + their wins that knock you out">Elim '+c.tragic+'</span>':''}
function teamMap(L){var st=standings(L),T={};Object.keys(L.rosters).forEach(function(k){var s=st[k],o=ownerOf(L,+k);T[+k]={rid:+k,team:o.name,av:o.av,w:s.w,l:s.l,t:s.t,pf:s.pf,me:+k===L.me}});return T}
function pairsFrom(M,w){var by={};(M||[]).forEach(function(m){if(m.matchup_id!=null)(by[m.matchup_id]=by[m.matchup_id]||[]).push(m.roster_id)});
  return Object.keys(by).map(function(k){return by[k]}).filter(function(p){return p.length===2}).map(function(p){var a=p[0],b=p[1];return {w:w,a:a,b:b,k:w+':'+Math.min(a,b)+'-'+Math.max(a,b)}})}
function loadRem(L){var pws=pwsOf(L),last=Math.min(+S_(L).last_scored_leg||0,pws-1),weeks=[];for(var w=last+1;w<pws;w++)weeks.push(w);
  return Promise.all(weeks.map(function(w){if(w===D.week&&L.mu&&L.mu.length)return Promise.resolve(pairsFrom(L.mu,w));
    return SC(SAPI+'/v1/league/'+L.id+'/matchups/'+w,6*36e5).then(function(m){return pairsFrom(m,w)}).catch(function(){return []})})).then(function(a){return a.reduce(function(x,y){return x.concat(y)},[])})}
function loadBrackets(L){return Promise.all([
  SC(SAPI+'/v1/league/'+L.id+'/winners_bracket',30*6e4).catch(function(){return []}),
  SC(SAPI+'/v1/league/'+L.id+'/losers_bracket',30*6e4).catch(function(){return []})])}
function simSeeds(T,G,locks,pt,N,seedKey){N=N||2000;var ids=Object.keys(T).map(Number),W0={},PF0={},mu={};
  ids.forEach(function(i){W0[i]=T[i].w+(T[i].t||0)/2;PF0[i]=T[i].pf;mu[i]=ppg(T[i])});
  G.forEach(function(g){if(locks[g.k]!=null)W0[locks[g.k]]++});
  var unlocked=G.filter(function(g){return locks[g.k]==null}),out={};ids.forEach(function(i){out[i]={po:0,seed:ids.map(function(){return 0})}});
  if(!unlocked.length){var ord=ids.slice().sort(function(a,b){return W0[b]-W0[a]||PF0[b]-PF0[a]||a-b});ord.forEach(function(id,s){out[id].seed[s]=1;if(s<pt)out[id].po=1});return out}
  var rng=(window.WHCORE&&WHCORE.rng)?WHCORE.rng(seedKey||'wh-mach'):function(){return Math.random()},gauss=(window.WHCORE&&WHCORE.gauss)?WHCORE.gauss:function(r){var u=r()||1e-9,v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.2831853*v)};
  for(var k=0;k<N;k++){var W={},PF={};ids.forEach(function(i){W[i]=W0[i];PF[i]=PF0[i]});
    unlocked.forEach(function(g){var pa=mu[g.a]*(1+0.2*gauss(rng)),pb=mu[g.b]*(1+0.2*gauss(rng));PF[g.a]+=pa;PF[g.b]+=pb;if(pa>pb)W[g.a]++;else W[g.b]++});
    var o=ids.slice().sort(function(a,b){return W[b]-W[a]||PF[b]-PF[a]});o.forEach(function(id,s){out[id].seed[s]++});o.slice(0,pt).forEach(function(id){out[id].po++})}
  ids.forEach(function(i){out[i].po/=N;out[i].seed=out[i].seed.map(function(v){return v/N})});return out}

function mountLeague(box,L,arg){var T=teamMap(L),pt=ptOf(L),pws=pwsOf(L),st=S_(L),n=nTeams(L);
  Promise.all([loadRem(L),loadBrackets(L)]).then(function(res){var G=res[0],wbRaw=res[1][0]||[],lbRaw=res[1][1]||[];
    var sm=seedRank(T),wb=annotate(wbRaw,sm),lb=annotate(lbRaw,sm);
    if(!wb.length||!wb.some(function(m){return m.s1||m.s2}))wb=standardBracket(pt,1);
    if(!lb.length||!lb.some(function(m){return m.s1||m.s2}))lb=standardBracket(Math.max(2,n-pt),pt+1);
    var tbN=n-pt,tbAdv=winnersAdvance(wbRaw.length?lbRaw:lb)?'winners advance':'losers advance';
    var rMax=Math.max(0,0),i;wb.concat(lb).forEach(function(m){if(m.r>rMax)rMax=m.r});
    var wk0=poWeek(st,1),wkN=poWeek(st,rMax||3);
    var weeks=[];G.forEach(function(g){if(weeks.indexOf(g.w)<0)weeks.push(g.w)});
    var locks=arg?dec(arg,G):(LS.get(LK(L))||{});
    Object.keys(locks).forEach(function(k){if(!G.some(function(g){return g.k===k}))delete locks[k]});
    var wk=weeks[0],over=!weeks.length;
    var byeNote=byeSeedsOf(wb).length?('Seeds 1–'+byeSeedsOf(wb).length+' get first-round byes. '):'';
    var tbByes=byeSeedsOf(lb);
    box.innerHTML='<div class="sth"><h3>'+esc(L.name)+(window.hq?hq(L):'')+'</h3><span class="small muted">'+n+' teams · top '+pt+' in the playoffs · Toilet Bowl is the other '+tbN+'</span></div>'+
      (over?'<div class="hint">The regular season is over in this league, so there\'s nothing left to pick. Brackets below are the final seeds.</div>':
        '<div class="hint">Tap a team to make them win a remaining game. Brackets and odds update from your picks. Clinched / eliminated is strict math: ties go to points for.</div>'+
        '<div class="pm-wk" role="tablist"></div><div class="pm-g"></div>'+
        '<div class="pm-act"><button type="button" class="chip" data-a="chalk">⭐ Favorites win this week</button><button type="button" class="chip" data-a="clrw">Clear this week</button><button type="button" class="chip" data-a="clr">Clear all</button><button type="button" class="chip" data-a="share">🔗 Copy scenario link</button></div>')+
      '<div class="pm-sum hint"></div>'+
      '<div class="tw"><table class="stt pm-t"><thead><tr><th>#</th><th class="w">Team</th><th>W-L</th><th>Playoffs</th><th>Status</th></tr></thead><tbody></tbody></table></div>'+
      '<h3>🏆 Projected playoff bracket</h3>'+
      '<div class="hint">'+pt+'-team Sleeper bracket, '+rMax+' round'+(rMax===1?'':'s')+' in weeks '+wk0+'–'+wkN+' ('+((+st.playoff_round_type||0)===2?'two weeks per round':'one week per round')+'). '+byeNote+'Seeded by wins, then points for — same tiebreak as Standings. A % means that seed isn\'t locked; that\'s the likeliest team. <b>Tap a team in any matchup to advance them</b> to the final. Unpicked games default to the higher seed, shown faintly in later rounds. Changing a seed or an earlier pick clears later picks that no longer fit.</div>'+
      '<div class="pm-act pm-bact"><button type="button" class="chip" data-a="resetpo">↺ Reset playoff bracket</button></div>'+
      '<div class="pm-br" data-br="po" role="region" aria-label="Projected playoff bracket"></div>'+
      '<div class="pm-champ" data-champ="po" hidden></div>'+
      '<h3>🚽 Projected Toilet Bowl</h3>'+
      '<div class="hint">'+tbN+'-team losers bracket from Sleeper ('+tbAdv+').'+(tbByes.length?' Seeds '+(pt+1)+'–'+(pt+tbByes.length)+' (best of the misses) get byes.':'')+' Tap a team to pick the game winner; the '+(tbAdv==='winners advance'?'winner':'loser')+' of the final is the Toilet Bowl champ.</div>'+
      '<div class="pm-act pm-bact"><button type="button" class="chip" data-a="resettb">↺ Reset Toilet Bowl bracket</button></div>'+
      '<div class="pm-br" data-br="tb" role="region" aria-label="Projected Toilet Bowl bracket"></div>'+
      '<div class="pm-champ tb" data-champ="tb" hidden></div>';
    var wkEl=$('.pm-wk',box),gEl=$('.pm-g',box),tb=$('.pm-t tbody',box),sum=$('.pm-sum',box),poEl=$('[data-br="po"]',box),tbEl=$('[data-br="tb"]',box);
    var poChamp=$('[data-champ="po"]',box),tbChamp=$('[data-champ="tb"]',box),tbAdvW=tbAdv==='winners advance';
    var bpicks=(function(){var p=LS.get('wh:brack:'+L.id)||{};return {po:p.po&&typeof p.po==='object'?p.po:{},tb:p.tb&&typeof p.tb==='object'?p.tb:{}}})();
    var seedsNow=null;
    function saveBrack(){LS.set('wh:brack:'+L.id,{po:bpicks.po,tb:bpicks.tb})}
    function drawBrackets(){if(!seedsNow)return;
      prunePicks(wb,seedsNow,T,bpicks.po);prunePicks(lb,seedsNow,T,bpicks.tb);saveBrack();
      if(poEl)drawBracket(poEl,wb,seedsNow,T,st,'po',bpicks.po,true);if(tbEl)drawBracket(tbEl,lb,seedsNow,T,st,'tb',bpicks.tb,tbAdvW);
      paintChamp(poChamp,wb,seedsNow,T,bpicks.po,'po',true);paintChamp(tbChamp,lb,seedsNow,T,bpicks.tb,'tb',tbAdvW)}
    function save(){LS.set(LK(L),locks);try{var s=enc(locks,G);history.replaceState(null,'','#machine/'+L.id+(s?'/'+s:''))}catch(e){}}
    function drawWeeks(){if(!wkEl)return;wkEl.innerHTML=weeks.map(function(w){var nP=G.filter(function(g){return g.w===w&&locks[g.k]!=null}).length,t=G.filter(function(g){return g.w===w}).length;
      return '<button type="button" role="tab" class="chip'+(w===wk?' on':'')+'" data-w="'+w+'">WK '+w+(nP?' <small>'+nP+'/'+t+'</small>':'')+'</button>'}).join('')}
    function drawGames(){if(!gEl)return;gEl.innerHTML=G.filter(function(g){return g.w===wk}).map(function(g){var A=T[g.a],B=T[g.b],Lk=locks[g.k];if(!A||!B)return '';
      function side(X,o){return '<button type="button" class="pm-s'+(Lk===X.rid?' win':Lk===o.rid?' lose':'')+(X.me?' me':'')+'" data-k="'+g.k+'" data-r="'+X.rid+'" aria-pressed="'+(Lk===X.rid)+'">'+avHTML(X)+'<span><b>'+esc(X.team)+'</b><small>'+rec(X)+' · '+f1(ppg(X))+'/wk</small></span></button>'}
      return '<div class="pm-m">'+side(A,B)+'<span class="pm-v">vs</span>'+side(B,A)+'</div>'}).join('')||'<div class="hint">No games that week.</div>'}
    function run(){var S=simSeeds(T,G,locks,pt,2000,L.id+':'+enc(locks,G)),CL=clinch(T,G,pt,locks);
      var ids=Object.keys(T).map(Number).sort(function(a,b){return S[b].po-S[a].po||S[b].seed[0]-S[a].seed[0]||CL[b].W-CL[a].W||T[b].pf-T[a].pf});
      tb.innerHTML=ids.map(function(i,k){var t=T[i],s=S[i],c=CL[i],wl=c.W-t.w-(t.t||0)/2,lost=G.filter(function(g){return locks[g.k]!=null&&(g.a===i||g.b===i)&&locks[g.k]!==i}).length;
        return '<tr class="'+(t.me?'me':'')+(k===pt-1?' pline':'')+'"><td>'+(k+1)+'</td><td class="w"><span class="stn">'+avHTML(t)+' '+esc(t.team)+'</span></td><td>'+(t.w+wl)+'-'+(t.l+lost)+'</td><td><b>'+pc(s.po)+'</b></td><td>'+chip(c,T)+'</td></tr>'}).join('');
      var np=Object.keys(locks).length,baseCL=clinch(T,G,pt,{}),newly=ids.filter(function(i){return CL[i].po&&!baseCL[i].po}).map(function(i){return T[i].team}),gone=ids.filter(function(i){return CL[i].elim&&!baseCL[i].elim}).map(function(i){return T[i].team});
      if(sum)sum.innerHTML=over?'Final regular-season seeds.':(np?'<b>'+np+'</b> game'+(np===1?'':'s')+' picked.'+(newly.length?' Clinches: <b>'+newly.map(esc).join(', ')+'</b>.':'')+(gone.length?' Eliminates: <b>'+gone.map(esc).join(', ')+'</b>.':'')+(!newly.length&&!gone.length?' Nobody clinches or gets eliminated yet.':''):'No picks yet: these are the current odds. Tap a team to make them win.');
      seedsNow=likelySeeds(T,S,CL,!over&&np===G.length&&G.length>0);
      drawBrackets()}
    var tm=0;function later(){clearTimeout(tm);tm=setTimeout(run,30)}
    box.addEventListener('click',function(e){var bp=e.target.closest('button.pm-bs[data-m]');
      if(bp){e.stopPropagation();var kind=bp.getAttribute('data-kind'),m=+bp.getAttribute('data-m'),r=+bp.getAttribute('data-r'),P=bpicks[kind]||(bpicks[kind]={});if(P[m]===r)delete P[m];else P[m]=r;drawBrackets();return}
      var s=e.target.closest('.pm-s');if(s){var k=s.getAttribute('data-k'),r=+s.getAttribute('data-r');if(locks[k]===r)delete locks[k];else locks[k]=r;save();drawWeeks();drawGames();later();return}
      var w=e.target.closest('[data-w]');if(w){wk=+w.getAttribute('data-w');drawWeeks();drawGames();return}
      var a=e.target.closest('[data-a]');if(!a)return;var act=a.getAttribute('data-a');
      if(act==='resetpo'){bpicks.po={};drawBrackets();return}
      if(act==='resettb'){bpicks.tb={};drawBrackets();return}
      if(act==='chalk')G.filter(function(g){return g.w===wk}).forEach(function(g){locks[g.k]=ppg(T[g.a])>=ppg(T[g.b])?g.a:g.b});
      if(act==='clrw')G.filter(function(g){return g.w===wk}).forEach(function(g){delete locks[g.k]});if(act==='clr')locks={};
      if(act==='share'){var u=location.href.split('#')[0]+'#machine/'+L.id+'/'+enc(locks,G);(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){toast('🔗 Scenario link copied')}).catch(function(){toast('Copy this: '+esc(u),6000)});return}
      save();drawWeeks();drawGames();later()});
    drawWeeks();drawGames();run()}).catch(function(e){box.innerHTML='<div class="hint">Couldn\'t load this league\'s remaining games or brackets ('+esc(e.message||e)+').</div>'})}

function hashArg(){var p=(location.hash||'').replace(/^#/,'').split('/');return p[0]==='machine'&&p[1]?{id:p[1],enc:decodeURIComponent(p[2]||'')}:null}
function renderMachine(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No active leagues.</div>';return}
  var arg=hashArg();
  el.innerHTML='<section class="panel pm-page"><h2>🔮 Playoff Machine <small>WEEK '+D.week+'</small></h2><div class="hint">Pick remaining regular-season winners, then tap teams in the playoff and Toilet Bowl brackets to advance them to the final. Format comes from that league\'s own Sleeper playoff settings and live brackets. Seeded by wins, then points for — same tiebreak as <a href="#standings">Standings</a>. The header chips filter which leagues appear. Nothing is sent to Sleeper.</div><div id="pm-root">'+
    D.leagues.map(function(L){return '<div class="box stbox pm-lg" data-lg="'+L.id+'"><div class="spin">Loading '+esc(L.name)+'…</div></div>'}).join('')+'</div></section>';
  D.leagues.forEach(function(L){mountLeague($('.pm-lg[data-lg="'+L.id+'"]',el),L,arg&&arg.id===L.id?arg.enc:null)})}

EXTRA_TABS.push(['machine','🔮','MACHINE',renderMachine]);
if(window.TAB_ORDER){var g1=TAB_ORDER[1];if(g1&&g1.indexOf('machine')<0){var at=g1.indexOf('standings');g1.splice(at<0?g1.length:at+1,0,'machine')}}
function paintTabs(){if(!$('#tabs'))return;$('#tabs').innerHTML=navHTML();
  var names=['today','leagues','moves','draft','more'],ord=window.TAB_ORDER||[],cur=typeof curTab==='function'?curTab()[0]:'';
  $$('#tabs a').forEach(function(a){var k=a.getAttribute('data-k'),g='today';ord.forEach(function(arr,i){if(arr.indexOf(k)>=0)g=names[i]||g});a.setAttribute('data-g',g);a.className=k===cur?'on':''})}
paintTabs();
})();

'use strict';
// Weasel Hub round 3: Trade Finder (Trade tab), Rookie Draft War Room (new DRAFT tab), Exposure concentration (Exposure tab).
(function(){
var ORD=['','1st','2nd','3rd','4th','5th','6th','7th'],NEEDS=['QB','RB','WR','TE'];
function int(n){return Math.round(+n||0).toLocaleString('en-US')}
function spin(t){return '<div class="spin">'+esc(t||'Loading…')+'</div>'}
function pos(id){var pi=pinfo(id);return pi.pos==='?'&&D.players&&D.players[id]?D.players[id].p[0]:pi.pos}
function ageOf(L,id){return (L.V&&L.V.a[id])||(D.players&&D.players[id]&&D.players[id].a)||null}
function tep(L){var b=+(L.ss&&L.ss.bonus_rec_te)||0;return 1+0.25*Math.min(1,b)}
function val(L,id){var v=(L.V&&L.V.p[id])||0;return pos(id)==='TE'?v*tep(L):v}
function needN(L){var sf=L.rp.indexOf('SUPER_FLEX')>=0||L.rp.filter(function(p){return p==='QB'}).length>=2;return {QB:sf?2:1,RB:3,WR:4,TE:1}}
function fmtName(L){var q=L.rp.filter(function(p){return p==='QB'}).length,sf=L.rp.indexOf('SUPER_FLEX')>=0;return ((q>=2||sf)?(sf?'SF':'2QB'):'1QB')+' · '+Object.keys(L.rosters).length+'tm · '+(L.ppr>=1?'PPR':L.ppr>=0.5?'Half':'Std')+(tep(L)>1?' · TE prem':'')}
function nm(L,rid){return ownerOf(L,rid).name}
function ready(el,f,msg){el.innerHTML='<section class="panel">'+spin(msg||'Crunching values…')+'</section>';var tab=curTab()[0];
  WH_ensure().then(function(){if(curTab()[0]!==tab)return;try{f()}catch(e){console.error(e);el.innerHTML='<div class="panel err">'+esc(e.message)+'</div>'}}).catch(function(e){el.innerHTML='<div class="panel err">Could not load: '+esc(e.message)+'</div>'})}
// ======================= TRADE FINDER =======================
var TF={lg:'',tgt:'',sell:''};
function assetsOf(L,rid){var t=L.model.teams[rid],a=[];
  (t.pl||[]).forEach(function(id){var v=val(L,id);if(v<300)return;var p=pos(id);if(NEEDS.indexOf(p)<0)return;a.push({k:'p',id:id,v:v,pos:p,age:ageOf(L,id)||26,rid:rid,depth:t.by[p]?t.by[p].indexOf(id):9})});
  (t.picks||[]).forEach(function(p){if(p.v<300)return;a.push({k:'k',id:'k'+p.season+'-'+p.round+'-'+p.orig,v:p.v,pos:'PICK',age:21,s:p.season,r:p.round,o:p.orig,rid:rid})});return a}
function adj(pk){return pk.map(function(x){return x.v}).sort(function(a,b){return b-a}).reduce(function(s,v,i){return s+v*[1,0.8,0.65,0.55][i]},0)}
function raw(pk){return pk.reduce(function(s,x){return s+x.v},0)}
function avgAge(pk){var p=pk.filter(function(x){return x.k==='p'});return p.length?p.reduce(function(s,x){return s+x.age},0)/p.length:null}
function lab(L,x){return x.k==='p'?posChip(x.pos)+' '+esc(pinfo(x.id).n)+' <span class="muted small">'+(x.age?x.age+' · ':'')+int(x.v)+'</span>':'<span class="pill y">PICK</span> '+x.s+' '+ORD[x.r]+(x.o!==x.rid?' <span class="muted small">(via '+esc(nm(L,x.o))+')</span>':'')+' <span class="muted small">'+int(x.v)+'</span>'}
function fitsB(B,x){if(x.k==='k')return B.mode!=='CONTENDER';var need=B.holes.indexOf(x.pos)>=0||B.ratio[x.pos]<1;if(B.mode==='REBUILD')return x.age<=25||need&&x.age<=27;if(B.mode==='CONTENDER')return need&&x.age>=23;return need}
function ideasFor(L){var M=L.model,A=M.me,me=L.me,NC=needN(L),out=[];
  var need=A.holes.length?A.holes.slice():NEEDS.filter(function(p){return A.surplus.indexOf(p)<0}).sort(function(a,b){return A.ratio[a]-A.ratio[b]}).slice(0,2);if(!need.length)need=NEEDS.slice().sort(function(a,b){return A.ratio[a]-A.ratio[b]}).slice(0,1);
  var mine=assetsOf(L,me);
  var give=mine.filter(function(x){if(TF.sell)return x.id===TF.sell;if(x.k==='k')return A.mode!=='REBUILD'||x.r>=2;
    if(A.surplus.indexOf(x.pos)>=0&&x.depth>=1)return true;if(x.depth>=NC[x.pos])return true;
    if(A.mode==='REBUILD'&&((x.pos==='RB'&&x.age>=26)||x.age>=29))return true;return false}).sort(function(a,b){return b.v-a.v}).slice(0,TF.sell?1:10);
  var anyGive=TF.tgt?mine.filter(function(x){return need.indexOf(x.pos)<0||x.depth>=NC[x.pos]}).sort(function(a,b){return b.v-a.v}).slice(0,12):give;
  Object.keys(M.teams).forEach(function(k){var B=M.teams[k];if(B.rid===me)return;var theirs=assetsOf(L,B.rid);
    var tg=theirs.filter(function(x){if(TF.tgt)return x.id===TF.tgt;if(x.k!=='p'||x.v<1000)return false;if(need.indexOf(x.pos)<0&&!TF.sell)return false;
      var spare=B.ratio[x.pos]>=1.05||x.depth>=NC[x.pos]||(B.mode==='REBUILD'&&x.age>=26.5)||(B.mode==='CONTENDER'&&x.age<=22.5&&x.depth>=1);
      if(TF.sell)return spare||B.mode==='REBUILD';if(A.mode==='CONTENDER'&&x.age>=30&&x.pos!=='QB')return spare;return spare});
    if(TF.sell&&!fitsB(B,give[0]||{k:'p',pos:'?',age:30})&&B.holes.indexOf((give[0]||{}).pos)<0)return;
    var G=TF.tgt?anyGive:give,pk=[];G.forEach(function(a){pk.push([a])});for(var i=0;i<G.length;i++)for(var j=i+1;j<G.length;j++)pk.push([G[i],G[j]]);
    var smalls=theirs.filter(function(x){return x.v<2500});
    tg.forEach(function(t){var gets=[[t]];smalls.forEach(function(s){if(s.id!==t.id)gets.push([t,s])});
      gets.forEach(function(gt){var ga=adj(gt);pk.forEach(function(gv){var va=adj(gv),d=(va-ga)/Math.max(va,ga);if(Math.abs(d)>0.08)return;
        var fitN=gv.filter(function(x){return fitsB(B,x)}).length;if(!fitN&&!TF.tgt)return;
        var sc=(need.indexOf(t.pos)>=0?(1.2-A.ratio[t.pos])*3:0)+fitN*0.8+t.v/4000-Math.abs(d)*6-(gv.length+gt.length-2)*0.35+(d>0?0.15:0);
        if(A.mode==='CONTENDER'&&B.mode==='REBUILD')sc+=0.6;if(A.mode==='REBUILD'&&B.mode==='CONTENDER'&&(avgAge(gt)||25)<(avgAge(gv)||25))sc+=0.6;
        out.push({L:L,B:B,get:gt,give:gv,d:d,va:va,ga:ga,sc:sc,fitN:fitN,need:need})})})})});
  out.sort(function(a,b){return b.sc-a.sc});var keep=[],per={},used={};out.forEach(function(c){var kk=c.B.rid;if((per[kk]||0)>=(TF.tgt||TF.sell?3:1))return;var key=c.get.concat(c.give).map(function(x){return x.id}).sort().join();if(used[key])return;
    if(!TF.tgt&&!TF.sell&&c.get.concat(c.give).some(function(x){return used[x.id]}))return;keep.push(c);per[kk]=(per[kk]||0)+1;used[key]=1;if(!TF.tgt&&!TF.sell)c.get.concat(c.give).forEach(function(x){used[x.id]=1})});
  return {need:need,ideas:keep.slice(0,TF.tgt||TF.sell?6:5)}}
function why(c){var L=c.L,B=c.B,A=L.model.me,s=B.st||{},o=[],t=c.get[0];
  o.push(c.d>=0?'Value: they get <b>+'+int(c.va-c.ga)+'</b> on FantasyCalc (stud-adjusted), '+Math.round(c.d*100)+'% in their favor':'Value within '+Math.round(-c.d*100)+'%: close enough that it reads as fair');
  var mode=B.mode==='REBUILD'?'rebuilding':B.mode==='CONTENDER'?'contending':'stuck in the middle';o.push('They\'re '+mode+' ('+s.w+'-'+s.l+', max PF #'+(s.mpfRank?Object.keys(L.rosters).length+1-s.mpfRank:'?')+' of '+Object.keys(L.rosters).length+', contender score '+B.cs+')');
  var ag=avgAge(c.give),at=avgAge(c.get);if(B.mode==='REBUILD'&&(c.give.some(function(x){return x.k==='k'})||(ag&&at&&ag<at)))o.push('Gets younger'+(ag&&at?' ('+ag.toFixed(1)+' vs '+at.toFixed(1)+')':'')+(c.give.some(function(x){return x.k==='k'})?' and adds draft capital':''));
  if(B.mode==='CONTENDER'&&c.give.some(function(x){return x.k==='p'&&x.depth===0}))o.push('Adds a starter for the playoff push');
  c.give.forEach(function(x){if(x.k==='p'&&B.holes.indexOf(x.pos)>=0)o.push('Fills their '+x.pos+' hole (their '+x.pos+' starters are '+Math.round(B.ratio[x.pos]*100)+'% of league avg)')});
  if(B.ratio[t.pos]>=1.05)o.push('They\'re deep at '+t.pos+' ('+Math.round(B.ratio[t.pos]*100)+'% of avg), so '+esc(pinfo(t.id).n)+' is surplus to them');
  else if(t.depth>=needN(L)[t.pos])o.push(esc(pinfo(t.id).n)+' isn\'t a starter for them');
  var mine=[];if(c.need.indexOf(t.pos)>=0)mine.push('fills your '+t.pos+' need ('+Math.round(A.ratio[t.pos]*100)+'% of avg)');
  c.give.forEach(function(x){if(x.k==='p'&&((x.pos==='RB'&&x.age>=26)||x.age>=29))mine.push('sells '+esc(pinfo(x.id).n)+' before the age cliff')});
  return '<ul class="tf-why">'+o.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul>'+(mine.length?'<div class="small" style="color:var(--gold)">For you: '+mine.join('; ')+'.</div>':'')}
function tfHTML(){var Ls=D.leagues.filter(function(L){return L.model&&(!TF.lg||L.id===TF.lg)}),opts=function(arr,sel,ph){return '<option value="">'+ph+'</option>'+arr.map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===sel?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')};
  var tgts=[],sells=[],seenT={},seenS={};Ls.forEach(function(L){Object.keys(L.model.teams).forEach(function(k){var t=L.model.teams[k];assetsOf(L,t.rid).forEach(function(x){if(x.k!=='p')return;
    if(t.rid===L.me){if(!seenS[x.id]){seenS[x.id]=1;sells.push([x.id,pinfo(x.id).n+' ('+x.pos+', '+int(x.v)+')',x.v])}}else if(x.v>=1500&&!seenT[x.id]){seenT[x.id]=1;tgts.push([x.id,pinfo(x.id).n+' ('+x.pos+', '+(D.leagues.length>1?L.name+', ':'')+int(x.v)+')',x.v])}})});
    L.model.me.picks.forEach(function(p){if(p.v<300)return;var id='k'+p.season+'-'+p.round+'-'+p.orig;if(!seenS[id]){seenS[id]=1;sells.push([id,p.season+' '+ORD[p.round]+(p.orig!==L.me?' via '+nm(L,p.orig):'')+(D.leagues.length>1?' · '+L.name:'')+' ('+int(p.v)+')',p.v])}})});
  tgts.sort(function(a,b){return b[2]-a[2]});sells.sort(function(a,b){return b[2]-a[2]});
  var ctl='<div class="tf-ctl"><select data-tf="lg" aria-label="League">'+opts(D.leagues.map(function(L){return [L.id,L.name]}),TF.lg,'All leagues')+'</select><select data-tf="tgt" aria-label="Target player">'+opts(tgts,TF.tgt,'🎯 Any target')+'</select><select data-tf="sell" aria-label="Sell player">'+opts(sells,TF.sell,'💸 Any sell')+'</select>'+(TF.tgt||TF.sell||TF.lg?'<button class="chip" data-tf-clear>Clear</button>':'')+'</div>';
  var body=Ls.map(function(L){var R=ideasFor(L),A=L.model.me;if(!R.ideas.length&&(TF.tgt||TF.sell))return '';
    return '<h3>'+esc(L.name)+' <span class="pill '+(A.mode==='CONTENDER'?'g':A.mode==='REBUILD'?'r':'y')+'">'+A.mode+'</span> <span class="muted small" style="text-transform:none;letter-spacing:0">'+esc(fmtName(L))+'</span></h3><div class="small muted">You need: '+R.need.join(', ')+' · your surplus: '+(A.surplus.filter(function(p){return R.need.indexOf(p)<0}).join(', ')||'depth only')+'</div>'+
     (R.ideas.length?R.ideas.map(function(c){return '<div class="box tf-c"><div class="tf-p">🤝 <b>'+esc(nm(L,c.B.rid))+'</b> <span class="pill '+(c.B.mode==='CONTENDER'?'g':c.B.mode==='REBUILD'?'r':'y')+'">'+c.B.mode+'</span> <span class="muted small">needs '+(c.B.holes.join(', ')||'depth')+'</span></div><div class="tf-g"><div><div class="small" style="color:var(--for)">YOU GET · '+int(raw(c.get))+'</div>'+c.get.map(function(x){return '<div>'+lab(L,x)+'</div>'}).join('')+'</div><div><div class="small" style="color:var(--ag)">YOU SEND · '+int(raw(c.give))+'</div>'+c.give.map(function(x){return '<div>'+lab(L,x)+'</div>'}).join('')+'</div></div><div class="small">Δ for them <b class="'+(c.d>=0?'pe':'ne')+'">'+(c.d>=0?'+':'−')+int(Math.abs(c.va-c.ga))+'</b> adj. · raw '+(raw(c.give)-raw(c.get)>=0?'+':'−')+int(Math.abs(raw(c.give)-raw(c.get)))+'</div><div class="small" style="margin-top:4px"><b>Why they\'d accept</b></div>'+why(c)+'<a class="small" href="https://sleeper.com/leagues/'+L.id+'/trade" target="_blank" rel="noopener">Propose in Sleeper ↗</a></div>'}).join(''):'<div class="empty">No fair fit right now.</div>')}).join('');
  return '<section class="panel" id="tfind"><h2>🔎 Trade Finder</h2><div class="hint">Every roster scanned. Your surplus (deep positions, non-starters, aging vets if you\'re rebuilding, picks if you\'re contending) matched against each team\'s holes and mode (contender = record 45% + starter value 35% + PF 20%). Fair = within 8% on FantasyCalc after a stud adjustment (2nd/3rd pieces count 80%/65%, so 2-for-1s have to overpay). Values match each league\'s format; TE premium leagues bump TEs 25%.</div>'+ctl+(body||'<div class="empty">Nothing fair for that filter. Try another player.</div>')+'<div class="hint" style="margin-top:8px">Values: <a href="https://fantasycalc.com" target="_blank" rel="noopener">FantasyCalc</a> dynasty, refreshed daily.</div></section>'}
function bindTF(el){$$('[data-tf]',el).forEach(function(s){s.onchange=function(){TF[s.getAttribute('data-tf')]=s.value;if(s.getAttribute('data-tf')==='tgt'&&s.value)TF.sell='';if(s.getAttribute('data-tf')==='sell'&&s.value)TF.tgt='';draw(el)}});var c=$('[data-tf-clear]',el);if(c)c.onclick=function(){TF={lg:'',tgt:'',sell:''};draw(el)}}
function draw(el){var x=$('#tfind',el);var h=tfHTML();if(x)x.outerHTML=h;else el.insertAdjacentHTML('afterbegin',h);bindTF(el)}
EXTRA_TABS.forEach(function(t){if(t[0]!=='trade')return;var orig=t[3];t[3]=function(el){orig(el);WH_ensure().then(function(){if(curTab()[0]!=='trade')return;draw(el)}).catch(function(e){console.warn('tf',e)})}});
// ======================= ROOKIE DRAFT WAR ROOM =======================
// 2027 superflex rookie board: consensus of DraftSharks + Dynasty Nerds SF rankings as of Oct 2026 (same board as SHADYNASTY HQ's Draft Room).
var BOARD27=[["Jeremiah Smith","WR","Ohio State"],["Dante Moore","QB","Oregon"],["Arch Manning","QB","Texas"],["Darian Mensah","QB","Miami"],["Trinidad Chambliss","QB","Ole Miss"],["Jadan Baugh","RB","Florida"],["Kewan Lacy","RB","Ole Miss"],["Cam Coleman","WR","Texas"],["Charlie Becker","WR","Indiana"],["Jamari Johnson","TE","Oregon"],["Drew Mestemaker","QB","Oklahoma State"],["CJ Carr","QB","Notre Dame"],["Julian Sayin","QB","Ohio State"],["KJ Duff","WR","Rutgers"],["Ahmad Hardy","RB","Missouri"],["Ryan Coleman-Williams","WR","Alabama"],["Nick Marsh","WR","Indiana"],["Trey'Dez Green","TE","LSU"],["Jayden Maiava","QB","USC"],["Nate Frazier","RB","Georgia"],["LaNorris Sellers","QB","South Carolina"],["Reed Harris","WR","Arizona State"],["Bryant Wesco Jr.","WR","Clemson"],["Mark Fletcher Jr.","RB","Miami"],["Antwan Raymond","RB","Rutgers"]];
function nrm(n){return String(n||'').toLowerCase().replace(/[^a-z]/g,'').replace(/(jr|sr|ii|iii|iv)$/,'')}
function order(L){var st=standings(L),NEXT=+L.raw.season+1,ord=Object.keys(st).map(function(k){return st[k]}).sort(function(a,b){return a.slot-b.slot});
  function owner(r,rid){var t=(L.traded||[]).filter(function(x){return +x.season===NEXT&&+x.round===r&&x.roster_id===rid})[0];return t?t.owner_id:rid}
  var n=ord.length,rounds=+(L.raw.settings||{}).draft_rounds||4,mr=Math.min(rounds,Math.max(2,Math.floor(BOARD27.length/n))),picks=[];
  for(var r=1;r<=rounds;r++)ord.forEach(function(x,i){picks.push({r:r,n:i+1,no:(r-1)*n+i+1,orig:x.rid,own:owner(r,x.rid),po:x.po})});return {picks:picks,n:n,NEXT:NEXT,mr:mr}}
function mock(L,O){var avail=BOARD27.map(function(b,i){return {nm:b[0],pos:b[1],sch:b[2],rk:i+1}}),M=L.model;
  return O.picks.filter(function(p){return p.r<=O.mr}).map(function(p){if(!avail.length)return Object.assign({},p,{pl:null});var t=M.teams[p.own];var best=avail.map(function(a){return {a:a,s:a.rk-(t&&t.holes.indexOf(a.pos)>=0?2.5:0)-(a.pos==='QB'&&needN(L).QB>=2&&t&&t.ratio.QB<1?1:0)}}).sort(function(x,y){return x.s-y.s})[0].a;
    avail.splice(avail.indexOf(best),1);return Object.assign({},p,{pl:best})})}
var DR={};function liveDraft(L){var NEXT=String(+L.raw.season+1);return SC(SAPI+'/v1/league/'+L.id+'/drafts',10*6e4).then(function(ds){var d=(ds||[]).filter(function(x){return String(x.season)===NEXT}).sort(function(a,b){return (b.created||0)-(a.created||0)})[0];if(!d)return null;
  if(d.status==='pre_draft')return {d:d,picks:[],tp:[]};return Promise.all([J(SAPI+'/v1/draft/'+d.draft_id+'/picks?_='+Date.now()),J(SAPI+'/v1/draft/'+d.draft_id+'/traded_picks').catch(function(){return []}),J(SAPI+'/v1/draft/'+d.draft_id+'?_='+Date.now())]).then(function(r){return {d:r[2]||d,picks:r[0]||[],tp:r[1]||[]}})})}
function assist(L,X){var d=X.d,s=d.settings||{},n=s.teams||Object.keys(L.rosters).length,rounds=s.rounds||3,snake=d.type==='snake',s2r=d.slot_to_roster_id||{},picked={};
  X.picks.forEach(function(p){var m=p.metadata||{};picked[nrm((m.first_name||'')+(m.last_name||''))]=1;picked['id'+p.player_id]=1});
  function ownerAt(no){var r=Math.ceil(no/n),i=(no-1)%n+1,slot=snake&&r%2===0?n+1-i:i,orig=+s2r[slot];var t=(X.tp||[]).filter(function(x){return +x.round===r&&+x.roster_id===orig})[0];return {r:r,i:i,orig:orig,own:t?+t.owner_id:orig}}
  var next=X.picks.length+1,mine=[];for(var no=next;no<=n*rounds;no++){var o=ownerAt(no);if(o.own===L.me)mine.push(Object.assign({no:no},o))}
  var left=BOARD27.map(function(b,i){return {nm:b[0],pos:b[1],sch:b[2],rk:i+1,v:0}}).filter(function(b){return !picked[nrm(b.nm)]});
  // after the NFL draft FantasyCalc lists the rookies: add any unpicked first-year players it values
  if(D.players)Object.keys(L.V.p).forEach(function(id){var p=D.players[id];if(!p||p.y!==0||picked['id'+id])return;var k=nrm(p.n);var b=left.filter(function(x){return nrm(x.nm)===k})[0];if(b)b.v=val(L,id);else left.push({nm:p.n,pos:p.p[0],sch:p.t||'',rk:99,v:val(L,id),id:id})});
  var A=L.model.me;left.forEach(function(b){b.s=(b.v?b.v/100:0)+(100-b.rk)+(A.holes.indexOf(b.pos)>=0?4:0)+(b.pos==='QB'&&needN(L).QB>=2&&A.ratio.QB<1.05?2:0)});left.sort(function(a,b){return b.s-a.s});
  var cur=next<=n*rounds?ownerAt(next):null;
  return '<div class="box wr-live"><div class="small"><b>'+(d.status==='drafting'?'<span class="live">● LIVE</span> ':'')+'Sleeper draft '+esc(d.status.replace('_',' '))+'</b> · '+X.picks.length+' of '+n*rounds+' picks made'+(cur?' · on the clock: <b>'+esc(nm(L,cur.own))+'</b> ('+cur.r+'.'+String(cur.i).padStart(2,'0')+')':'')+'</div>'+
   (mine.length?'<div class="small">Your next pick: <b style="color:var(--gold)">'+mine[0].r+'.'+String(mine[0].i).padStart(2,'0')+'</b> (#'+mine[0].no+', '+(mine[0].no-next)+' picks away)'+(mine.length>1?' · then '+mine.slice(1,4).map(function(m){return m.r+'.'+String(m.i).padStart(2,'0')}).join(', '):'')+'</div>':'<div class="small muted">No picks left for you in this draft.</div>')+
   '<h3>Best for your roster</h3>'+left.slice(0,5).map(function(b,i){return '<div class="flag"><div class="ic">'+(i+1)+'</div><div class="fx"><div class="ft">'+esc(b.nm)+' '+posChip(b.pos)+' <span class="muted small">'+esc(b.sch)+(b.rk<99?' · board #'+b.rk:'')+(b.v?' · FC '+int(b.v):'')+'</span>'+(A.holes.indexOf(b.pos)>=0?' <span class="pill g">FILLS '+b.pos+'</span>':'')+'</div></div></div>'}).join('')+
   '<div class="small muted">Still on the board: '+left.slice(5,20).map(function(b){return esc(b.nm)+' ('+b.pos+')'}).join(', ')+'</div></div>'}
var _wrT=null;
function renderDraft(el){ready(el,function(){
  var Ls=D.leagues,html='<section class="panel"><h2>🎓 Rookie Draft War Room <small>'+(+D.season+1)+'</small></h2><div class="hint">Projected order follows every league\'s rule: non-playoff teams by <b>lowest max PF</b> (projected to season end), then playoff teams by seed (worst first). Board: <b>2027 superflex rookie consensus of DraftSharks + Dynasty Nerds SF, as of Oct 2026</b> (all four leagues are SF/2QB). Mock: each team takes the best board player, nudged toward its weakest position. Once Sleeper creates the '+(+D.season+1)+' draft this page turns into a live assistant (who\'s left + best pick for you), refreshing every 20s while it\'s live.</div></section>';
  html+=Ls.map(function(L){var O=order(L),mk=mock(L,O),mine=O.picks.filter(function(p){return p.own===L.me});
    return '<section class="panel wr" data-wr="'+L.id+'"><h2>'+esc(L.name)+hq(L)+' <small>'+mine.length+' PICK'+(mine.length===1?'':'S')+' · '+O.picks[O.picks.length-1].r+' RDS</small></h2><div class="wr-x" id="wrl'+L.id+'"></div>'+
     '<div class="small" style="margin-bottom:6px">Your projected picks: '+(mine.length?mine.map(function(p){return '<b style="color:var(--gold)">'+p.r+'.'+String(p.n).padStart(2,'0')+'</b>'+(p.orig!==L.me?' <span class="muted">(via '+esc(nm(L,p.orig))+')</span>':'')}).join(' · '):'<span class="muted">none (traded away)</span>')+'</div>'+
     '<details'+(Ls.length===1?' open':'')+'><summary class="small" style="cursor:pointer;color:var(--gold)">Mock draft</summary><div class="wr-m">'+mk.map(function(p){var me=p.own===L.me;return '<div class="wr-p'+(me?' me':'')+'"><b>'+p.r+'.'+String(p.n).padStart(2,'0')+'</b><span>'+(p.pl?esc(p.pl.nm)+' '+posChip(p.pl.pos):'<i class="muted">off the board</i>')+'</span><small>'+(me?'YOU':esc(nm(L,p.own)))+(p.orig!==p.own?' via '+esc(nm(L,p.orig)):'')+'</small></div>'}).join('')+'</div></details></section>'}).join('');
  el.innerHTML=html;
  function live(){clearTimeout(_wrT);var anyLive=false;Promise.all(Ls.map(function(L){return liveDraft(L).then(function(X){var b=$('#wrl'+L.id);if(!b)return;if(!X){b.innerHTML='<div class="small muted">Sleeper hasn\'t created the '+(+L.raw.season+1)+' draft yet; showing the mock.</div>';return}if(X.d.status==='drafting')anyLive=true;b.innerHTML=assist(L,X)}).catch(function(){})})).then(function(){if(anyLive&&curTab()[0]==='draft')_wrT=setTimeout(live,20000)})}
  live()},'Setting up the war room…')}
EXTRA_TABS.push(['draft','🎓','DRAFT',renderDraft]);if(window.TAB_ORDER){var g=TAB_ORDER[1],i=g.indexOf('picks');g.splice(i<0?g.length:i+1,0,'draft')}
// ======================= EXPOSURE: concentration + over-exposure flags =======================
function expHTML(){var P={},tot=0,nL=D.leagues.length;D.leagues.forEach(function(L){var me=L.model&&L.model.me;if(!me)return;me.pl.forEach(function(id){var v=(L.V.p[id]||0);var x=P[id]=P[id]||{id:id,v:0,lg:[],pos:pos(id),team:pinfo(id).team||'FA'};x.v+=v;x.lg.push(L.name);tot+=v})});
  var arr=Object.keys(P).map(function(k){return P[k]}).sort(function(a,b){return b.v-a.v});if(!tot)return '';
  var byPos={},byTeam={};arr.forEach(function(x){byPos[x.pos]=(byPos[x.pos]||0)+x.v;if(x.team!=='FA')byTeam[x.team]=(byTeam[x.team]||0)+x.v});
  var posL=Object.keys(byPos).filter(function(p){return byPos[p]>0}).sort(function(a,b){return byPos[b]-byPos[a]}),teamL=Object.keys(byTeam).sort(function(a,b){return byTeam[b]-byTeam[a]}).slice(0,10);
  var flags=[];arr.forEach(function(x){var s=x.v/tot;if(s>=0.06)flags.push('<b>'+esc(pinfo(x.id).n)+'</b> is '+(s*100).toFixed(1)+'% of everything you own'+(x.lg.length>1?' ('+x.lg.length+' leagues)':''));else if(x.lg.length>=3&&x.v>=6000)flags.push('<b>'+esc(pinfo(x.id).n)+'</b> on '+x.lg.length+' of '+nL+' rosters ('+(s*100).toFixed(1)+'%)')});
  teamL.forEach(function(t){var s=byTeam[t]/tot;if(s>=0.12)flags.push('<b>'+esc(t)+'</b> players are '+(s*100).toFixed(1)+'% of your value: one bad offense hits every league')});
  posL.forEach(function(p){var s=byPos[p]/tot;if((p==='RB'&&s>=0.35)||s>=0.45)flags.push('<b>'+p+'</b> is '+(s*100).toFixed(1)+'% of your value'+(p==='RB'?' (RB values decay fastest)':''))});
  function bars(list,get,flag){return list.map(function(k){var s=get(k)/tot;return '<div class="ex-b"><span>'+esc(k)+'</span><i><b style="width:'+Math.min(100,s*100*2.2).toFixed(1)+'%" class="'+(flag(k,s)?'hot':'')+'"></b></i><em>'+(s*100).toFixed(1)+'%</em></div>'}).join('')}
  return '<section class="panel" id="exconc"><h2>🎯 Concentration <small>'+arr.length+' PLAYERS · '+arr.filter(function(x){return x.lg.length>1}).length+' IN 2+</small></h2>'+
   (flags.length?'<div class="box" style="border-color:rgba(255,107,107,.45);margin-bottom:8px"><div class="small" style="color:var(--ag);font-weight:700">⚠️ Over-exposure</div><ul class="tf-why">'+flags.slice(0,8).map(function(f){return '<li>'+f+'</li>'}).join('')+'</ul></div>':'<div class="small" style="color:var(--for)">No over-exposure flags. Nicely spread.</div>')+
   '<div class="grid2"><div><h3>By position</h3>'+bars(posL,function(k){return byPos[k]},function(k,s){return (k==='RB'&&s>=0.35)||s>=0.45})+'</div><div><h3>By NFL team (top 10)</h3>'+bars(teamL,function(k){return byTeam[k]},function(k,s){return s>=0.12})+'</div></div>'+
   '<h3>Shares</h3><div class="tw"><table><tr><th>Player</th><th>Shares</th><th>Value tied up</th><th>%</th></tr>'+arr.slice(0,25).map(function(x){var s=x.v/tot;return '<tr><td class="w">'+posChip(x.pos)+' '+esc(pinfo(x.id).n)+(window.faBadge?faBadge(x.id):'')+' <span class="muted small">'+esc(x.team)+'</span>'+(s>=0.06||(x.lg.length>=3&&x.v>=6000)?' <span class="pill r">OVER</span>':'')+'</td><td>'+x.lg.length+'/'+nL+'</td><td>'+int(x.v)+'</td><td>'+(s*100).toFixed(1)+'%</td></tr>'}).join('')+'</table></div>'+
   '<div class="hint">Value tied up = FantasyCalc value in each league\'s format, summed over every roster he\'s on. Flags: one player ≥6% of all your value, or on 3+ rosters at 6,000+; one NFL team ≥12%; RB ≥35% or any position ≥45%.</div></section>'}
EXTRA_TABS.forEach(function(t){if(t[0]!=='exposure')return;var orig=t[3];t[3]=function(el){orig(el);WH_ensure().then(function(){if(curTab()[0]!=='exposure')return;var x=$('#exconc',el);var h=expHTML();if(x)x.outerHTML=h;else{var v=$('#vtrk',el);if(v)v.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('afterbegin',h)}}).catch(function(e){console.warn('exp',e)})}});
$('#tabs').innerHTML=navHTML();
})();

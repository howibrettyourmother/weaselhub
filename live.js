// Weasel Hub · LIVE tab: scoring feed for Brett's starters + opponents' starters, H2H strip, win-prob sparklines,
// who's left, game tracker, swing alerts, Pick Watch live, live roasts. Client-side only: Sleeper live stats + matchups, ESPN summaries.
(function(){
function tdOf(e){if(e.td!=null&&e.kind!=='back')return !!e.td||/\bTD\b/.test(e.raw||'');var st=e.play&&playStats(e.play,pinfo(e.id).n);return !!(st&&(st.rec_td||st.rush_td||st.pass_td))}
var LK=function(){return 'wh:live:'+D.season+':'+D.week},ST=null,POLL=45000,_busy=null,_t=null,UIL={side:'both',pos:'all',big:false,td:false,more:15};
var VIB=function(){return !!LS.get('wh:live:vib')};
var KEYS=[['pass_yd','pass yds'],['pass_td','pass TD'],['pass_int','INT'],['rush_yd','rush yds'],['rush_td','rush TD'],['rec','rec'],['rec_yd','rec yds'],['rec_td','rec TD'],['fum_lost','fumble lost'],['pass_2pt','2-pt'],['rush_2pt','2-pt'],['rec_2pt','2-pt'],['fgm','FG'],['xpm','XP'],['fgmiss','FG miss'],['xpmiss','XP miss'],['def_td','D/ST TD'],['sack','sack'],['int','INT'],['fum_rec','fum rec'],['safe','safety'],['pts_allow','pts allowed']];
var LR={lead_me:["The Weasels take the lead over {O}. Act like you've been there.","Lead change. {O} just felt a cold breeze.","Weasels on top of {O}. Somebody screenshot this."],
 lead_op:["{O} just took the lead. Rude. Temporary, but rude.","{O} is ahead. The Weasel is calm. The Weasel is not calm."],
 blow_me:["Up {m} on {O}. That's not a game, that's a crime scene.","{O} is down {m}. Somebody check on {O}."],
 blow_op:["Down {m} to {O}. Time for the bench to start apologizing."]};
function rl(k,seed,o){var a=LR[k],h=0;for(var i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))|0;return a[Math.abs(h)%a.length].replace(/\{(\w+)\}/g,function(m,q){return o[q]})}
function load(){if(ST&&ST.k===LK())return ST;ST=LS.get(LK())||null;if(!ST||ST.k!==LK())ST={k:LK(),pts:{},raw:{},ev:[],od:{},sc:{},lead:{},since:0,bv:2};if(ST.bv!==2){ST.ev=ST.ev.filter(function(e){return e.kind!=='back'});ST.needBack=1}return ST}
function save(){ST.ev=ST.ev.slice(0,250);Object.keys(ST.od).forEach(function(k){ST.od[k]=ST.od[k].slice(-160)});if(!LS.set(LK(),ST)){ST.ev=ST.ev.slice(0,80);LS.set(LK(),ST)}}
function leagues(){return D.allLeagues||D.leagues}
function sides(L){var me=L.mu.filter(function(m){return m.roster_id===L.me})[0],op=L.mu.filter(function(m){return m.roster_id===L.opp})[0];return {me:me,op:op}}
function statsDelta(a,b){a=a||{};b=b||{};var out=[];KEYS.forEach(function(k){var d=(+b[k[0]]||0)-(+a[k[0]]||0);if(Math.abs(d)<0.5)return;out.push((d>0?'+':'')+Math.round(d)+' '+k[1])});return out.join(', ')}
function abbrName(n){var p=String(n||'').split(' ');return p.length>1?p[0][0]+'.'+p.slice(1).join(' '):n}
// ESPN play text for a player in his game (most recent matching play, scoring plays preferred for TDs)
var _sum={};function summary(g){var c=_sum[g.id];if(c&&Date.now()-c.at<25000)return Promise.resolve(c.d);
  return J('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+g.id+'&_='+Date.now()).then(function(d){_sum[g.id]={at:Date.now(),d:d};return d}).catch(function(){return null})}
function playText(sm,name,td){if(!sm)return null;var full=String(name).toLowerCase(),ab=abbrName(name).toLowerCase(),last=full.split(' ').slice(-1)[0];
  if(td){var sp=(sm.scoringPlays||[]).slice().reverse().filter(function(p){return String(p.text||'').toLowerCase().indexOf(last)>=0})[0];if(sp)return sp.text+' (Q'+(sp.period&&sp.period.number)+' '+(sp.clock&&sp.clock.displayValue||'')+')'}
  var pl=[];['previous','current'].forEach(function(k){var dr=sm.drives&&sm.drives[k];if(!dr)return;(Array.isArray(dr)?dr.slice(-2):[dr]).forEach(function(x){(x.plays||[]).forEach(function(p){pl.push(p)})})});
  var hit=pl.reverse().filter(function(p){var t=String(p.text||'').toLowerCase();return t.indexOf(ab)>=0||t.indexOf(full)>=0})[0];return hit?String(hit.text).trim():null}
function scoreOf(L,m){return m?+m.points||0:0}
function poll(sim){if(_busy)return _busy;load();var now=Date.now();
  var pr=sim?Promise.resolve(sim):Promise.all([J(SAPI+'/stats/nfl/'+D.season+'/'+D.week+'?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&_='+now),refreshMatchups().then(function(){return loadGames().catch(function(){})})]).then(function(r){var m={};(r[0]||[]).forEach(function(x){m[x.player_id]=x.stats||{}});return m});
  _busy=pr.then(function(stats){D.liveStats=stats;ST.lastPoll=now;D.M=computeAll();var first=!ST.since,evs={},alerts=[];
    leagues().forEach(function(L){var S=sides(L);if(!S.me)return;var P=ST.pts[L.id]=ST.pts[L.id]||{};
      [['me',S.me],['op',S.op]].forEach(function(z){var side=z[0],m=z[1];if(!m)return;(m.starters||[]).forEach(function(id){if(!id||id==='0')return;var st=stats[id];if(!st)return;var v=scoreStats(st,L.ss);
        if(P[id]!=null&&Math.abs(v-P[id])>=0.05){var e=evs[id]=evs[id]||{id:id,at:now,legs:[],raw:statsDelta(ST.raw[id],st),td:((+st.rush_td||0)+(+st.rec_td||0)+(+st.pass_td||0)+(+st.def_td||0))>((ST.raw[id]&&((+ST.raw[id].rush_td||0)+(+ST.raw[id].rec_td||0)+(+ST.raw[id].pass_td||0)+(+ST.raw[id].def_td||0)))||0)};
          e.legs.push({lid:L.id,side:side,d:v-P[id],tot:v})}
        P[id]=v;ST.raw[id]={pass_yd:st.pass_yd,pass_td:st.pass_td,pass_int:st.pass_int,rush_yd:st.rush_yd,rush_td:st.rush_td,rec:st.rec,rec_yd:st.rec_yd,rec_td:st.rec_td,fum_lost:st.fum_lost,fgm:st.fgm,xpm:st.xpm,fgmiss:st.fgmiss,xpmiss:st.xpmiss,def_td:st.def_td,sack:st.sack,int:st.int,fum_rec:st.fum_rec,safe:st.safe,pts_allow:st.pts_allow,pass_2pt:st.pass_2pt,rush_2pt:st.rush_2pt,rec_2pt:st.rec_2pt}})});
      // score line + odds history + lead changes
      var c=(D.M.cards||[]).filter(function(x){return x.L.id===L.id})[0],me=scoreOf(L,S.me),op=scoreOf(L,S.op),odds=c?c.me.odds:null,prevO=(ST.od[L.id]||[]).slice(-1)[0];
      ST.sc[L.id]={me:me,op:op,odds:odds,dOdds:prevO&&odds!=null?odds-prevO[1]:0};
      if(odds!=null&&(!prevO||Math.abs(prevO[1]-odds)>0.002||now-prevO[0]>10*6e4))(ST.od[L.id]=ST.od[L.id]||[]).push([now,odds]);
      var lead=me>op+0.05?'me':op>me+0.05?'op':ST.lead[L.id]||null,O=ownerOf(L,L.opp).name;
      if(!first&&ST.lead[L.id]&&lead&&lead!==ST.lead[L.id]){var t=rl(lead==='me'?'lead_me':'lead_op',L.id+now,{O:O});ST.ev.unshift({kind:'swing',at:now,lid:L.id,good:lead==='me',t:'Lead change in '+L.name+': '+f1(me)+'–'+f1(op),roast:t});alerts.push({good:lead==='me',t:'🔁 Lead change · '+L.name+' '+f1(me)+'–'+f1(op),roast:t})}
      var mg=me-op;if(!first&&Math.abs(mg)>=40&&!ST['bl'+L.id]){ST['bl'+L.id]=1;ST.ev.unshift({kind:'swing',at:now,lid:L.id,good:mg>0,t:'Blowout watch in '+L.name+': '+f1(me)+'–'+f1(op),roast:rl(mg>0?'blow_me':'blow_op',L.id,{O:O,m:f1(Math.abs(mg))})})}
      if(lead)ST.lead[L.id]=lead});
    if(first){ST.since=now;ST.ev.unshift({kind:'start',at:now,t:'Live feed started: totals as of now; scoring changes from here on.'});save();return backfill()}
    var bk=ST.needBack?backfill():Promise.resolve();
    var list=Object.keys(evs).map(function(k){return evs[k]});
    return bk.then(function(){return Promise.all(list.map(function(e){var pi=pinfo(e.id),g=gameOf(pi.team);if(g)e.qc=qcOf(g);e.miss=pi.pos==='K'&&/miss/.test(e.raw||'')&&e.legs.every(function(l){return l.d<=0.05});if(!g||isNaN(+e.id))return null;return summary(g).then(function(sm){e.play=playText(sm,pi.n,e.td);if(e.play)e.play=e.play.replace(/ \(Q\d [\d:]+\)$/,'')})}))}).then(function(){
      list.forEach(function(e){e.legs.forEach(function(l){var s=ST.sc[l.lid];l.me=s.me;l.op=s.op;l.odds=s.odds;l.dOdds=s.dOdds});e.tot=e.legs.reduce(function(a,l){return a+Math.abs(l.d)},0)/Math.max(1,e.legs.length);
        ST.ev.unshift(e);if(Math.max.apply(null,e.legs.map(function(l){return Math.abs(l.d)}))>=4){var good=e.legs.some(function(l){return (l.side==='me')===(l.d>0)});alerts.push({good:good,t:'💥 '+pinfo(e.id).n+' '+(e.play||e.raw||'')})}});
      if(alerts.length){ST.alert={at:now,a:alerts.slice(0,3)};if(VIB()&&navigator.vibrate)try{navigator.vibrate(alerts.some(function(a){return /💥/.test(a.t)})?[60,40,60]:40)}catch(e){}}
      ST.ev.sort(function(a,b){return b.at-a.at});save()})}).then(function(){_busy=null;if(curTab()[0]==='live'){var el=$('#view');if(el)render(el,true)}},function(e){_busy=null;console.warn('live',e)});return _busy}
function qcOf(g){var m=String(g.detail||'').match(/(\d+:\d+) - (\d)/);return m?'Q'+m[2]+' '+m[1]:g.state==='post'?'Final':String(g.detail||'').replace(/ - /,' ')}
// parse an ESPN scoring play into this player's stat line, so league scoring gives the real points (null = can't tell)
function playStats(text,name){var t=String(text||'').replace(/\s+/g,' ').trim(),nm=normN(name),is=function(x){return normN(x)===nm},st={},m;
  var paren=(t.match(/\(([^()]*)\)\s*$/)||[])[1]||'',main=t.replace(/\s*\([^()]*\)\s*$/,'');
  if(m=main.match(/^(.+?) (\d+) Yd pass from (.+)$/)){if(is(m[1])){st.rec=1;st.rec_yd=+m[2];st.rec_td=1}else if(is(m[3])){st.pass_yd=+m[2];st.pass_td=1}}
  else if(m=main.match(/^(.+?) (\d+) Yd (?:Rush|Run)$/)){if(is(m[1])){st.rush_yd=+m[2];st.rush_td=1}}
  else if(m=main.match(/^(.+?) (\d+) Yd Field Goal$/)){if(is(m[1])){var y=+m[2];st.fgm=1;st.fgm_yds=y;st[y<20?'fgm_0_19':y<30?'fgm_20_29':y<40?'fgm_30_39':y<50?'fgm_40_49':'fgm_50p']=1}}
  if(m=paren.match(/^(.+?) (?:Kick|PAT)(.*)$/i)){if(is(m[1])){if(/fail|block|miss|no good/i.test(m[2])){st.xpmiss=1;st._miss=1}else st.xpm=1}}
  else if(m=paren.match(/^(.+?) Pass to (.+?) for Two-Point Conversion$/i)){if(is(m[1]))st.pass_2pt=1;else if(is(m[2]))st.rec_2pt=1}
  else if(m=paren.match(/^(.+?) Run for Two-Point Conversion$/i)){if(is(m[1]))st.rush_2pt=1}
  return Object.keys(st).length?st:null}
function wallMap(sm){var w={};var dr=sm&&sm.drives;if(!dr)return w;[].concat(dr.previous||[],dr.current?[dr.current]:[]).forEach(function(d){(d.plays||[]).forEach(function(p){if(p.wallclock&&p.period)w[p.period.number+'|'+(p.clock&&p.clock.displayValue)]=Date.parse(p.wallclock)})});return w}
function playAt(g,p,wm){var q=(p.period&&p.period.number)||1,cv=(p.clock&&p.clock.value)||0,k=wm[q+'|'+(p.clock&&p.clock.displayValue)];if(p.wallclock)return Date.parse(p.wallclock);if(k)return k;
  return +g.kick+(((q-1)*900+(900-cv))*2.9+(q>=3?13*60:0))*1000}// estimate: ~3h per 60 game-min + halftime
// first load mid-game: ESPN scoring plays already in the books for games with these players
function backfill(){ST.needBack=0;ST.bv=2;var ids={};leagues().forEach(function(L){var S=sides(L);[['me',S.me],['op',S.op]].forEach(function(z){if(z[1])(z[1].starters||[]).forEach(function(id){if(id&&id!=='0'&&!isNaN(+id))(ids[id]=ids[id]||[]).push({lid:L.id,side:z[0]})})})});
  var games={};Object.keys(ids).forEach(function(id){var g=gameOf(pinfo(id).team);if(g&&g.state!=='pre')games[g.id]=g});
  return Promise.all(Object.keys(games).map(function(k){var g=games[k];return summary(g).then(function(sm){var wm=wallMap(sm);(sm&&sm.scoringPlays||[]).forEach(function(p){var tx=String(p.text||''),low=tx.toLowerCase();
      Object.keys(ids).forEach(function(id){var pi=pinfo(id);if(gameOf(pi.team)!==g)return;var last=pi.n.toLowerCase().split(' ').slice(-1)[0],first=pi.n.toLowerCase().split(' ')[0];if(low.indexOf(last)<0||low.indexOf(first)<0)return;
        var at=playAt(g,p,wm);if(ST.since&&at>ST.since)return;var st=playStats(tx,pi.n);
        ST.ev.push({kind:'back',at:at,id:id,play:tx,qc:'Q'+(p.period&&p.period.number)+' '+(p.clock&&p.clock.displayValue||''),miss:!!(st&&st._miss),legs:ids[id].map(function(x){var L=leagues().filter(function(y){return y.id===x.lid})[0];return {lid:x.lid,side:x.side,d:st?scoreStats(st,L.ss):null}})})})})})})).then(function(){ST.ev.sort(function(a,b){return b.at-a.at});save()})}
// ---------- render ----------
function lgName(id){var L=leagues().filter(function(x){return x.id===id})[0];return L?L.name:'?'}
function shown(lid){return D.leagues.some(function(L){return L.id===lid})}
function spark(lid){var h=(ST.od[lid]||[]).slice(-60);if(h.length<2)return '';var w=70,ht=18,pts=h.map(function(p,i){return (i*(w/(h.length-1))).toFixed(1)+','+(ht-p[1]*ht).toFixed(1)}).join(' ');
  return '<svg width="'+w+'" height="'+ht+'" viewBox="0 0 '+w+' '+ht+'" style="display:block"><line x1="0" x2="'+w+'" y1="'+ht/2+'" y2="'+ht/2+'" stroke="rgba(255,255,255,.15)"/><polyline fill="none" stroke="'+(h[h.length-1][1]>=0.5?'var(--for)':'var(--ag)')+'" stroke-width="1.6" points="'+pts+'"/></svg>'}
function strip(){return '<div class="lvs">'+D.leagues.map(function(L){var s=ST.sc[L.id];var c=(D.M&&D.M.cards||[]).filter(function(x){return x.L.id===L.id})[0];if(!s&&c)s={me:c.me.actSum,op:c.op.actSum,odds:c.me.odds,dOdds:0};if(!s)return '';
  return '<a class="lvc" href="#sunday"><div class="small muted">'+esc(L.name)+'</div><div><b style="color:'+(s.me>=s.op?'var(--for)':'var(--ag)')+'">'+f1(s.me)+'</b>–'+f1(s.op)+'</div><div class="small">'+(s.odds!=null?'<span class="muted" style="font-size:10px">win</span> '+pct(s.odds):'')+(s.dOdds&&Math.abs(s.dOdds)>=0.005?' <span style="color:'+(s.dOdds>0?'var(--for)':'var(--ag)')+'">'+(s.dOdds>0?'▲':'▼')+Math.round(Math.abs(s.dOdds)*100)+'</span>':'')+'</div>'+spark(L.id)+'</a>'}).join('')+'</div>'}
// Who's Left: each starter is done (game final / no game), playing (in progress) or to play (not started), from the ESPN game state for his NFL team.
// "left" = projected points still to come: full projection for to-play, projection × fraction of game remaining for playing (same l.rem the win odds use).
function wlSide(sd){var o={done:0,play:0,pre:0,rem:0};sd.lines.forEach(function(l){if(l.state==='in')o.play++;else if(l.state==='pre')o.pre++;else o.done++;o.rem+=l.rem});return o}
function wlTxt(lab,o,cls){return '<div class="wls '+cls+'"><span class="wlk">'+lab+'</span> '+(o.play?'<i class="gl"></i>'+o.play+' playing · ':'')+(o.pre?o.pre+' to play · ':'')+(!o.play&&!o.pre?'all done · ':'')+'<b>~'+f1(o.rem)+'</b> left</div>'}
function whoLeft(){return D.leagues.map(function(L){var c=(D.M&&D.M.cards||[]).filter(function(x){return x.L.id===L.id})[0];if(!c)return '';
  return '<div class="wl"><div class="wln">'+esc(L.name)+'</div><div class="wlg">'+wlTxt('you',wlSide(c.me),'for')+wlTxt('them',wlSide(c.op),'ag')+'</div>'+(lateMath(c)||'')+'</div>'}).join('')}
function tracker(){var mine={};D.leagues.forEach(function(L){var S=sides(L);[['me',S.me],['op',S.op]].forEach(function(z){if(z[1])(z[1].starters||[]).forEach(function(id){if(!id||id==='0')return;var t=pinfo(id).team,g=gameOf(t);if(!g)return;var o=mine[g.id]=mine[g.id]||{g:g,me:{},op:{}};o[z[0]][pinfo(id).pos==='DEF'?t+' D/ST':pinfo(id).n.split(' ').slice(-1)[0]]=1})})});
  var gs=Object.keys(mine).map(function(k){return mine[k]});if(!gs.length)return '';
  function tm(g){return g.teams.slice().sort(function(a,b){return (a.ha==='away'?0:1)-(b.ha==='away'?0:1)})}
  function chips(o,done){return Object.keys(o.me).map(function(n){return '<span class="pc me">'+esc(n)+(done?' ✓':'')+'</span>'}).join('')+Object.keys(o.op).map(function(n){return '<span class="pc op">'+esc(n)+(done?' ✓':'')+'</span>'}).join('')}
  var live=gs.filter(function(o){return o.g.state==='in'}).sort(function(a,b){return (b.g.rz?1:0)-(a.g.rz?1:0)||a.g.kick-b.g.kick}),
      later=gs.filter(function(o){return o.g.state==='pre'}).sort(function(a,b){return a.g.kick-b.g.kick}),fin=gs.filter(function(o){return o.g.state==='post'});
  var h=live.length?'<div class="lvg">'+live.map(function(o){var g=o.g,t=tm(g),ps=g.poss&&t.filter(function(x){return x.tid===g.poss})[0];
    return '<div class="lvt'+(g.rz?' rz':'')+'"><div class="lsc">'+t.map(function(x){return (ps&&ps.ab===x.ab?'<i class="pd"></i>':'')+esc(x.ab)+' <b>'+x.score+'</b>'}).join('<span class="muted"> – </span>')+(g.rz?' <span class="rzt">RZ</span>':'')+'</div><div class="ltm">'+esc(qcOf(g))+(g.dd?' · '+esc(String(g.dd).replace(/ at .*$/,'')):'')+'</div><div class="pcs">'+chips(o)+'</div></div>'}).join('')+'</div>':'';
  if(later.length)h+='<div class="lvl"><span class="ltm">LATER</span> '+later.map(function(o){var t=tm(o.g),nm=Object.keys(o.me).length,no=Object.keys(o.op).length;return '<span class="lvx">'+esc(t[0].ab)+' @ '+esc(t[1].ab)+' <span class="muted">'+(new Date(o.g.kick).toDateString()===new Date().toDateString()?ETTIME.format(o.g.kick).replace(/^\w+ /,''):ETTIME.format(o.g.kick))+'</span>'+(nm?' <span class="for">●'+nm+'</span>':'')+(no?' <span class="ag">●'+no+'</span>':'')+'</span>'}).join('')+'</div>';
  if(fin.length)h+='<details class="lvfin"><summary class="ltm">FINAL ('+fin.length+')</summary>'+fin.map(function(o){var t=tm(o.g);return '<div class="lvf">FINAL · '+esc(t[0].ab)+' '+t[0].score+' – '+esc(t[1].ab)+' '+t[1].score+' <span class="pcs">'+chips(o,true)+'</span></div>'}).join('')+'</details>';
  return h}
function pickLive(){var rows=[];(D.M&&D.M.picks||[]).forEach(function(x){var p=x.p,st=p.st;if(!p.near||!st||!st.wk||!st.wk.lines)return;if(rows.some(function(r){return r.k===x.L.id+':'+p.rid}))return;var all=standings(x.L),avg=0,n=0;Object.keys(all).forEach(function(k){if(all[k].wk.lines){avg+=all[k].wk.tot;n++}});avg=n?avg/n:0;
  rows.push({k:x.L.id+':'+p.rid,h:'<span class="'+(st.wk.tot<avg?'pe':'ne')+'">'+(st.wk.tot<avg?'▲':'▼')+'</span> '+esc(ownerOf(x.L,p.rid).name)+' '+f1(st.wk.act)+' banked / '+f1(st.wk.tot)+' proj vs avg '+f1(avg)+' · #'+st.slot+(st.slot0&&st.slot0!==st.slot?' (was #'+st.slot0+')':'')})});
  return rows.length?'<div class="small" style="margin-top:6px"><b>🎯 Pick Watch live</b> (best-lineup pts; low is good)<br>'+rows.slice(0,5).map(function(r){return r.h}).join('<br>')+' <a href="#picks">→</a></div>':''}
function evRow(e){if(e.kind==='start')return '<div class="lve sys small muted">⏺ '+esc(e.t)+' · '+ETTIME.format(new Date(e.at))+'</div>';
  if(e.kind==='swing')return '<div class="lve sys"><div class="small"><b style="color:'+(e.good?'var(--for)':'var(--ag)')+'">'+esc(e.t)+'</b> · '+ETTIME.format(new Date(e.at))+'</div>'+(e.roast?'<div class="small" style="color:var(--gold);font-style:italic">🦦 '+esc(e.roast)+'</div>':'')+'</div>';
  var pi=pinfo(e.id),legs=e.legs.filter(function(l){return shown(l.lid)}),groups={};
  legs.forEach(function(l){var zero=l.d!=null&&Math.abs(l.d)<0.05,good=e.miss||zero?l.side==='op':l.d==null?l.side==='me':(l.side==='me')===(l.d>0),k=(good?'g':'b')+'|'+(l.d==null?'':f1(l.d));(groups[k]=groups[k]||{good:good,d:l.d,ls:[]}).ls.push(l)});
  function totH(ls){var now=false,t=ls.map(function(l){if(l.tot!=null)return l.tot;now=true;var P=ST.pts[l.lid];return P&&P[e.id]!=null?P[e.id]:null});if(t[0]==null)return '';
    var vary=t.some(function(x){return x!=null&&Math.abs(x-t[0])>=0.05});return ' <span class="ltot">· '+f1(t[0])+(now?' now':' total')+(vary?' <span class="vr" data-vt="'+esc(ls.map(function(l,i){return lgName(l.lid)+' '+(t[i]==null?'–':f1(t[i]))}).join(' · '))+'">varies</span>':'')+'</span>'}
  var gH=Object.keys(groups).map(function(k){var g=groups[k];return '<div class="small"><b style="color:'+(g.good?'var(--for)':'var(--ag)')+'">'+(g.d==null?'':'<span class="dl">'+(Math.abs(g.d)<0.05?'0 pts':(g.d>0?'+':'−')+f1(Math.abs(g.d))+' pts')+'</span> · ')+(e.miss?(g.good?'missed (good for you)':'missed'):g.good?'helps you':'hurts you')+'</b>'+totH(g.ls)+' in '+g.ls.map(function(l){return esc(lgName(l.lid))}).join(' &amp; ')+'</div>'}).join('');
  var sc=legs.filter(function(l){return l.me!=null}).map(function(l){var L=leagues().filter(function(x){return x.id===l.lid})[0];return '<div class="small muted">'+esc(ownerOf(L,L.me).name)+' <b style="color:var(--ink)">'+f1(l.me)+' – '+f1(l.op)+'</b> '+esc(ownerOf(L,L.opp).name)+(l.odds!=null?' · '+pct(l.odds)+(l.dOdds&&Math.abs(l.dOdds)>=0.005?' ('+(l.dOdds>0?'+':'−')+Math.round(Math.abs(l.dOdds)*100)+')':''):'')+'</div>'}).join('');
  var td=tdOf(e),gd=legs.some(function(l){return l.side==='me'}),bd=legs.some(function(l){return l.side==='op'});
  return '<div class="lve'+(e.kind==='back'?' back':'')+(td?' td '+(gd&&!bd?'tdg':bd&&!gd?'tdb':'tdm'):'')+'" data-at="'+e.at+'"><div class="ic">'+head(e.id)+'</div><div class="fx"><div class="ft"><span class="'+(gameOf(pi.team)&&gameOf(pi.team).state==='post'?'gdone':'')+'">'+esc(pi.n)+gmark(pi.team)+'</span> '+posChip(pi.pos)+(td?' <span class="tdx">🏈 TD</span>':'')+'</div><div class="ltm">'+ETTIME.format(new Date(e.at))+(e.qc?' · '+esc(e.qc):'')+(e.kind==='back'?' · before you opened':'')+'</div><div class="small">'+esc(e.play||e.raw||'')+'</div>'+gH+sc+'</div></div>'}
function keep(e){if(e.kind==='start')return true;if(e.kind==='swing')return shown(e.lid)&&!UIL.td;var legs=e.legs.filter(function(l){return shown(l.lid)});if(!legs.length)return false;
  if(UIL.side==='mine'&&!legs.some(function(l){return l.side==='me'}))return false;if(UIL.side==='opp'&&!legs.some(function(l){return l.side==='op'}))return false;
  if(UIL.pos!=='all'&&pinfo(e.id).pos!==UIL.pos)return false;if(UIL.big&&!legs.some(function(l){return l.d!=null&&Math.abs(l.d)>=4}))return false;if(UIL.td&&!tdOf(e))return false;return true}
var lastSeen=0;
function render(el,soft){load();if(!D.M)D.M=computeAll();var al=ST.alert&&Date.now()-ST.alert.at<3*6e4?ST.alert:null,evs=ST.ev.filter(keep).slice(0,120);
  var ch=function(k,v,lab){return '<button class="chip'+(UIL[k]===v?' on':'')+'" data-lk="'+k+'" data-lv="'+v+'">'+lab+'</button>'};
  var html=(al?'<div class="box lva" style="border-color:'+(al.a[0].good?'rgba(94,214,140,.5)':'rgba(255,107,107,.5)')+'">'+al.a.map(function(a){return '<div class="small"><b>'+esc(a.t)+'</b>'+(a.roast?' <i style="color:var(--gold)">'+esc(a.roast)+'</i>':'')+'</div>'}).join('')+'</div>':'')+
   '<section class="panel"><h2>⚡ Live <small>'+(isWindow()?'● POLLING EVERY 45s':'NO GAMES LIVE')+'</small></h2>'+strip()+tracker()+'</section>'+
   '<section class="panel"><h2>⏳ Who\'s Left <small>PROJ PTS STILL TO COME</small></h2>'+whoLeft()+'</section>'+
   '<section class="panel"><h2>📜 Feed <small>'+evs.length+' EVENTS</small></h2><div class="chips">'+ch('side','both','Both')+ch('side','mine','Mine')+ch('side','opp','Opponents')+'<span style="flex:0 0 6px"></span>'+['all','QB','RB','WR','TE','K','DEF'].map(function(p){return ch('pos',p,p==='all'?'All pos':p)}).join('')+'</div><div class="chips">'+'<button class="chip'+(UIL.td?' on':'')+'" data-td>🏈 TDs only</button><button class="chip'+(UIL.big?' on':'')+'" data-big>💥 Big plays only (≥4)</button><button class="chip'+(VIB()?' on':'')+'" data-vib>📳 Vibrate on big plays</button><button class="chip" data-poll>↻ Poll now</button></div>'+
   (evs.length?evs.slice(0,UIL.more).map(evRow).join('')+(evs.length>UIL.more?'<button class="chip" data-more style="margin:10px auto 0;display:flex">Show more ('+(evs.length-UIL.more)+')</button>':''):'<div class="empty">No scoring changes yet'+(ST.since?' since '+ETTIME.format(new Date(ST.since)):'')+'.</div>')+
   '<div class="hint">Events = changes in each starter\'s league-scored points between 45s polls of Sleeper live stats; play text from ESPN when the name matches. "earlier" rows are ESPN scoring plays from before you opened the feed. Kept for the week on this device.</div></section>'+
   (pickLive()?'<section class="panel">'+pickLive()+'</section>':'');
  el.innerHTML=html;
  if(soft&&lastSeen)$$('.lve[data-at]',el).forEach(function(r){if(+r.getAttribute('data-at')>lastSeen)r.classList.add('new')});lastSeen=Math.max(lastSeen,ST.ev.length?ST.ev[0].at:0);
  $$('[data-lk]',el).forEach(function(b){b.onclick=function(){UIL[b.getAttribute('data-lk')]=b.getAttribute('data-lv');render(el)}});
  var mb=$('[data-more]',el);if(mb)mb.onclick=function(){UIL.more+=15;render(el)};var tb=$('[data-td]',el);if(tb)tb.onclick=function(){UIL.td=!UIL.td;render(el)};var bb=$('[data-big]',el);if(bb)bb.onclick=function(){UIL.big=!UIL.big;render(el)};var vb=$('[data-vib]',el);if(vb)vb.onclick=function(){LS.set('wh:live:vib',!VIB());render(el)};
  $$('[data-vt]',el).forEach(function(v){v.onclick=function(){v.textContent=v.getAttribute('data-vt');v.className='vr on'}});
  var pb=$('[data-poll]',el);if(pb)pb.onclick=function(){pb.textContent='Polling…';poll()}}
function renderLive(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No leagues.</div>';return}render(el);if(!ST.since)poll()}
function loop(){clearTimeout(_t);_t=setTimeout(function(){if(!document.hidden&&D.leagues.length&&(isWindow()||curTab()[0]==='live'&&Date.now()-(ST&&ST.lastPoll||0)>POLL))poll().then(loop,loop);else loop()},POLL)}
window.LIVE={playStats:playStats,poll:poll,state:function(){return load()},render:render};
EXTRA_TABS.push(['live','⚡','LIVE',renderLive]);
if(window.TAB_ORDER)TAB_ORDER[0].splice(TAB_ORDER[0].indexOf('sunday')+1,0,'live');
$('#tabs').innerHTML=navHTML();
(window.afterBoot=window.afterBoot||[]).push(function(){setTimeout(function(){if(isWindow())poll();loop()},4000)});
})();

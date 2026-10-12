// Weasel Hub · LIVE tab: scoring feed for Brett's starters + opponents' starters, H2H strip, win-prob sparklines,
// who's left, game tracker, swing alerts, Pick Watch live, live roasts. Client-side only: Sleeper live stats + matchups, ESPN summaries.
(function(){
function tdOf(e){if(e.td!=null&&e.kind!=='back')return !!e.td||/\bTD\b/.test(e.raw||'');var st=e.play&&playStats(e.play,pinfo(e.id).n);return !!(st&&(st.rec_td||st.rush_td||st.pass_td))}
var LK=function(){return 'wh:live:'+D.season+':'+D.week},ST=null,POLL=45000,_busy=null,_t=null,UIL={side:'both',pos:'all',big:false,td:false,more:15};
var VIB=function(){return !!LS.get('wh:live:vib')};
var KEYS=[['pass_yd','pass yds'],['pass_td','pass TD'],['pass_int','INT'],['rush_yd','rush yds'],['rush_td','rush TD'],['rec','rec'],['rec_yd','rec yds'],['rec_td','rec TD'],['fum_lost','fumble lost'],['pass_sack','sacked'],['pass_2pt','2-pt'],['rush_2pt','2-pt'],['rec_2pt','2-pt'],['fgm','FG'],['xpm','XP'],['fgmiss','FG miss'],['xpmiss','XP miss'],['def_td','D/ST TD'],['sack','sack'],['int','INT'],['fum_rec','fum rec'],['safe','safety'],['pts_allow','pts allowed']];
var LR={lead_me:["The Weasels take the lead over {O}. Act like you've been there.","Lead change. {O} just felt a cold breeze.","Weasels on top of {O}. Somebody screenshot this."],
 lead_op:["{O} just took the lead. Rude. Temporary, but rude.","{O} is ahead. The Weasel is calm. The Weasel is not calm."],
 blow_me:["Up {m} on {O}. That's not a game, that's a crime scene.","{O} is down {m}. Somebody check on {O}."],
 blow_op:["Down {m} to {O}. Time for the bench to start apologizing."]};
function rl(k,seed,o){var a=LR[k],h=0;for(var i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))|0;return a[Math.abs(h)%a.length].replace(/\{(\w+)\}/g,function(m,q){return o[q]})}
function load(){if(ST&&ST.k===LK())return ST;ST=LS.get(LK())||null;if(!ST||ST.k!==LK())ST={k:LK(),pts:{},raw:{},ev:[],od:{},sc:{},lead:{},since:0,bv:2};if(ST.bv!==2){ST.ev=ST.ev.filter(function(e){return e.kind!=='back'});ST.needBack=1}
  // per-player points already in the feed (survives the event cap). Migrating an older state: count stored events; if the cap may have evicted
  // some, only trust games that kicked off after the oldest stored event
  if(!ST.lg){ST.lg={};var ats=[];ST.ev.forEach(function(e){if(e.legs&&e.kind!=='back'){ats.push(e.at);lgAdd(e)}});ST.lgFrom=ST.ev.length>=240&&ats.length?Math.min.apply(null,ats):0}return ST}
function lgAdd(e){e.legs.forEach(function(l){if(l.d==null)return;var m=ST.lg[l.lid]=ST.lg[l.lid]||{};m[e.id]=(m[e.id]||0)+l.d})}
function save(){ST.ev.sort(function(a,b){return b.at-a.at});ST.ev=ST.ev.slice(0,300);Object.keys(ST.od).forEach(function(k){ST.od[k]=ST.od[k].slice(-160)});if(!LS.set(LK(),ST)){try{Object.keys(localStorage).forEach(function(k){if(/^wh:live:/.test(k)&&k!==LK())localStorage.removeItem(k)});['wh:players','wh:pl','wh:proj'].forEach(function(k){localStorage.removeItem(k)})}catch(e){}
  if(!LS.set(LK(),ST)){ST.ev=ST.ev.slice(0,120);if(!LS.set(LK(),ST))console.warn('live: localStorage save failed')}}}
function leagues(){return D.allLeagues||D.leagues}
function sides(L){var me=L.mu.filter(function(m){return m.roster_id===L.me})[0],op=L.mu.filter(function(m){return m.roster_id===L.opp})[0];return {me:me,op:op}}
function statsDelta(a,b){a=a||{};b=b||{};var out=[];KEYS.forEach(function(k){var d=(+b[k[0]]||0)-(+a[k[0]]||0);if(Math.abs(d)<0.5)return;out.push((d>0?'+':'')+Math.round(d)+' '+k[1])});return out.join(', ')}
function sdiff(a,b){a=a||{};b=b||{};var o={};KEYS.forEach(function(k){var d=(+b[k[0]]||0)-(+a[k[0]]||0);if(Math.abs(d)>=0.5)o[k[0]]=Math.round(d)});return o}
// stat breakdown in league scoring: "+2 rec (+2.0), +42 rec yds (+4.2), +6 rush yds (+0.6)"
var NEGK={pass_int:1,fum_lost:1,pass_sack:1,fgmiss:1,xpmiss:1};
function breakdown(e,L){if(!e.sd)return esc(e.raw||'');var ss=L&&L.ss||{};return KEYS.filter(function(k){return e.sd[k[0]]}).map(function(k){var d=e.sd[k[0]],p=d*(+ss[k[0]]||0);
  return '<span class="'+(NEGK[k[0]]||d<0?'bdn':'')+'">'+(d>0?'+':'')+d+' '+k[1]+(Math.abs(p)>=0.05?' <span class="muted">('+(p>0?'+':'−')+f1(Math.abs(p))+')</span>':NEGK[k[0]]?' <span class="muted">(0)</span>':'')+'</span>'}).join(', ')}
// ESPN plays for this player inside the poll window; full text only when one play clearly explains the delta, else a short list
function shortPlay(t,ab,full){var x=String(t||''),l=x.toLowerCase(),me=function(s){return s.indexOf(ab)>=0||s.indexOf(full)>=0},m,yd;
  if(/pass incomplete|spikes|kneels/.test(l)&&!/intercepted/.test(l))return null;if(/no play/.test(l))return null;
  m=x.match(/for (-?\d+) yards?/i);yd=m?+m[1]:(/no gain/i.test(x)?0:null);var td=/touchdown/i.test(x);
  if(/sacked/.test(l)&&me(l.split('sacked')[0]))return {k:'sack',yd:yd,t:'sack'+(yd!=null?' '+yd:'')};
  if(/intercepted/.test(l)&&me(l.split('pass')[0]))return {k:'int',t:'INT'};
  if(/fumbles/.test(l)&&me(l.split('fumbles')[0]))return {k:'fum',t:'fumble'};
  var pm=l.match(/^(.*?)pass (?:short|deep)?.*? to ([a-z]\.[a-z'\-]+)/);
  if(pm){if(me(pm[1]))return {k:'pass',yd:yd,td:td,t:(yd!=null?yd+'-yd pass':'pass')+(td?' TD':'')};if(me(pm[2]))return {k:'catch',yd:yd,td:td,t:(yd!=null?yd+'-yd catch':'catch')+(td?' TD':'')};return null}
  if(yd!=null&&me(l.split(/ (?:up the middle|left|right|scrambles|to [a-z]{2,3} \d)/)[0]))return {k:'run',yd:yd,td:td,t:yd+'-yd run'+(td?' TD':'')};return null}
function playsFor(sm,pi,e){if(!sm)return null;var full=String(pi.n).toLowerCase(),ab=abbrName(pi.n).toLowerCase().replace(/ /g,''),last=full.split(' ').slice(-1)[0],sd=e.sd||{};
  var tdD=(sd.rush_td||0)+(sd.rec_td||0)+(sd.pass_td||0);
  if(tdD===1&&Object.keys(sd).every(function(k){return /_td$|_yd$|^rec$|2pt/.test(k)})){var sp=(sm.scoringPlays||[]).slice().reverse().filter(function(p){return String(p.text||'').toLowerCase().indexOf(last)>=0})[0];if(sp)return sp.text}
  var t0=(e.from||e.at-POLL)-120000,t1=e.at+5000,pl=[],dr=sm.drives||{};[].concat(dr.previous||[],dr.current?[dr.current]:[]).forEach(function(d){(d.plays||[]).forEach(function(p){var w=Date.parse(p.wallclock||'');if(w&&w>=t0&&w<=t1)pl.push(p)})});
  var seen={},hits=pl.filter(function(p){var k=p.id||p.text;if(seen[k])return false;seen[k]=1;return true}).map(function(p){var s2=shortPlay(p.text,ab,full);return s2&&{p:p,s:s2}}).filter(Boolean)
    .filter(function(h){return h.s.k==='sack'?sd.pass_sack>0:h.s.k==='int'?sd.pass_int>0:h.s.k==='fum'?sd.fum_lost>0:true});// never show a negative play the stat diff doesn't contain
  if(!hits.length)return null;
  // the window has slack for clock skew: keep the latest run of plays whose yards add up to the yardage delta; if none does, show nothing
  var Y=(sd.pass_yd||0)+(sd.rush_yd||0)+(sd.rec_yd||0),yy=function(h){return /run|catch|pass/.test(h.s.k)?(h.s.yd||0):0},fit=null;
  for(var i=hits.length-1;i>=0;i--){var sub=hits.slice(i),sum=sub.reduce(function(a,h){return a+yy(h)},0);if(Math.abs(sum-Y)<=1&&(i===0||Math.abs(sum+yy(hits[i-1])-Y)>1||yy(hits[i-1])===0&&hits[i-1].s.k!=='sack')){fit=sub;break}}
  if(!fit)return null;while(fit.length>1&&yy(fit[0])===0&&fit[0].s.k!=='sack'&&!fit[0].s.td)fit=fit.slice(1);hits=fit;
  if(hits.length===1){var h=hits[0],want=h.s.k==='run'?(sd.rush_yd||0):h.s.k==='catch'?(sd.rec_yd||0):h.s.k==='pass'?(sd.pass_yd||0):h.s.yd;if(h.s.yd==null||Math.abs(h.s.yd-want)<=1)return String(h.p.text).trim();return null}
  return hits.length<=6?hits.length+' plays: '+hits.map(function(h){return h.s.t}).join(', '):null}
function abbrName(n){var p=String(n||'').split(' ');return p.length>1?p[0][0]+'.'+p.slice(1).join(' '):n}
// ESPN play text for a player in his game (most recent matching play, scoring plays preferred for TDs)
var _sum={};function summary(g){var c=_sum[g.id];if(c&&Date.now()-c.at<25000)return Promise.resolve(c.d);
  return J('https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event='+g.id+'&_='+Date.now()).then(function(d){_sum[g.id]={at:Date.now(),d:d};return d}).catch(function(){return null})}
function playText(sm,name,td){if(!sm)return null;var full=String(name).toLowerCase(),ab=abbrName(name).toLowerCase(),last=full.split(' ').slice(-1)[0];
  if(td){var sp=(sm.scoringPlays||[]).slice().reverse().filter(function(p){return String(p.text||'').toLowerCase().indexOf(last)>=0})[0];if(sp)return sp.text+' (Q'+(sp.period&&sp.period.number)+' '+(sp.clock&&sp.clock.displayValue||'')+')'}
  var pl=[];['previous','current'].forEach(function(k){var dr=sm.drives&&sm.drives[k];if(!dr)return;(Array.isArray(dr)?dr.slice(-2):[dr]).forEach(function(x){(x.plays||[]).forEach(function(p){pl.push(p)})})});
  var hit=pl.reverse().filter(function(p){var t=String(p.text||'').toLowerCase();return t.indexOf(ab)>=0||t.indexOf(full)>=0})[0];return hit?String(hit.text).trim():null}
function scoreOf(L,m){return m?+m.points||0:0}
// Repair: players whose games kicked off after the feed started should have all their points in the feed. Older builds silently re-baselined
// a starter the first time he showed up in Sleeper's stats (e.g. SNF players first seen after the app was backgrounded), dropping those events.
function reconcile(stats,evs,now){var by={};leagues().forEach(function(L){var S=sides(L);[['me',S.me],['op',S.op]].forEach(function(z){if(!z[1])return;(z[1].starters||[]).forEach(function(id){if(!id||id==='0')return;var st=stats[id],g=gameOf(pinfo(id).team);if(!st||!g||!g.kick||g.kick<Math.max(ST.since,ST.lgFrom||0)-60000)return;
    var v=scoreStats(st,L.ss),logged=((ST.lg||{})[L.id]||{})[id]||0;
    var miss=v-logged;if(Math.abs(miss)<0.05)return;if(evs[id]&&evs[id].legs.some(function(l){return l.lid===L.id}))return;
    var e=by[id]=by[id]||{id:id,at:now,from:g.kick,catchup:1,legs:[],sd:logged===0?sdiff({},st):null,raw:logged===0?statsDelta({},st):'missed while the app was closed',td:false};
    if(logged===0)e.td=((+st.rush_td||0)+(+st.rec_td||0)+(+st.pass_td||0)+(+st.def_td||0))>0;e.legs.push({lid:L.id,side:z[0],d:miss,tot:v});(ST.pts[L.id]=ST.pts[L.id]||{})[id]=v})})});
  Object.keys(by).forEach(function(id){if(evs[id])evs[id].legs=evs[id].legs.concat(by[id].legs);else evs[id]=by[id]})}
function poll(sim){if(_busy)return _busy;load();var now=Date.now();
  var pr=sim?Promise.resolve(sim):Promise.all([J(SAPI+'/stats/nfl/'+D.season+'/'+D.week+'?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF&_='+now),refreshMatchups().then(function(){return loadGames().catch(function(){})})]).then(function(r){var m={};(r[0]||[]).forEach(function(x){m[x.player_id]=x.stats||{}});return m});
  _busy=pr.then(function(stats){D.liveStats=stats;var prevPoll=ST.lastPoll||ST.since||now-POLL;ST.lastPoll=now;D.M=computeAll();var first=!ST.since,evs={},alerts=[];
    leagues().forEach(function(L){var S=sides(L);if(!S.me)return;var P=ST.pts[L.id]=ST.pts[L.id]||{};
      [['me',S.me],['op',S.op]].forEach(function(z){var side=z[0],m=z[1];if(!m)return;(m.starters||[]).forEach(function(id){if(!id||id==='0')return;var st=stats[id];if(!st)return;var v=scoreStats(st,L.ss);
        if(P[id]==null&&!first){P[id]=0;ST.raw[id]={}}
        if(P[id]!=null&&Math.abs(v-P[id])>=0.05){var e=evs[id]=evs[id]||{id:id,at:now,from:prevPoll,legs:[],sd:sdiff(ST.raw[id],st),raw:statsDelta(ST.raw[id],st),td:((+st.rush_td||0)+(+st.rec_td||0)+(+st.pass_td||0)+(+st.def_td||0))>((ST.raw[id]&&((+ST.raw[id].rush_td||0)+(+ST.raw[id].rec_td||0)+(+ST.raw[id].pass_td||0)+(+ST.raw[id].def_td||0)))||0)};
          e.legs.push({lid:L.id,side:side,d:v-P[id],tot:v})}
        P[id]=v;ST.raw[id]={pass_yd:st.pass_yd,pass_td:st.pass_td,pass_int:st.pass_int,rush_yd:st.rush_yd,rush_td:st.rush_td,rec:st.rec,rec_yd:st.rec_yd,rec_td:st.rec_td,fum_lost:st.fum_lost,pass_sack:st.pass_sack,fgm:st.fgm,xpm:st.xpm,fgmiss:st.fgmiss,xpmiss:st.xpmiss,def_td:st.def_td,sack:st.sack,int:st.int,fum_rec:st.fum_rec,safe:st.safe,pts_allow:st.pts_allow,pass_2pt:st.pass_2pt,rush_2pt:st.rush_2pt,rec_2pt:st.rec_2pt}})});
      // score line + odds history + lead changes
      var c=(D.M.cards||[]).filter(function(x){return x.L.id===L.id})[0],me=scoreOf(L,S.me),op=scoreOf(L,S.op),odds=c?c.me.odds:null,prevO=(ST.od[L.id]||[]).slice(-1)[0];
      ST.sc[L.id]={me:me,op:op,odds:odds,dOdds:prevO&&odds!=null?odds-prevO[1]:0};
      if(odds!=null&&(!prevO||Math.abs(prevO[1]-odds)>0.002||now-prevO[0]>10*6e4))(ST.od[L.id]=ST.od[L.id]||[]).push([now,odds]);
      var lead=me>op+0.05?'me':op>me+0.05?'op':ST.lead[L.id]||null,O=ownerOf(L,L.opp).name;
      if(!first&&ST.lead[L.id]&&lead&&lead!==ST.lead[L.id]){var t=rl(lead==='me'?'lead_me':'lead_op',L.id+now,{O:O});ST.ev.unshift({kind:'swing',at:now,lid:L.id,good:lead==='me',t:'Lead change in '+L.name+': '+f1(me)+'–'+f1(op),roast:t});alerts.push({good:lead==='me',t:'🔁 Lead change · '+L.name+' '+f1(me)+'–'+f1(op),roast:t})}
      var mg=me-op;if(!first&&Math.abs(mg)>=40&&!ST['bl'+L.id]){ST['bl'+L.id]=1;ST.ev.unshift({kind:'swing',at:now,lid:L.id,good:mg>0,t:'Blowout watch in '+L.name+': '+f1(me)+'–'+f1(op),roast:rl(mg>0?'blow_me':'blow_op',L.id,{O:O,m:f1(Math.abs(mg))})})}
      if(lead)ST.lead[L.id]=lead});
    if(!first)reconcile(stats,evs,now);
    if(first){ST.lg={};ST.lgFrom=0;ST.since=now;ST.ev.unshift({kind:'start',at:now,t:'Live feed started: totals as of now; scoring changes from here on.'});save();return backfill()}
    var bk=ST.needBack?backfill():Promise.resolve();
    var list=Object.keys(evs).map(function(k){return evs[k]});
    return bk.then(function(){return Promise.all(list.map(function(e){var pi=pinfo(e.id),g=gameOf(pi.team);if(g)e.qc=qcOf(g);e.miss=pi.pos==='K'&&/miss/.test(e.raw||'')&&e.legs.every(function(l){return l.d<=0.05});if(!g||isNaN(+e.id))return null;return summary(g).then(function(sm){e.play=playsFor(sm,pi,e);if(e.play)e.play=e.play.replace(/ \(Q\d [\d:]+\)$/,'')})}))}).then(function(){
      list.forEach(function(e){e.legs.forEach(function(l){var s=ST.sc[l.lid];l.me=s.me;l.op=s.op;l.odds=s.odds;l.dOdds=s.dOdds});e.tot=e.legs.reduce(function(a,l){return a+Math.abs(l.d)},0)/Math.max(1,e.legs.length);
        ST.ev.unshift(e);lgAdd(e);if(Math.max.apply(null,e.legs.map(function(l){return Math.abs(l.d)}))>=4){var good=e.legs.some(function(l){return (l.side==='me')===(l.d>0)});alerts.push({good:good,t:'💥 '+pinfo(e.id).n+' '+(e.play||e.raw||'')})}});
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
function wlPl(l,kind){var pi=l.pi;return '<div class="wlp">'+head(l.id)+'<span class="wlpn">'+esc(pi.n)+' '+posChip(pi.pos)+'</span><span class="wlpm">'+
  (kind==='in'?'<i class="gl"></i>'+esc(qcOf(l.g))+' · <b>'+f1(l.act)+'</b> · ~'+f1(l.rem)+' left':esc(l.g?ETTIME.format(l.g.kick):'')+' · '+f1(l.proj)+' proj')+'</span></div>'}
function wlDetail(sd,lab,cls){var pl=sd.lines.filter(function(l){return l.state==='in'}).sort(function(a,b){return b.rem-a.rem}),pre=sd.lines.filter(function(l){return l.state==='pre'}).sort(function(a,b){return a.g.kick-b.g.kick||b.proj-a.proj}),dn=sd.lines.filter(function(l){return l.state!=='in'&&l.state!=='pre'});
  return '<div class="wld"><div class="wlk '+cls+'">'+lab+'</div>'+(pl.length?'<div class="wlh">Playing now</div>'+pl.map(function(l){return wlPl(l,'in')}).join(''):'')+(pre.length?'<div class="wlh">To play</div>'+pre.map(function(l){return wlPl(l,'pre')}).join(''):'')+
    (dn.length?'<div class="wlh wldn">Done: '+dn.map(function(l){return esc(l.pi.n.split(' ').slice(-1)[0])+' '+f1(l.act)}).join(' · ')+'</div>':'')+'</div>'}
var WLO={};
function whoLeft(){return D.leagues.map(function(L){var c=(D.M&&D.M.cards||[]).filter(function(x){return x.L.id===L.id})[0];if(!c)return '';
  return '<details class="wl" data-wl="'+L.id+'"'+(WLO[L.id]?' open':'')+'><summary><div class="wln">'+esc(L.name)+hq(L)+' <span class="wlx">▾</span></div><div class="wlg">'+wlTxt('you',wlSide(c.me),'for')+wlTxt('them',wlSide(c.op),'ag')+'</div>'+(lateMath(c)||'')+'</summary>'+
    (WLO[L.id]?wlDetail(c.me,'You','for')+wlDetail(c.op,esc(ownerOf(L,L.opp).name),'ag'):'')+'</details>'}).join('')}
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
// ---------- Pick Watch live snapshot: one card per pick team (picks Brett owns from them), live matchup, projected pick then vs now ----------
var PWO=LS.get('wh:live:pwo');if(PWO==null)PWO=true;
function pwOrder(arr,pt,live){// max-PF draft order: non-playoff teams by lowest projected season-end max PF, then playoff teams by reverse finish
  var desc=arr.slice().sort(function(a,b){return (b.W-a.W)||(b.PF-a.PF)});desc.forEach(function(x,i){x[live?'poN':'po0']=i<pt});
  var ord=DRAFT_ORDER==='all'?arr.slice().sort(function(a,b){return a.M-b.M}):desc.filter(function(x,i){return i>=pt}).sort(function(a,b){return a.M-b.M}).concat(desc.slice(0,pt).reverse());
  ord.forEach(function(x,i){x[live?'sN':'s0']=i+1})}
function pwLeague(L){var st=standings(L),n=Object.keys(L.rosters).length,pt=(L.raw.settings||{}).playoff_teams||Math.floor(n/2),sides=L.sides||{};
  var ks=Object.keys(st),live=ks.some(function(k){return st[k].wk&&st[k].wk.lines}),avg=0,na=0,avgB=0;
  ks.forEach(function(k){var w=st[k].wk;if(w&&w.lines){avg+=w.tot;avgB+=w.act||0;na++}});avg=na?avg/na:0;avgB=na?avgB/na:0;
  var mk=function(live){return ks.map(function(k){var x=st[k],s=sides[k],o=s&&s.vs,W=x.w+x.t/2,PF=x.pf;
    if(live&&s&&o&&x.wk&&x.wk.lines){var done=s.ytp+s.live+o.ytp+o.live===0;W+=done?(s.act>o.act?1:s.act===o.act?0.5:0):(s.odds>=0.5?1:0);PF+=done?s.act:s.fin}
    return {rid:+k,W:W,PF:PF,M:live?x.mpfEnd:x.mpfEnd0}})};
  var a0=mk(false),aN=mk(true);pwOrder(a0,pt,false);pwOrder(aN,pt,true);var by={};a0.forEach(function(x){by[x.rid]={s0:x.s0,po0:x.po0}});aN.forEach(function(x){by[x.rid].sN=x.sN;by[x.rid].poN=x.poN});
  return {st:st,by:by,avg:avg,avgB:avgB,n:n,pt:pt,live:live}}
function pad2(n){return (n<10?'0':'')+n}
function pwCards(){var M=D.M||{},teams={},lc={};(M.picks||[]).forEach(function(x){var L=x.L,k=L.id+':'+x.p.rid;if(!lc[L.id])lc[L.id]=pwLeague(L);
    var t=teams[k]=teams[k]||{k:k,L:L,rid:x.p.rid,side:x.side,opp:x.opp,picks:[],I:lc[L.id]};t.picks.push(x.p)});
  return Object.keys(teams).map(function(k){var t=teams[k],I=t.I,st=I.st[t.rid]||{},b=I.by[t.rid]||{},s=t.side,o=t.opp;
    t.picks.sort(function(a,b){return a.season-b.season||a.round-b.round});var near=t.picks.filter(function(p){return p.near}),rd=near.length?near[0].round:t.picks[0].round;
    t.st=st;t.s0=b.s0;t.sN=b.sN;t.po0=b.po0;t.poN=b.poN;t.rd=rd;t.near=near.length>0;t.mv=t.near&&b.s0&&b.sN?b.s0-b.sN:0;// + = pick moved earlier (better for Brett)
    t.done=!!(s&&o&&s.ytp+s.live+o.ytp+o.live===0);t.has=!!(s&&o&&st.wk&&st.wk.lines);
    t.res=!t.has?null:t.done?(s.act>o.act?'WON':s.act<o.act?'LOST':'TIED'):(s.act>o.act+0.05?'WINNING':s.act<o.act-0.05?'LOSING':'TIED');
    var resGood=!t.has?null:t.done?(t.res==='TIED'?null:t.res==='LOST'):s.odds<0.5;// projected result, not just the current score
    t.resWhy=!t.has?'':t.done?(t.res==='LOST'?'the loss helps':'the win hurts'):(s.odds<0.5?'a likely loss helps':'a likely win hurts');mpfGood=t.has&&I.avg?st.wk.tot<I.avg:null;t.resGood=resGood;t.mpfGood=mpfGood;
    t.v=resGood==null&&mpfGood==null?null:resGood==null?(mpfGood?'g':'b'):mpfGood==null?(resGood?'g':'b'):resGood===mpfGood?(resGood?'g':'b'):'m';
    return t}).sort(function(a,b){return Math.abs(b.mv)-Math.abs(a.mv)||(b.near-a.near)||(a.rd-b.rd)||((a.sN||99)-(b.sN||99))})}
function pwCard(t){var L=t.L,s=t.side,o=t.opp,st=t.st,I=t.I,on=ownerOf(L,t.rid).name;
  var lab=t.picks.map(function(p){return '<span class="pill y">'+esc(p.label)+'</span>'}).join(' ');
  var mu='<div class="small muted">No matchup this week.</div>';
  if(t.has){var oN=o.rid===L.me?'You':ownerOf(L,o.rid).name,left=s.ytp+s.live,oleft=o.ytp+o.live,cl=t.res==='WINNING'||t.res==='WON'?'ne':t.res==='TIED'?'':'pe';
    mu='<div class="pwm"><b class="'+cl+'">'+t.res+'</b> '+f1(s.act)+'–'+f1(o.act)+' vs '+esc(oN)+(t.done?'':' · win '+Math.round(s.odds*100)+'% · '+left+' left (them '+oleft+')')+'</div>'}
  var pk='';if(t.near&&t.sN){var nm=function(x){return t.rd+'.'+pad2(x)},d=t.mv;
    pk='<div class="pwp">Projected <b>'+nm(t.sN)+'</b>'+(d?' <span class="'+(d>0?'pe':'ne')+'">'+(d>0?'▲':'▼')+' was '+nm(t.s0)+' before this week</span>':' <span class="muted">· unchanged this week</span>')+
      (t.poN?' <span class="muted small">· in playoff spot (picks late)</span>':'')+'</div>'}
  else pk='<div class="pwp muted">'+esc(t.picks[0].season)+' pick: order set by next season\'s max PF</div>';
  var mp='';if(t.has){var g=t.mpfGood;mp='<div class="small">Max PF this week <b>'+Math.round(st.wk.act||0)+'</b>'+(t.done?'':' banked · ~'+Math.round(st.wk.tot)+' proj')+' (league avg '+Math.round(I.avg)+'): <span class="'+(g?'pe':'ne')+'">'+(g?'good for you':'bad for you')+'</span></div>'}
  var vt=t.v==='g'?'<b class="pe">Good for you</b>':t.v==='b'?'<b class="ne">Bad for you</b>':t.v==='m'?'<b style="color:var(--gold)">Mixed</b> <span class="small muted">· '+t.resWhy+', but '+(t.mpfGood?'low max PF helps':'high max PF hurts')+(t.mv?' · net: pick '+(t.mv>0?'better':'worse'):'')+'</span>':'';
  return '<a class="pwc'+(t.done?' fin':'')+' v'+(t.v||'n')+'" href="#picks"><div class="ft">'+esc(on)+' '+lab+' <span class="muted small">'+esc(L.name)+'</span>'+(t.done?' <span class="pwf">FINAL</span>':'')+'</div>'+mu+pk+mp+(vt?'<div class="small pwv">'+vt+'</div>':'')+'</a>'}
function pickPanel(){var cs=pwCards();if(!cs.length)return '';var wk=cs.filter(function(t){return t.has}),good=wk.filter(function(t){return t.v==='g'}).length,bad=wk.filter(function(t){return t.v==='b'}).length,mix=wk.filter(function(t){return t.v==='m'}).length;
  var sum=wk.length?'<b class="pe">'+good+' of '+wk.length+'</b> pick teams having a bad week for them (good for you)'+(bad?' · <span class="ne">'+bad+' having a good week (bad for you)</span>':'')+(mix?' · '+mix+' mixed':''):'No pick-team matchups this week.';
  return '<section class="panel"><details class="pwd"'+(PWO?' open':'')+'><summary><h2 style="margin:0">🎯 Pick Watch <small>'+cs.length+' TEAMS</small> <span class="pwx">▾</span></h2><div class="small" style="margin-top:4px">'+sum+'</div></summary>'+
    '<details class="inf"><summary class="small muted">ⓘ How this works</summary><div class="small muted">Rookie draft order = max PF (best possible lineup points, bench included): non-playoff teams pick first, lowest max PF first; playoff teams pick last. So a pick team <b>losing</b> (falls toward missing the playoffs) and scoring a <b>low max PF</b> both move your pick earlier. "Projected" re-ranks the league live: this week\'s likely winners (current score once final) and max PF banked + projected, versus the projection before this week. Tap a card for the full Pick Watch.</div></details>'+
    '<div class="pwg">'+cs.map(pwCard).join('')+'</div></details></section>'}
function evRow(e){if(e.kind==='start')return '<div class="lve sys small muted">⏺ '+esc(e.t)+' · '+ETTIME.format(new Date(e.at))+'</div>';
  if(e.kind==='swing')return '<div class="lve sys"><div class="small"><b style="color:'+(e.good?'var(--for)':'var(--ag)')+'">'+esc(e.t)+'</b> · '+ETTIME.format(new Date(e.at))+'</div>'+(e.roast?'<div class="small" style="color:var(--gold);font-style:italic">🦦 '+esc(e.roast)+'</div>':'')+'</div>';
  var pi=pinfo(e.id),legs=e.legs.filter(function(l){return shown(l.lid)}),groups={};
  legs.forEach(function(l){var zero=l.d!=null&&Math.abs(l.d)<0.05,good=e.miss||zero?l.side==='op':l.d==null?l.side==='me':(l.side==='me')===(l.d>0),k=(good?'g':'b')+'|'+(l.d==null?'':f1(l.d));(groups[k]=groups[k]||{good:good,d:l.d,ls:[]}).ls.push(l)});
  function totH(ls){var now=false,t=ls.map(function(l){if(l.tot!=null)return l.tot;now=true;var P=ST.pts[l.lid];return P&&P[e.id]!=null?P[e.id]:null});if(t[0]==null)return '';
    var vary=t.some(function(x){return x!=null&&Math.abs(x-t[0])>=0.05});return ' <span class="ltot">· '+f1(t[0])+(now?' now':' total')+(vary?' <span class="vr" data-vt="'+esc(ls.map(function(l,i){return lgName(l.lid)+' '+(t[i]==null?'–':f1(t[i]))}).join(' · '))+'">varies</span>':'')+'</span>'}
  var gH=Object.keys(groups).map(function(k){var g=groups[k];return '<div class="small"><b style="color:'+(g.good?'var(--for)':'var(--ag)')+'">'+(g.d==null?'':'<span class="dl">'+(Math.abs(g.d)<0.05?'0 pts':(g.d>0?'+':'−')+f1(Math.abs(g.d))+' pts')+'</span> · ')+(e.miss?(g.good?'missed (good for you)':'missed'):g.good?'helps you':'hurts you')+'</b>'+totH(g.ls)+' in '+g.ls.map(function(l){return esc(lgName(l.lid))}).join(' &amp; ')+'</div>'}).join('');
  var sc=legs.filter(function(l){return l.me!=null}).map(function(l){var L=leagues().filter(function(x){return x.id===l.lid})[0];return '<div class="small muted">'+esc(ownerOf(L,L.me).name)+' <b style="color:var(--ink)">'+f1(l.me)+' – '+f1(l.op)+'</b> '+esc(ownerOf(L,L.opp).name)+(l.odds!=null?' · '+pct(l.odds)+(l.dOdds&&Math.abs(l.dOdds)>=0.005?' ('+(l.dOdds>0?'+':'−')+Math.round(Math.abs(l.dOdds)*100)+')':''):'')+'</div>'}).join('');
  var td=tdOf(e),gd=legs.some(function(l){return l.side==='me'}),bd=legs.some(function(l){return l.side==='op'});
  return '<div class="lve'+(e.kind==='back'?' back':'')+(td?' td '+(gd&&!bd?'tdg':bd&&!gd?'tdb':'tdm'):'')+'" data-at="'+e.at+'"><div class="ic">'+head(e.id)+'</div><div class="fx"><div class="ft"><span class="'+(gameOf(pi.team)&&gameOf(pi.team).state==='post'?'gdone':'')+'">'+esc(pi.n)+gmark(pi.team)+'</span> '+posChip(pi.pos)+(td?' <span class="tdx">🏈 TD</span>':'')+'</div><div class="ltm">'+ETTIME.format(new Date(e.at))+(e.catchup?' · catch-up (missed while closed)':e.from&&e.at-e.from>3*6e4?' · catch-up since '+ETTIME.format(new Date(e.from)).replace(/^\w+ /,''):'')+(e.qc?' · '+esc(e.qc):'')+(e.kind==='back'?' · before you opened':'')+'</div>'+(e.kind==='back'?'<div class="small">'+esc(e.play||'')+'</div>':'<div class="small bdl">'+breakdown(e,leagues().filter(function(x){return legs[0]&&x.id===legs[0].lid})[0])+'</div>'+(e.play?'<div class="ltm">'+esc(e.play)+'</div>':''))+gH+sc+'</div></div>'}
function keep(e){if(e.kind==='start')return true;if(e.kind==='swing')return shown(e.lid)&&!UIL.td;var legs=e.legs.filter(function(l){return shown(l.lid)});if(!legs.length)return false;
  if(UIL.side==='mine'&&!legs.some(function(l){return l.side==='me'}))return false;if(UIL.side==='opp'&&!legs.some(function(l){return l.side==='op'}))return false;
  if(UIL.pos!=='all'&&pinfo(e.id).pos!==UIL.pos)return false;if(UIL.big&&!legs.some(function(l){return l.d!=null&&Math.abs(l.d)>=4}))return false;if(UIL.td&&!tdOf(e))return false;return true}
var lastSeen=0;
function render(el,soft){load();if(!D.M)D.M=computeAll();var al=ST.alert&&Date.now()-ST.alert.at<3*6e4?ST.alert:null,evs=ST.ev.filter(keep);
  var ch=function(k,v,lab){return '<button class="chip'+(UIL[k]===v?' on':'')+'" data-lk="'+k+'" data-lv="'+v+'">'+lab+'</button>'};
  var html=(al?'<div class="box lva" style="border-color:'+(al.a[0].good?'rgba(94,214,140,.5)':'rgba(255,107,107,.5)')+'">'+al.a.map(function(a){return '<div class="small"><b>'+esc(a.t)+'</b>'+(a.roast?' <i style="color:var(--gold)">'+esc(a.roast)+'</i>':'')+'</div>'}).join('')+'</div>':'')+
   '<section class="panel"><h2>⚡ Live <small>'+(isWindow()?'● POLLING EVERY 45s':'NO GAMES LIVE')+'</small></h2>'+strip()+tracker()+'</section>'+pickPanel()+
   '<section class="panel"><h2>⏳ Who\'s Left <small>PROJ PTS STILL TO COME</small></h2>'+whoLeft()+'</section>'+
   '<section class="panel"><h2>📜 Feed <small>'+evs.length+' EVENTS</small></h2><div class="chips">'+ch('side','both','Both')+ch('side','mine','Mine')+ch('side','opp','Opponents')+'<span style="flex:0 0 6px"></span>'+['all','QB','RB','WR','TE','K','DEF'].map(function(p){return ch('pos',p,p==='all'?'All pos':p)}).join('')+'</div><div class="chips">'+'<button class="chip'+(UIL.td?' on':'')+'" data-td>🏈 TDs only</button><button class="chip'+(UIL.big?' on':'')+'" data-big>💥 Big plays only (≥4)</button><button class="chip'+(VIB()?' on':'')+'" data-vib>📳 Vibrate on big plays</button><button class="chip" data-poll>↻ Poll now</button></div>'+
   (evs.length?evs.slice(0,UIL.more).map(evRow).join('')+(evs.length>UIL.more?'<button class="chip" data-more style="margin:10px auto 0;display:flex">Show more ('+(evs.length-UIL.more)+')</button>':''):'<div class="empty">No scoring changes yet'+(ST.since?' since '+ETTIME.format(new Date(ST.since)):'')+'.</div>')+
   '<div class="hint">Events = changes in each starter\'s league-scored points between 45s polls of Sleeper live stats; play text from ESPN when the name matches. "earlier" rows are ESPN scoring plays from before you opened the feed. Kept for the week on this device.</div></section>';
  el.innerHTML=html;
  if(soft&&lastSeen)$$('.lve[data-at]',el).forEach(function(r){if(+r.getAttribute('data-at')>lastSeen)r.classList.add('new')});lastSeen=Math.max(lastSeen,ST.ev.length?ST.ev[0].at:0);
  $$('[data-lk]',el).forEach(function(b){b.onclick=function(){UIL[b.getAttribute('data-lk')]=b.getAttribute('data-lv');render(el)}});
  $$('details[data-wl]',el).forEach(function(d){d.addEventListener('toggle',function(){var id=d.getAttribute('data-wl');if(d.open===!!WLO[id])return;WLO[id]=d.open;if(d.open&&!d.querySelector('.wld')){var L=D.leagues.filter(function(x){return x.id===id})[0],c=(D.M.cards||[]).filter(function(x){return x.L.id===id})[0];if(L&&c)d.insertAdjacentHTML('beforeend',wlDetail(c.me,'You','for')+wlDetail(c.op,esc(ownerOf(L,L.opp).name),'ag'))}})});
  var pd=$('details.pwd',el);if(pd)pd.addEventListener('toggle',function(){PWO=pd.open;LS.set('wh:live:pwo',PWO)});
  var mb=$('[data-more]',el);if(mb)mb.onclick=function(){UIL.more+=15;render(el)};var tb=$('[data-td]',el);if(tb)tb.onclick=function(){UIL.td=!UIL.td;render(el)};var bb=$('[data-big]',el);if(bb)bb.onclick=function(){UIL.big=!UIL.big;render(el)};var vb=$('[data-vib]',el);if(vb)vb.onclick=function(){LS.set('wh:live:vib',!VIB());render(el)};
  $$('[data-vt]',el).forEach(function(v){v.onclick=function(){v.textContent=v.getAttribute('data-vt');v.className='vr on'}});
  var pb=$('[data-poll]',el);if(pb)pb.onclick=function(){pb.textContent='Polling…';poll()}}
function renderLive(el){if(!D.leagues.length){el.innerHTML='<div class="panel empty">No leagues.</div>';return}render(el);if(!ST.since||Date.now()-(ST.lastPoll||0)>POLL)poll()}
function loop(){clearTimeout(_t);_t=setTimeout(function(){if(!document.hidden&&D.leagues.length&&(isWindow()||curTab()[0]==='live'&&Date.now()-(ST&&ST.lastPoll||0)>POLL))poll().then(loop,loop);else loop()},POLL)}
window.LIVE={playsFor:playsFor,breakdown:breakdown,summary:summary,playStats:playStats,poll:poll,state:function(){return load()},render:render};
EXTRA_TABS.push(['live','⚡','LIVE',renderLive]);
if(window.TAB_ORDER)TAB_ORDER[0].splice(TAB_ORDER[0].indexOf('sunday')+1,0,'live');
$('#tabs').innerHTML=navHTML();
(window.afterBoot=window.afterBoot||[]).push(function(){setTimeout(function(){load();var played=Object.keys(D.games||{}).some(function(t){return D.games[t].state!=='pre'});if(isWindow()||ST.since&&played&&Date.now()-(ST.lastPoll||0)>POLL)poll();loop()},4000)});
})();

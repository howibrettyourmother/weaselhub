'use strict';
// Coaches Corner: Dynasty Guru's Wilson Weasels game plan.
// Content lives in data/cc_<league>.md, one file per Sleeper league (plain markdown: #, ##, ###, -, | tables |, **bold**, [links](url)).
// To update: replace that file and push. Each ## section becomes a collapsible card.
(function(){
var LGS=[['shadynasty','SHADYNASTY'],['f2020','F@$% 2020'],['dynastyjunkies','Dynasty Junkies'],['livefree','Live Free or Dynasty']];
var MD={},CUR=(LS.get('ccLeague')||'shadynasty');if(!LGS.some(function(l){return l[0]===CUR}))CUR='shadynasty';
function inl(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,function(m,t,u){return '<a href="'+u.replace(/&amp;/g,'&').replace(/"/g,'%22')+'" target="_blank" rel="noopener">'+t+'</a>'})}
function cells(l){return l.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(function(c){return c.trim()})}
function block(lines){var out=[],i=0;
  while(i<lines.length){var l=lines[i];
    if(/^\s*$/.test(l)){i++;continue}
    if(/^### /.test(l)){out.push('<h3 class="cch3">'+inl(l.slice(4))+'</h3>');i++;continue}
    if(/^\s*\|/.test(l)){var rows=[];while(i<lines.length&&/^\s*\|/.test(lines[i]))rows.push(lines[i++]);var hd=cells(rows[0]);var body=rows.slice(1).filter(function(r){return !/^\s*\|[\s:|-]+\|\s*$/.test(r)});
      out.push('<div class="tw"><table class="cct"><thead><tr>'+hd.map(function(h){return '<th>'+inl(h)+'</th>'}).join('')+'</tr></thead><tbody>'+body.map(function(r){var c=cells(r),me=/\(Brett\)|^Brett/.test(c[0])||/^Brett/.test(c[c.length-1]);var ci=hd.indexOf('Call'),ei=hd.indexOf('Edge');return '<tr'+(me?' class="ccme"':'')+'>'+c.map(function(x,j){var v=j===ci?verdict(x):j===ei?(/^Brett/.test(x)?'vg':'vs'):'';return '<td>'+(v?'<span class="ccv '+v+'">'+inl(x)+'</span>':inl(x))+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>');continue}
    if(/^\s*- /.test(l)){var it=[];while(i<lines.length&&/^\s*- /.test(lines[i]))it.push(lines[i++].replace(/^\s*- /,''));out.push('<ul class="ccl">'+it.map(function(x){return '<li>'+inl(x)+'</li>'}).join('')+'</ul>');continue}
    var p=[];while(i<lines.length&&lines[i].trim()&&!/^(#|\s*- |\s*\|)/.test(lines[i]))p.push(lines[i++]);out.push('<p>'+inl(p.join(' '))+'</p>')}
  return out.join('')}
var ICON={'This week':'⚡','Snapshot':'📋','Standings':'📊','Roster audit':'🩺','Draft pick inventory':'🎯','Waiver / IR / taxi moves':'🧺','Week-by-week plan':'🗓️','Offseason dynasty outlook':'🔭','Caveats':'⚠️','Sources':'🔗'};
// Sideline analysts: original illustrated, fictional adult hosts (no real-person likeness).
var HOST={
 shadynasty:{n:'Valentina "Val" Cruz',r:'Sideline Analyst',c:'navy',need:'WR3 + RB2',q:'Odunze for Likely + Coker? Now that is the kind of upgrade I notice.'},
 f2020:{n:'Scarlett Reyes',r:'Field Reporter',c:'red',need:'RB vs. olis1mao',q:'Deadline is Week 11, handsome. Don\'t keep me waiting.'},
 dynastyjunkies:{n:'Nia Brooks',r:'War Room Strategist',c:'green',need:'WR3 (Waddle 9.2)',q:'Six and oh looks good on you. A real WR3 would look even better.'},
 livefree:{n:'Sloane Avery',r:'Sideline Insider',c:'blue',need:'QB + RB',q:'Four firsts and you\'re starting Winston? Treat yourself.'}};
function sec(secs,re){return secs.filter(function(s){return re.test(s.h)})[0]}
function grade(v){return v>=5?'A':v>=0?'B':v>-5?'C':v>-10?'D':'F'}
function hero(title,secs){var H=HOST[CUR]||{},snap=sec(secs,/^Snapshot/),t=snap?snap.b.join('\n'):'',m;
  var rec=(m=/Record[^:]*:\*\*\s*([0-9]+-[0-9]+)/.exec(t))?m[1]:'—',pf=(m=/\(([0-9]+(st|nd|rd|th))\)/.exec(t))?m[1]:'—',fa=(m=/FAAB:\*\*\s*(\$[0-9]+)/.exec(t))?m[1]:'—',dl=(m=/Deadline[^:]*:\*\*\s*(Week [0-9]+)/.exec(t))?m[1]:'—';
  var vs=sec(secs,/ vs /),gr='';
  if(vs){vs.b.filter(function(l){return /^\s*\|/.test(l)&&!/^\s*\|[\s:|-]+\|\s*$/.test(l)}).slice(1).forEach(function(r){var c=cells(r),e=c[c.length-1],mm=/(\S+)\s*\+([0-9.]+)/.exec(e);if(!mm)return;var v=parseFloat(mm[2])*(/^Brett/.test(e)?1:-1),g=grade(v);
    gr+='<span class="ccg g'+g+'"><b>'+g+'</b>'+esc(c[0].replace(/ x[0-9]/,''))+'</span>'})}
  var tiles=[['Record',rec],['PF rank',pf],['FAAB',fa],['Deadline',dl],['Biggest need',H.need||'—']];
  return '<section class="cchero t-'+(H.c||'navy')+'"><div class="cchost"><img src="img/host_'+CUR+'.jpg?v=1" alt="Illustrated sideline analyst" width="240" height="320"><span class="cclive">● ON AIR</span></div>'+
   '<div class="cchb"><div class="cckick">🧠 COACHES CORNER · WAR ROOM</div><h2>'+inl(title)+'</h2>'+
   '<div class="cctiles">'+tiles.map(function(x,i){return '<div class="cctile" style="animation-delay:'+(i*60)+'ms"><small>'+x[0]+'</small><b>'+esc(x[1])+'</b></div>'}).join('')+'</div>'+
   (gr?'<div class="ccgr"><small>Lineup grade vs. top rival</small>'+gr+'</div>':'')+
   '<div class="ccq">“'+esc(H.q||'')+'”<span>— '+esc(H.n||'')+', '+esc(H.r||'')+'</span></div></div></section>'}
function verdict(x){x=x.replace(/\*/g,'');return /sell|trade chip|surplus|\bcut\b|in tuna deal|rental|weak/i.test(x)?'vs':/keep|core|untouchable|^start|qb1|win-now|wr1|smash|^starter|^fine/i.test(x)?'vg':'vh'}
function render(md){var L=md.replace(/\r/g,'').split('\n'),title='Coaches Corner',intro=[],secs=[],cur=null;
  L.forEach(function(l){if(/^# /.test(l)){title=l.slice(2);return}if(/^## /.test(l)){cur={h:l.slice(3),b:[]};secs.push(cur);return}(cur?cur.b:intro).push(l)});
  var h=sw()+hero(title,secs)+'<section class="panel cc"><div class="box ccintro">'+block(intro)+'</div></section>';
  secs.forEach(function(s,k){var ic=ICON[s.h]||(/trade/i.test(s.h)?'🧶':/vs/i.test(s.h)?'⚔️':/need/i.test(s.h)?'🔍':'📌');
    h+='<details style="animation-delay:'+Math.min(k*50,400)+'ms" class="panel ccs'+(/this week/i.test(s.h)?' ccnow':'')+'"'+(k<2||/trade|this week/i.test(s.h)?' open':'')+'><summary><h2>'+ic+' '+inl(s.h)+'</h2></summary>'+block(s.b)+'</details>'});
  return h+'<div class="hint">Game plan by Dynasty Guru from a live Sleeper + FantasyCalc pull (timestamp at top). Not auto-refreshed. Edit <code>data/cc_'+CUR+'.md</code> to update.</div>'}
function syncCls(){document.body.classList[curTab()[0]==='coach'?'add':'remove']('cc-on')}
addEventListener('hashchange',syncCls);
function sw(){return '<div class="ccsw" id="ccsw" role="tablist"><span class="ccswl">LEAGUE</span>'+LGS.map(function(l){return '<button class="chip'+(l[0]===CUR?' on':'')+'" data-cl="'+l[0]+'">'+esc(l[1])+'</button>'}).join('')+'</div>'}
function load(k){return fetch('data/cc_'+k+'.md?t='+new Date().toISOString().slice(0,13),{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(t){MD[k]=t;return t})}
function bind(el){var b=el.querySelectorAll('[data-cl]');for(var i=0;i<b.length;i++)b[i].onclick=function(){CUR=this.getAttribute('data-cl');LS.set('ccLeague',CUR);renderCC(el);window.scrollTo(0,0)}}
function renderCC(el){syncCls();var k=CUR;if(MD[k]){el.innerHTML=render(MD[k]);bind(el);return}el.innerHTML=sw()+'<div class="spin">Loading Coaches Corner…</div>';bind(el);load(k).then(function(){if(curTab()[0]==='coach'&&CUR===k){el.innerHTML=render(MD[k]);bind(el)}}).catch(function(e){el.innerHTML=sw()+'<div class="panel err">Couldn\'t load Coaches Corner: '+esc(e.message)+'</div>';bind(el)})}
EXTRA_TABS.push(['coach','🧠','COACHES CORNER',renderCC]);
if(window.TAB_ORDER)TAB_ORDER[0].push('coach');
$('#tabs').innerHTML=navHTML();
})();

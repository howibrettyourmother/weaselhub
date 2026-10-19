'use strict';
// Weasel Hub round 4: real NFL contracts (Exposure tab "Contracts" view, FA badges, "hitting free agency" callout).
// Data: data/contracts.json, built daily by .github/workflows/contracts.yml from nflverse's OverTheCap-derived contracts release.
(function(){
var CT=null,CTP=null,UIc={sort:'fa'};
function loadCT(){if(CTP)return CTP;CTP=SC('data/contracts.json?d='+new Date().toISOString().slice(0,13),6*36e5).then(function(d){CT=d;window.CT=d;try{if(['exposure','rosters','trade','sunday'].indexOf(curTab()[0])>=0)rerender()}catch(e){}return d}).catch(function(e){CTP=null;console.warn('contracts',e);return null});return CTP}
function pos(id){var pi=pinfo(id);return pi.pos&&pi.pos!=='?'?pi.pos:(D.players&&D.players[id]&&D.players[id].p[0])||'?'}
function season(){return +(CT&&CT.season)||+D.season||new Date().getFullYear()}
function con(id){return CT&&CT.c?CT.c[id]||null:null}
// small badge for players whose deal runs out after this season (cheap to drop into any row)
window.faBadge=function(id){var c=con(id);if(!c||c.fa>season()+1)return '';if(c.now)return ' <span class="pill y fab">FA NOW</span>';return ' <span class="pill y fab" title="Contract ends after '+c.end+' ('+esc(c.kind)+')">FA '+c.fa+(c.kind!=='UFA'?' '+c.kind:'')+'</span>'};
function mine(){var P={};D.leagues.forEach(function(L){var r=L.rosters[L.me];((r&&r.players)||[]).forEach(function(id){if(isNaN(+id))return;var x=P[id]=P[id]||{id:id,lg:[],v:0};x.lg.push(L.name);x.v+=(L.V&&L.V.p[id])||0})});return Object.keys(P).map(function(k){return P[k]})}
function money(m){return m>=1?'$'+(m>=10?Math.round(m):m.toFixed(1))+'M':m>0?'$'+Math.round(m*1000)+'K':'–'}
function dealNote(c){if(!c)return '';var s=season(),a=[];
  if(c.rk){a.push('Rookie deal');if(c.opt==='exercised')a.push('5th-yr option exercised ('+(c.dy+4)+')');else if(c.opt==='declined')a.push('5th-yr option declined');else if(c.opt==='pending')a.push('5th-yr option decision May '+(c.dy+3))}
  else if(c.typ)a.push({Drafted:'Rookie deal',Extension:'Extension',UFA:'FA signing',SFA:'Street FA signing',Franchise:'Tag → long-term deal',RFA:'RFA tender',ERFA:'ERFA tender',Other:'Re-signed'}[c.typ]||esc(c.typ));
  if(c.end===s)a.push('<b style="color:var(--gold)">contract year</b>');return a.join(' · ')}
function ctHTML(){
  if(!CT)return '<section class="panel" id="ctx"><h2>📝 Contracts</h2><div class="spin">Loading contracts…</div></section>';
  var s=season(),arr=mine().map(function(x){x.c=con(x.id);x.pi=pinfo(x.id);return x}).filter(function(x){var p=pos(x.id);return p!=='DEF'});
  var cmp={fa:function(a,b){return (a.c?a.c.fa-(a.c.now?1:0):9999)-(b.c?b.c.fa:9999)||b.v-a.v},v:function(a,b){return b.v-a.v},apy:function(a,b){return ((b.c&&b.c.apy)||0)-((a.c&&a.c.apy)||0)},n:function(a,b){return a.pi.n<b.pi.n?-1:1}};
  arr.sort(cmp[UIc.sort]||cmp.fa);
  var up=arr.filter(function(x){return x.c&&!x.c.now&&x.c.fa===s+1}).sort(function(a,b){return b.v-a.v}),unk=arr.filter(function(x){return !x.c}).length;
  var call=up.length?'<div class="box ctcall"><div class="small" style="color:var(--gold);font-weight:700">🚪 Hitting free agency this offseason ('+(s+1)+') · '+up.length+' player'+(up.length>1?'s':'')+'</div><div class="ctchips">'+up.map(function(x){return '<span class="ctc">'+posChip(pos(x.id))+' '+esc(x.pi.n)+' <span class="muted small">'+esc(x.pi.team||'FA')+(x.c.kind!=='UFA'?' · '+x.c.kind:'')+(x.lg.length>1?' · '+x.lg.length+' lg':'')+'</span></span>'}).join('')+'</div><div class="small muted" style="margin-top:4px">Landing-spot risk next spring, and a contract-year push right now. RFA/ERFA usually stay put (team can match).</div></div>':'<div class="small muted">Nobody you own hits free agency this offseason.</div>';
  var chips='<div class="chips" id="ctsort">'+[['fa','Soonest FA'],['v','Value'],['apy','APY'],['n','Name']].map(function(o){return '<button class="chip'+(UIc.sort===o[0]?' on':'')+'" data-cs="'+o[0]+'">'+o[1]+'</button>'}).join('')+'</div>';
  var rows=arr.map(function(x){var c=x.c,left=c?c.end-s+1:null;
    return '<div class="ctr"><div class="ctn">'+posChip(pos(x.id))+' <b>'+esc(x.pi.n)+'</b> <span class="muted small">'+esc(x.pi.team||'FA')+'</span><div class="small muted">'+esc(x.lg.join(', '))+'</div></div>'+
      (c&&c.now?'<div class="ctf"><b class="soon">Free agent now</b><div class="small muted">released / unsigned, no NFL team</div></div><div class="ctd small muted">Landing spot TBD</div>':c?'<div class="ctf"><b class="'+(c.fa===s+1?'soon':'')+'">FA '+c.fa+'</b> <span class="small">('+esc(c.kind)+')</span><div class="small muted">'+(left<=1?'final season':left+' seasons left')+' · thru '+c.end+'</div></div><div class="ctd small">'+dealNote(c)+'<div class="muted">'+(c.apy?money(c.apy)+'/yr':'')+(c.gtd?' · '+money(c.gtd)+' gtd':'')+'</div></div>'
        :'<div class="ctf"><span class="muted">unknown</span><div class="small muted">no contract match</div></div><div class="ctd small muted">–</div>')+'</div>'}).join('');
  var at=CT.src_at?String(CT.src_at).replace(/:\d\d (E[DS]T)$/,' $1'):'';
  return '<section class="panel" id="ctx"><h2>📝 Contracts <small>'+arr.length+' PLAYERS'+(unk?' · '+unk+' UNKNOWN':'')+'</small></h2>'+call+chips+'<div class="ctl">'+rows+'</div>'+
    '<div class="hint">Real NFL contracts for every player you roster across your '+D.leagues.length+' leagues. FA year = first offseason he\'s free (contract runs through the season before). UFA/RFA/ERFA estimated from seasons in the league at contract end (4+ UFA, 3 RFA, under 3 ERFA). Void years ignored. Franchise tags and extensions show up once they\'re signed. Source: <a href="https://github.com/nflverse/nflverse-data/releases/tag/contracts" target="_blank" rel="noopener">nflverse contracts</a> (from OverTheCap.com), data as of '+esc(at)+'; hub file built '+new Date(CT.at).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'})+'. "unknown" = no confident match, never guessed.</div></section>'}
function place(el){var h=ctHTML(),x=$('#ctx',el);if(x)x.outerHTML=h;else{var a=$('#exconc',el);if(a)a.insertAdjacentHTML('afterend',h);else el.insertAdjacentHTML('beforeend',h)}
  $$('#ctsort [data-cs]',el).forEach(function(b){b.onclick=function(){UIc.sort=b.getAttribute('data-cs');place(el)}})}
EXTRA_TABS.forEach(function(t){if(t[0]!=='exposure')return;var orig=t[3];t[3]=function(el){try{orig(el)}catch(e){console.warn('exposure',e)}Promise.all([WH_ensure(),loadCT()]).then(function(){if(curTab()[0]==='exposure')place(el)}).catch(function(e){console.warn('ct',e)});if(!CT)place(el)}});
loadCT();
})();

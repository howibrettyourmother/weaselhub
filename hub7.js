'use strict';
// Weasel Hub round 5, navigation: 5 groups (Today / Leagues / Moves / Draft / More). Phone: fixed bottom bar for the groups and
// only the current group's tabs up top. Desktop: one row with group separators. Every old #hash URL still works.
(function(){
var G=[['today','🏈','TODAY',['home','sunday','live']],['leagues','📊','LEAGUES',['standings','rosters','scout','exposure']],['moves','🔁','MOVES',['trade','find','waivers']],['draft','🎓','DRAFT',['picks','draft']],['more','🗞️','MORE',['news','recap','coach']]];
window.TAB_ORDER=G.map(function(g){return g[3].slice()});
var LAST=LS.get('wh:navlast')||{};
function grpOf(k){for(var i=0;i<G.length;i++)if(G[i][3].indexOf(k)>=0)return G[i];return G[0]}
function paint(){var t=curTab()[0],g=grpOf(t);LAST[g[0]]=t;LS.set('wh:navlast',LAST);document.body.setAttribute('data-grp',g[0]);
  $$('#tabs a').forEach(function(a){a.setAttribute('data-g',grpOf(a.getAttribute('data-k'))[0])});
  var b=$('#bnav');if(b)$$('a',b).forEach(function(a){var gk=a.getAttribute('data-g'),gg=G.filter(function(x){return x[0]===gk})[0],on=gk===g[0];a.className=on?'on':'';
    if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');a.href='#'+(LAST[gk]&&gg[3].indexOf(LAST[gk])>=0?LAST[gk]:gg[3][0])})}
function build(){$('#tabs').innerHTML=navHTML();if(!$('#bnav')){var n=document.createElement('nav');n.id='bnav';n.setAttribute('aria-label','Sections');
    n.innerHTML=G.map(function(g){return '<a data-g="'+g[0]+'" href="#'+g[3][0]+'"><span>'+g[1]+'</span>'+g[2]+'</a>'}).join('');document.body.appendChild(n);
    n.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.className==='on'){var first=G.filter(function(x){return x[0]===a.getAttribute('data-g')})[0][3][0];if(curTab()[0]!==first){e.preventDefault();location.hash='#'+first}else scrollTo({top:0,behavior:'smooth'})}})}
  paint()}
build();addEventListener('hashchange',paint);
// ---------- retired views: old hash names go to the tab that replaced them ----------
var ALIAS={desk:'trade',tradedesk:'trade',fleece:'trade',portfolio:'exposure',alerts:'exposure',valuealerts:'exposure'};
function alias(){var h=(location.hash||'').slice(1).split('/')[0].toLowerCase();if(ALIAS[h])location.replace('#'+ALIAS[h])}
alias();addEventListener('hashchange',alias);
})();

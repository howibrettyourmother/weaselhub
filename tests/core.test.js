// node tests/core.test.js  (no dependencies)
'use strict';
var C=require('../core.js'),assert=require('assert'),n=0;function t(name,f){f();n++;console.log('ok',name)}
t('seed order',function(){assert.deepStrictEqual(C.seedOrder(8),[1,8,4,5,2,7,3,6]);assert.deepStrictEqual(C.seedOrder(4),[1,4,2,3])});
t('4-team bracket, favourites win',function(){var f=C.bracketFinish([1,2,3,4],function(a,b){return a<b});assert.deepStrictEqual(f,[1,2,3,4])});
t('6-team bracket: seeds 1-2 get byes, chalk',function(){var f=C.bracketFinish([11,12,13,14,15,16],function(a,b){return a<b});assert.deepStrictEqual(f,[11,12,13,14,15,16])});
t('6-team bracket: 6 seed wins it all',function(){var f=C.bracketFinish([1,2,3,4,5,6],function(a,b){return a===6?true:b===6?false:a<b});
  assert.strictEqual(f[0],6);assert.strictEqual(f.length,6);assert.deepStrictEqual(f.slice().sort(),[1,2,3,4,5,6])});
t('draft order: non-playoff by lowest max PF, then playoff by reverse finish',function(){
  var o=C.draftOrder([1,2,3,4,5,6,7,8],4,{5:900,6:800,7:1000,8:700},[3,1,2,4]);assert.deepStrictEqual(o,[8,6,5,7,4,2,1,3])});
function league(){var teams=[],future=[];for(var i=1;i<=8;i++)teams.push({rid:i,w:i<=4?7:2,t:0,pf:1500-i*20,mpf:1700-i*10,mu:150,ratio:1.15});
  for(var w=0;w<4;w++){var p=[];for(var j=1;j<=8;j+=2)p.push([j,j+1]);future.push(p)}return {teams:teams,future:future,week:[],pt:4,N:2000,seed:'x'}}
t('simulate: 7-2 teams make the playoffs, 2-7 teams pick first',function(){var o=C.simulate(league());
  [1,2,3,4].forEach(function(r){assert(o[r].po>0.9,'po '+r+' '+o[r].po);assert(o[r].slot>4)});[5,6,7,8].forEach(function(r){assert(o[r].po<0.1);assert(o[r].slot<=4)});
  var slots=Object.keys(o).map(function(k){return o[k].slot}).sort(function(a,b){return a-b});assert.deepStrictEqual(slots,[1,2,3,4,5,6,7,8])});
t('simulate: lowest max PF among non-playoff teams gets the best pick',function(){var L=league();L.teams[7].mpf=1000;var o=C.simulate(L);assert.strictEqual(o[8].slot,1)});
t('simulate: deterministic for a seed',function(){var a=C.simulate(league()),b=C.simulate(league());assert.deepStrictEqual(a,b)});
console.log(n+' tests passed');

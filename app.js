"use strict";
const $ = id => document.getElementById(id);
const coins = {BTC:{name:"比特币",target:45000,color:"#98432c"},ETH:{name:"以太坊",target:1200,color:"#455b72"}};
const horizons=[30,90,180,365], day=86400000;
const state={asset:"BTC",range:90,metric:"touch",history:null,loading:false,message:""};
const money=v=>v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const short=v=>Math.round(v).toLocaleString("en-US");
const signed=(n,d=1)=>(n>0?"+":"")+n.toFixed(d);
const ratio=(a,b)=>(a/b-1)*100;
const latest=(a=state.asset)=>state.history[a].at(-1);
const lastDate=()=>latest("BTC")[0];
function group(values,active,action,label){return '<div class="pills" role="group" aria-label="'+label+'">'+values.map(([v,t])=>'<button type="button" data-'+action+'="'+v+'" aria-pressed="'+(String(active)===String(v))+'">'+t+'</button>').join('')+'</div>'}
function section(){
 const page=location.hash.slice(1).split('/')[0];
 return ["model","sources"].includes(page)?page:"overview";
}
function readAssetRoute(){
 const [page,asset]=location.hash.slice(1).split('/');
 if(page==='model' && Object.hasOwn(coins,asset))state.asset=asset;
}
function assetSelect(){return '<select class="chartselect" id="assetSelect" aria-label="选择分析币种">'+Object.keys(coins).map(a=>'<option '+(a===state.asset?'selected':'')+'>'+a+'</option>').join('')+'</select>'}
function points(values,w,h,pad){let min=Math.min(...values),span=Math.max(...values)-min||1;return values.map((v,i)=>[i*w/(values.length-1),h-pad-(v-min)/span*(h-2*pad)])}
function path(coords){return coords.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+','+y.toFixed(2)).join(' ')}
function spark(asset) {
 const closes = state.history[asset].slice(-60).map(row => row[2]);
 const coords = points(closes, 150, 43, 4);
 const [x, y] = coords.at(-1);
 return `<svg class="spark" viewBox="-2 0 156 43" role="img" aria-label="${asset} 近 60 日收盘走势">
   <path d="${path(coords)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
   <circle cx="${x}" cy="${y}" r="2.6" fill="currentColor"/>
 </svg>`;
}
function card(asset) {
 const {name, target} = coins[asset];
 const price = latest(asset)[2];
 const previous = state.history[asset].at(-2)[2];
 const change = ratio(price, previous);
 const distance = (1 - target / price) * 100;
 return `<a class="quote" href="#model/${asset}" aria-label="查看 ${asset} 目标价推演">
   <div class="instrument"><h2>${name} <small>${asset}</small></h2>${spark(asset)}</div>
   <div class="price">${money(price)} <small>USDT</small></div>
   <div class="move">较前日 <strong class="${change < 0 ? 'fall' : 'rise'}">${signed(change,2)}%</strong></div>
   <div class="targetline"><span>目标 <b>${short(target)}</b></span><span>${distance > 0 ? '还需跌 <b>'+distance.toFixed(1)+'%</b>' : '已到目标区间'}</span><span class="open-model">推演 ›</span></div>
 </a>`;
}
const memo=new Map();
function stats(a,h,back=0){const rows=state.history[a],end=rows.length-1-back,spot=rows[end][2],key=[a,h,end,spot].join('/');if(memo.has(key))return memo.get(key);
 const exits=[];let touch=0,terminal=0;const target=coins[a].target;
 for(let i=0;i+h<=end;i++){const base=rows[i][2];let min=Infinity;for(let j=i+1;j<=i+h;j++)min=Math.min(min,rows[j][1]);const exit=spot*rows[i+h][2]/base;exits.push(exit);if(spot<=target||spot*min/base<=target)touch++;if(exit<=target)terminal++}
 exits.sort((l,r)=>l-r);const n=exits.length,quantile=p=>exits[Math.round((n-1)*p)];const result={n,touch:100*touch/n,terminal:100*terminal/n,lo:quantile(.1),median:quantile(.5),hi:quantile(.9)};memo.set(key,result);return result}
function modelControls(){return group([["touch","期间触及"],["terminal","期末低于"]],state.metric,"metric","统计口径")}
function modelPanel() {
 const {asset, metric} = state;
 const rows = horizons.map(days => {
   const value = stats(asset, days)[metric];
   const difference = value - stats(asset, days, 1)[metric];
   return `<tr><th scope="row">${days} 天</th><td><div class="measure"><div class="track"><i style="width:${value}%"></i></div><b>${value.toFixed(1)}%</b></div></td><td>${signed(difference)}</td></tr>`;
 }).join('');
 return `<section class="panel modelpanel"><div class="panelTop"><h2>目标价推演</h2><a class="plain" href="#model/${asset}">完整推演 ›</a></div>
   <p class="modellead">${asset} <strong>${short(coins[asset].target)}</strong> USDT</p>
   ${modelControls()}
   <table class="prob"><thead><tr><th>周期</th><th>历史占比</th><th>较昨日¹</th></tr></thead><tbody>${rows}</tbody></table>
   <p class="footnote">¹ 较昨日的变化，单位为百分点。</p></section>`;
}
function chartPanel() {
 return `<section class="panel chartpanel"><div class="panelTop"><h2>收盘走势</h2>${assetSelect()}</div>
   <div class="legendrow">${group([7,30,90,365].map(n=>[n,n===365?'1 年':n+' 天']),state.range,'range','走势图周期')}<span class="meta">USDT</span></div>
   <div class="plot" id="plot" tabindex="0" aria-label="每日收盘走势图，使用左右方向键查看各日价格"></div></section>`;
}
function renderChart(){const host=$('plot');if(!host)return;const rows=state.history[state.asset].slice(-state.range),vals=rows.map(r=>r[2]);
 const w=Math.max(280,host.clientWidth),h=w<420?193:230,l=w<420?43:54,r=8,t=14,b=25,ww=w-l-r,hh=h-t-b,col=coins[state.asset].color;
 const low=Math.min(...vals),high=Math.max(...vals),span=high-low||1,min=low-.08*span,max=high+.08*span;const xy=vals.map((v,i)=>[l+ww*i/(vals.length-1),t+hh*(max-v)/(max-min)]);const axisColor='#67655e',grid='#d9d6cd';let gridLines='';
 for(let i=0;i<5;i++){let y=t+hh*i/4;gridLines+='<path stroke="'+grid+'" stroke-dasharray="2 4" d="M'+l+' '+y+'H'+(w-r)+'"/><text x="'+(l-7)+'" y="'+(y+4)+'" text-anchor="end">'+short(max-(max-min)*i/4)+'</text>'}
 let count=w<420?4:6;for(let i=0;i<count;i++){let index=Math.round((rows.length-1)*i/(count-1)),x=xy[index][0];gridLines+='<text x="'+x+'" y="'+(h-3)+'" text-anchor="'+(i===0?'start':i===count-1?'end':'middle')+'">'+rows[index][0].slice(5).replace('-','/')+'</text>'}
 const line=path(xy);
 const [lastX,lastY]=xy.at(-1);
 host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
  <g fill="${axisColor}" font-family="Arial,sans-serif" font-size="12">${gridLines}</g>
  <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${lastX}" cy="${lastY}" r="3.5" fill="${col}"/>
  <g id="marker"></g></svg><div class="tip" id="tip" role="status"></div>`;
 let idx=rows.length-1;function show(i){idx=Math.max(0,Math.min(i,rows.length-1));let [x,y]=xy[idx];$('marker').innerHTML='<path d="M'+x+' '+t+'V'+(h-b)+'" stroke="#8295a7" stroke-dasharray="2 4"/><circle cx="'+x+'" cy="'+y+'" r="4" fill="'+col+'"/>';const tip=$('tip');tip.textContent=rows[idx][0]+' · '+money(rows[idx][2]);tip.style.display='block';tip.style.left=Math.max(85,Math.min(w-85,x))+'px';tip.style.top=Math.max(0,y-31)+'px'}
 host.onpointermove=e=>show(Math.round((e.clientX-host.getBoundingClientRect().left-l)/ww*(rows.length-1)));host.onpointerleave=host.onblur=()=>{$('tip').style.display='none';$('marker').replaceChildren()};host.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(idx+(e.key==='ArrowLeft'?-1:1))}};host.onfocus=()=>show(idx)}
function modelView(){let a=state.asset,k=state.metric;return '<section class="panel subpage"><div class="subTop"><h1>目标价推演</h1>'+assetSelect()+'</div><p>'+a+' 收盘价 '+money(latest()[2])+' USDT，追踪目标 '+short(coins[a].target)+' USDT。</p>'+modelControls()+'<div class="scroll"><table><thead><tr><th>观察周期</th><th>历史占比</th><th>较昨日¹</th><th>窗口数</th></tr></thead><tbody>'+horizons.map(h=>{const s=stats(a,h);return '<tr><td>'+h+' 天</td><td>'+s[k].toFixed(1)+'%</td><td>'+signed(s[k]-stats(a,h,1)[k])+'</td><td>'+short(s.n)+'</td></tr>'}).join('')+'</tbody></table></div><p class="footnote">¹ 单位为百分点。</p><h3>期末价格分布</h3><p class="meta">将每段历史涨跌幅应用于最新收盘价，观察期末价格分位数，单位 USDT。</p><div class="scroll"><table><thead><tr><th>观察周期</th><th>第 10 百分位</th><th>中位数</th><th>第 90 百分位</th></tr></thead><tbody>'+horizons.map(h=>{const s=stats(a,h);return '<tr><td>'+h+' 天</td><td>'+short(s.lo)+'</td><td>'+short(s.median)+'</td><td>'+short(s.hi)+'</td></tr>'}).join('')+'</tbody></table></div><a class="plain" href="#sources">查看计算方法</a></section>'}
function sources(){return '<section class="panel subpage"><div class="subTop"><h1>数据说明</h1><button class="refresh" id="refresh" '+(state.loading?'disabled':'')+'>'+(state.loading?'正在检查…':'检查新日线')+'</button></div><h3>行情来源与时间</h3><p>使用 Binance 现货 BTC/USDT 和 ETH/USDT 日线。每根日线在北京时间次日 08:00 收盘。页面金额以 USDT 计价，美元观察线按 1 USDT ≈ 1 美元换算。</p><p>数据覆盖 '+state.history.BTC[0][0]+' 至 '+lastDate()+'，每个币种 '+short(state.history.BTC.length)+' 根日线。打开页面时检查最新已收盘数据。</p><p class="status" role="status">'+state.message+'</p><a href="https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints" target="_blank" rel="noopener">Binance 现货行情文档</a><h3>目标价如何计算</h3><p>以最新收盘价为起点，逐日回放历史上每个完整的 30、90、180、365 天窗口，保留各窗口内的相对价格变化。所有完整窗口等权。</p><p>「期间触及」统计起点或期间任一日最低价达到目标价及以下的窗口。「期末低于」统计最后一日收盘价处于目标价及以下的窗口。昨日对照使用当时的收盘价和截至当日的历史数据。</p><h3>怎样理解这些数字</h3><p>历史窗口相互重叠，占比只描述过去路径在当前起点重演时的结果。市场环境、ETF 流向、链上估值与衍生品仓位均未参与本页计算。完整日报与周报仍在「引力计划」定时任务中查看。</p></section>'}
function render(){if(!state.history)return;const page=section();document.querySelectorAll('nav a').forEach(x=>{const on=x.id==='n-'+page;x.classList.toggle('active',on);if(on)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});$('asof').dateTime=lastDate();$('asof').textContent=lastDate().replaceAll('-','.');$('root').innerHTML=page==='overview'?'<h1 class="sr-only">市场总览</h1><div class="quotes">'+card('BTC')+card('ETH')+'</div><div class="dash">'+chartPanel()+modelPanel()+'</div>':page==='model'?modelView():sources();renderChart()}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='refresh'){sync();return}if(b.dataset.range)state.range=Number(b.dataset.range);else if(b.dataset.metric)state.metric=b.dataset.metric;else return;render();const attr=b.dataset.range?'range':'metric';document.querySelector('[data-'+attr+'="'+b.dataset[attr]+'"]')?.focus({preventScroll:true})});
document.addEventListener('change',e=>{if(e.target.id==='assetSelect'){state.asset=e.target.value;if(section()==='model')history.replaceState(null,'','#model/'+state.asset);render();$('assetSelect')?.focus({preventScroll:true})}});
window.addEventListener('hashchange',()=>{readAssetRoute();render();window.scrollTo(0,0)});let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(renderChart,100)});
const utcDate=t=>new Date(t).toISOString().slice(0,10);
async function extend(a,until){const copy=state.history[a].slice();let next=Date.parse(copy.at(-1)[0])+day;while(next<=until){const url=new URL('https://data-api.binance.vision/api/v3/klines');url.search=new URLSearchParams({symbol:a+'USDT',interval:'1d',startTime:next,endTime:until+day-1,limit:1000});const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),9000);let data;try{const res=await fetch(url,{signal:ctrl.signal});if(!res.ok)throw Error('unavailable');data=await res.json()}finally{clearTimeout(timeout)}if(!Array.isArray(data)||!data.length)throw Error('missing');for(const row of data){const lo=Number(row[3]),cl=Number(row[4]);if(row[0]!==next||next>until||!Number.isFinite(lo)||!Number.isFinite(cl)||lo<=0||cl<lo)throw Error('invalid candle');copy.push([utcDate(next),lo,cl]);next+=day}}return copy}
async function sync(){if(state.loading)return;state.loading=true;state.message='正在检查最新收盘日线。';if(section()==='sources')render();try{const until=Math.floor(Date.now()/day)*day-day;if(Date.parse(lastDate())<until){const [BTC,ETH]=await Promise.all(Object.keys(coins).map(a=>extend(a,until)));state.history={BTC,ETH};memo.clear()}state.message='已覆盖最近一个完整 UTC 交易日。'}catch{state.message='本次行情连接未完成，当前展示截至 '+lastDate()+' 的完整日线。'}finally{state.loading=false;if(section()==='sources'||$('asof').textContent.slice(0,10)!==lastDate().replaceAll('-','.'))render()}}
async function start(){try{const r=await fetch('history.json');if(!r.ok)throw Error();state.history=await r.json();readAssetRoute();render();await sync()}catch{$('root').textContent='历史日线载入失败，请重新加载页面。'}}
start();

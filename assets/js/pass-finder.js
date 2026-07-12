async function loadPasses(){
var res = await fetch('/data/passes.json');
return res.json();
}

function citySequence(selected){
var order = ['nagoya','kanazawa','toyama','shirakawago','fukui','takayama','kyoto','osaka'];
return order.filter(function(c){ return selected.indexOf(c) !== -1; });
}

function estimateSingleFare(cities, fares){
var total = 0;
for(var i=0;i<cities.length-1;i++){
var a = cities[i], b = cities[i+1];
var key1 = a+'-'+b, key2 = b+'-'+a;
if(fares[key1]!=null){ total += fares[key1]; }
else if(fares[key2]!=null){ total += fares[key2]; }
}
return total;
}

function passCovers(pass, cities){
return cities.every(function(c){ return pass.coverage.indexOf(c) !== -1; });
}
async function runCalculator(){
var checkboxes = document.querySelectorAll('.city-check:checked');
var checked = Array.prototype.map.call(checkboxes, function(el){ return el.value; });
var days = parseInt(document.getElementById('trip-days').value, 10) || 1;
var resultEl = document.getElementById('pf-result');
if(checked.length < 2){
resultEl.innerHTML = '<p>請至少勾選兩個城市以比較交通方式。</p>';
return;
}
var data = await loadPasses();
var cities = citySequence(checked);
var singleTotal = estimateSingleFare(cities, data.singleFares);
var candidates = data.passes.filter(function(p){ return passCovers(p, cities) && (p.days == null || p.days >= days); });
var rows = candidates.map(function(p){ return { name: p.name, price: p.priceJPY, notes: p.notes }; });
rows.push({ name: '單程票組合', price: singleTotal, notes: '各段單程票加總估算' });
rows.sort(function(a,b){ return a.price - b.price; });
var best = rows[0];
var html = '<table><thead><tr><th>方案</th><th>票價(円)</th><th>備註</th></tr></thead><tbody>';
rows.forEach(function(r){
html += '<tr><td>' + r.name + (r.name===best.name ? ' <span class="badge">推薦</span>' : '') + '</td><td>¥' + r.price.toLocaleString() + '</td><td>' + (r.notes||'') + '</td></tr>';
});
html += '</tbody></table>';
html += '<p class="result-highlight">推薦：' + best.name + '（¥' + best.price.toLocaleString() + '）</p>';
if(best.name !== '單程票組合'){
var savings = singleTotal - best.price;
if(savings > 0){ html += '<p>相較單程票組合可省下約 ¥' + savings.toLocaleString() + '</p>'; }
}
html += '<p class="disclaimer">' + data.disclaimer + '</p>';
resultEl.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function(){
var btn = document.getElementById('pf-calc-btn');
if(btn){ btn.addEventListener('click', runCalculator); }
});

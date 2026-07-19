var REGION_ORDER = ['北海道','東北','関東','甲信越','北陸','東海','関西','中国','四国','九州'];

async function initKoyoRegions(){
var container = document.getElementById('koyo-regions');
if(!container) return;
try{
var manifestRes = await fetch('/data/koyo/latest.json');
var manifest = await manifestRes.json();
var res = await fetch('/data/koyo/' + manifest.latestFile);
var data = await res.json();
var byRegion = {};
data.spots.forEach(function(spot){
if(!byRegion[spot.region]) byRegion[spot.region] = [];
byRegion[spot.region].push(spot);
});
var html = '';
REGION_ORDER.forEach(function(region){
var prefs = byRegion[region];
if(!prefs || !prefs.length) return;
html += '<div class="region-block">';
html += '<h2>' + region + '</h2>';
html += '<ul class="pref-summary-list">';
prefs.forEach(function(p){
html += '<li><strong>' + p.name + '</strong>';
html += p.typicalPeak ? ' <span class="peak-badge">例年見頃 ' + p.typicalPeak + '</span>' : '';
html += ' <span class="status-tag">' + p.status + '</span>';
html += '</li>';
});
html += '</ul></div>';
});
container.innerHTML = html || '<p>資料載入失敗。</p>';
var dateEl = document.getElementById('koyo-date');
if(dateEl){ dateEl.textContent = '資料日期：' + data.date + '（' + data.source + '）'; }
}catch(e){
container.innerHTML = '<p>資料載入失敗，請稍後重試。</p>';
var el = document.getElementById('koyo-date');
if(el){ el.textContent = ''; }
}
}
document.addEventListener('DOMContentLoaded', initKoyoRegions);

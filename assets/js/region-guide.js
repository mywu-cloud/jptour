async function initRegionGuide(){
var container = document.getElementById('region-spots');
if(!container) return;
var region = container.getAttribute('data-region');
try{
var res = await fetch('/data/regions/' + region + '.json');
var data = await res.json();
var html = '';
data.prefectures.forEach(function(pref){
html += '<div class="pref-block">';
html += '<h3>' + pref.name + (pref.typicalPeak ? ' <span class="peak-badge">例年見頃 ' + pref.typicalPeak + '</span>' : '') + '</h3>';
if(pref.spots && pref.spots.length){
html += '<ul class="spot-list">';
var spots = pref.spots.slice().sort(function(a,b){ return (b.wantToGo||0) - (a.wantToGo||0); }).slice(0,5);
spots.forEach(function(spot){
html += '<li><a href="' + spot.sourceUrl + '" target="_blank" rel="noopener">' + spot.name + '</a> ' + (spot.area||'') + '｜例年見頃：' + (spot.koyoPeak||'—') + '</li>';
});
html += '</ul>';
} else {
html += '<p class="disclaimer">逐點名所清單製作中，目前僅提供縣別例年見頃平均。</p>';
}
html += '</div>';
});
container.innerHTML = html;
var dateEl = document.getElementById('region-date');
if(dateEl){ dateEl.textContent = '資料日期：' + data.date + '（' + data.source + '）'; }
}catch(e){
container.innerHTML = '<p>資料載入失敗，請稍後重試。</p>';
}
}
document.addEventListener('DOMContentLoaded', initRegionGuide);

var STATUS_COLOR = { '青葉': '#4caf50', '色づき始め': '#ffb300', '見頃': '#e64a19', '落葉': '#8d6e63' };

async function initKoyoMap(){
  var map = L.map('koyo-map').setView([36.5, 137.0], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

try{
  var res = await fetch('/data/koyo/2026-07-09.json');
  var data = await res.json();
  data.spots.forEach(function(spot){
    var color = STATUS_COLOR[spot.status] || '#999';
    var marker = L.circleMarker([spot.lat, spot.lng], {
      radius: 9, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.9
    }).addTo(map);
    marker.bindPopup(
      '<strong>' + spot.name + '</strong><br>' +
      spot.region + '<br>' +
      '狀態：' + spot.status + '<br>' +
      '歷年見頃：' + spot.typicalPeak
      );
  });
  var dateEl = document.getElementById('koyo-date');
  if(dateEl){ dateEl.textContent = '資料日期：' + data.date + '（' + data.source + '）'; }
}catch(e){
  var el = document.getElementById('koyo-date');
  if(el){ el.textContent = '資料載入失敗，請稍後重試。'; }
}
}

document.addEventListener('DOMContentLoaded', initKoyoMap);

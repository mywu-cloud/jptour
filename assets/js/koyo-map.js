// 紅葉前線頁：讀取 /data/koyo/latest.json → 當日快照，渲染
//   1) 日本気象 第N回 主要城市紅葉／黄葉預測表
//   2) Leaflet 景點地圖（依色づき狀態上色、可篩選）
//   3) 各區域 → 都道府県彙整（狀態分布條、見頃預測區間、可展開景點清單）
// 相容舊版快照（只有 spots[] 的人工彙整檔）。

var REGION_ORDER = ['北海道','東北','関東','甲信越','北陸','東海','関西','中国','四国','九州'];
var REGION_SLUG = {'北海道':'hokkaido','東北':'tohoku','関東':'kanto','甲信越':'koshinetsu','北陸':'hokuriku','東海':'tokai','関西':'kansai','中国':'chugoku','四国':'shikoku','九州':'kyushu'};
var STATUS_ORDER = ['青葉','色づき始め','見頃','色あせ始め','落葉'];
var MAP_ORDER = STATUS_ORDER.concat(['未提供']);
var STATUS_ZH = {'青葉':'青葉','色づき始め':'開始轉紅','見頃':'最佳觀賞','色あせ始め':'開始凋零','落葉':'落葉','未提供':'未提供狀況'};
var STATUS_COLOR = {'青葉':'#7cb342','色づき始め':'#f4a300','見頃':'#d7301f','色あせ始め':'#a1665e','落葉':'#9e9e9e','未提供':'#cfcfcf'};

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function safeUrl(u){ return /^https:\/\//.test(u || '') ? esc(u) : '#'; }
function mdNum(md){ // "11-24" or "11/24" → 1124
  if(!md) return 9999;
  var p = String(md).split(/[-\/]/); return Number(p[0])*100 + Number(p[1]);
}
function fmtMD(md){ if(!md) return ''; var p = String(md).split(/[-\/]/); return Number(p[0]) + '/' + Number(p[1]); }
function statusTag(st){
  if(!st) return '';
  return '<span class="status-tag koyo-st" style="background:' + (STATUS_COLOR[st]||'#ccc') + '">' + esc(STATUS_ZH[st]||st) + '</span>';
}

function renderCityForecast(data){
  var el = document.getElementById('koyo-city');
  if(!el) return;
  var cf = data.cityForecast, nk = data.sources && data.sources.nkishou;
  if(!cf || !cf.koyo || !cf.koyo.length){ el.style.display = 'none'; return; }
  function table(rows, label){
    var h = '<table class="koyo-city-table"><thead><tr><th>城市</th><th>' + label + '預測日</th><th>平年差</th><th>平年</th><th>樹種</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var cls = r.diff > 0 ? 'late' : (r.diff < 0 ? 'early' : '');
      var d = r.diff == null ? '—' : (r.diff > 0 ? '晚 ' + r.diff + ' 日' : (r.diff < 0 ? '早 ' + (-r.diff) + ' 日' : '同平年'));
      h += '<tr><td>' + esc(r.city) + '</td><td><strong>' + esc(r.date) + '</strong></td><td class="' + cls + '">' + esc(d) +
           (r.diffText ? '<br><small>' + esc(r.diffText) + '</small>' : '') + '</td><td>' + esc(r.normal) + '</td><td>' + esc(r.species) + '</td></tr>';
    });
    return h + '</tbody></table>';
  }
  var title = nk ? ('日本気象 ' + (nk.round ? '第' + esc(nk.round) + '回' : '') + '紅葉・黄葉見頃予想' + (nk.published ? '（' + esc(nk.published) + ' 發表）' : '')) : '主要城市紅葉預測';
  el.innerHTML =
    '<h2>📈 主要城市預測</h2><p class="disclaimer" style="margin-top:0">' + title +
    '。「紅葉日」為代表樹木整體轉紅之日，與景點見頃日略有差異。</p>' +
    '<div class="koyo-tabs"><button class="on" data-t="koyo">🍁 紅葉（楓）</button><button data-t="ichou">🟡 黃葉（銀杏）</button></div>' +
    '<div data-p="koyo">' + table(cf.koyo, '紅葉') + '</div>' +
    '<div data-p="ichou" hidden>' + table(cf.ichou || [], '黃葉') + '</div>' +
    (nk ? '<p class="disclaimer">來源：<a href="' + safeUrl(nk.url) + '" target="_blank" rel="noopener">日本気象株式会社</a></p>' : '');
  el.querySelectorAll('.koyo-tabs button').forEach(function(b){
    b.addEventListener('click', function(){
      el.querySelectorAll('.koyo-tabs button').forEach(function(x){ x.classList.toggle('on', x === b); });
      el.querySelectorAll('[data-p]').forEach(function(p){ p.hidden = p.getAttribute('data-p') !== b.getAttribute('data-t'); });
    });
  });
}

function renderMap(data){
  var wrap = document.getElementById('koyo-map-card');
  var spots = (data.wnSpots || []).filter(function(s){ return s.lat && s.lng; });
  if(!wrap || !spots.length || typeof L === 'undefined'){ if(wrap) wrap.style.display = 'none'; return; }
  var map = L.map('koyo-map', { preferCanvas: true, scrollWheelZoom: false }).setView([36.5, 137.5], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var layers = {};
  MAP_ORDER.forEach(function(st){ layers[st] = L.layerGroup().addTo(map); });
  spots.forEach(function(s){
    var st = layers[s.status] ? s.status : '未提供';
    L.circleMarker([s.lat, s.lng], {
      radius: st === '見頃' ? 6 : 4.5, weight: 1, color: '#fff', fillColor: STATUS_COLOR[st], fillOpacity: .9
    }).bindPopup(
      '<strong>' + esc(s.name) + '</strong><br>' + esc(s.pref) + ' ' + esc(s.city) + '<br>' +
      '狀態：' + esc(STATUS_ZH[st]) + (s.statusRaw && s.statusRaw !== s.status && s.statusRaw !== 'まだ' ? '（' + esc(s.statusRaw) + '）' : '') + '<br>' +
      (s.forecast ? '見頃預測：<strong>' + esc(fmtMD(s.forecast)) + '</strong><br>' : '') +
      (s.reinen ? '例年：' + esc(s.reinen) + '<br>' : '') +
      '<a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener">Weathernews 詳細 →</a>'
    ).addTo(layers[st]);
  });
  var counts = {};
  spots.forEach(function(s){ var k = layers[s.status] ? s.status : '未提供'; counts[k] = (counts[k]||0) + 1; });
  var legend = document.getElementById('koyo-legend');
  legend.innerHTML = MAP_ORDER.map(function(st){
    return '<label class="koyo-chip"><input type="checkbox" checked data-st="' + esc(st) + '"><span class="dot" style="background:' + STATUS_COLOR[st] + '"></span>' +
      esc(STATUS_ZH[st]) + ' <small>' + (counts[st]||0) + '</small></label>';
  }).join('');
  legend.querySelectorAll('input').forEach(function(cb){
    cb.addEventListener('change', function(){
      var lg = layers[cb.getAttribute('data-st')];
      if(cb.checked) lg.addTo(map); else map.removeLayer(lg);
    });
  });
}

function prefBar(c){
  if(!c) return '';
  var total = STATUS_ORDER.reduce(function(a, st){ return a + (c[st]||0); }, 0);
  if(!total) return '';
  return '<span class="koyo-bar" title="' + esc(STATUS_ORDER.map(function(st){ return STATUS_ZH[st] + ' ' + (c[st]||0); }).join('／')) + '">' +
    STATUS_ORDER.map(function(st){
      return c[st] ? '<i style="width:' + (c[st]/total*100).toFixed(1) + '%;background:' + STATUS_COLOR[st] + '"></i>' : '';
    }).join('') + '</span>';
}

function renderRegions(data){
  var container = document.getElementById('koyo-regions');
  var byRegion = {};
  data.spots.forEach(function(p){ (byRegion[p.region] = byRegion[p.region] || []).push(p); });
  var spotsByPref = {};
  (data.wnSpots || []).forEach(function(s){ (spotsByPref[s.prefId] = spotsByPref[s.prefId] || []).push(s); });

  var html = '';
  REGION_ORDER.forEach(function(region){
    var prefs = byRegion[region];
    if(!prefs || !prefs.length) return;
    var slug = REGION_SLUG[region];
    html += '<div class="region-block"><h2><a href="/regions/' + slug + '/">' + esc(region) + '</a></h2><ul class="pref-summary-list">';
    prefs.forEach(function(p){
      var list = (spotsByPref[p.id] || []).slice().sort(function(a, b){ return mdNum(a.forecast) - mdNum(b.forecast); });
      var peakNow = p.statusCounts ? (p.statusCounts['見頃']||0) : 0;
      html += '<li><details><summary><strong>' + esc(p.name) + '</strong>' + statusTag(p.status) +
        (p.forecastFrom ? ' <span class="peak-badge">今年見頃預測 ' + esc(p.forecastFrom) + (p.forecastTo && p.forecastTo !== p.forecastFrom ? '–' + esc(p.forecastTo) : '') + '</span>' : '') +
        (p.typicalPeak ? ' <span class="koyo-reinen">例年 ' + esc(p.typicalPeak) + '</span>' : '') +
        (peakNow ? ' <span class="koyo-now">🍁 ' + peakNow + ' 處正值見頃</span>' : '') +
        prefBar(p.statusCounts) + '</summary>';
      if(list.length){
        html += '<table class="koyo-spot-table"><thead><tr><th>景點</th><th>狀態</th><th>見頃預測</th><th>例年</th></tr></thead><tbody>';
        list.forEach(function(s){
          html += '<tr><td><a href="' + safeUrl(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a><br><small>' + esc(s.city) + (s.lightup ? '・🌙夜楓' : '') + '</small></td>' +
            '<td>' + (s.status ? statusTag(s.status) : '<small>—</small>') + (s.statusRaw && s.statusRaw !== s.status && s.statusRaw !== 'まだ' ? '<br><small>' + esc(s.statusRaw) + '</small>' : '') + '</td><td>' + (s.forecast ? '<strong>' + esc(fmtMD(s.forecast)) + '</strong>' : '—') + '</td><td><small>' + esc(s.reinen || '—') + '</small></td></tr>';
        });
        html += '</tbody></table>';
        if(p.wnUrl) html += '<p class="disclaimer">' + esc(p.name) + '全 ' + list.length + ' 處景點資料：<a href="' + safeUrl(p.wnUrl) + '" target="_blank" rel="noopener">Weathernews</a></p>';
      } else {
        html += '<p class="disclaimer">' + (p.error ? '本日資料抓取失敗，請稍後再看。' : '尚無景點明細。') + '</p>';
      }
      html += '</details></li>';
    });
    html += '</ul><p class="disclaimer"><a href="/regions/' + slug + '/">查看' + esc(region) + '詳細指南 →</a></p></div>';
  });
  container.innerHTML = html || '<p>資料載入失敗。</p>';
}

async function initKoyo(){
  var container = document.getElementById('koyo-regions');
  if(!container) return;
  var dateEl = document.getElementById('koyo-date');
  try{
    var manifest = await (await fetch('/data/koyo/latest.json', { cache: 'no-cache' })).json();
    var data = await (await fetch('/data/koyo/' + encodeURIComponent(manifest.latestFile))).json();
    renderCityForecast(data);
    renderMap(data);
    renderRegions(data);
    if(dateEl){
      var wn = data.sources && data.sources.weathernews;
      dateEl.textContent = '資料日期：' + data.date + (wn && wn.announced ? '（Weathernews 色づき狀況 ' + wn.announced + ' 發表）' : '') + '｜來源：' + data.source;
    }
  }catch(e){
    container.innerHTML = '<p>資料載入失敗，請稍後重試。</p>';
    if(dateEl) dateEl.textContent = '';
  }
}
document.addEventListener('DOMContentLoaded', initKoyo);

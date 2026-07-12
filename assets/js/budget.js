var HOTEL_RATES = { budget: 1200, mid: 2600, luxury: 5500 };
var CITY_COEF = { tokyo: 1.3, osaka: 1.15, hokuriku: 0.95, other: 1.0 };
var DAILY_BASE = 1500;

async function fetchRate(){
try{
var res = await fetch('https://open.er-api.com/v6/latest/JPY');
var data = await res.json();
return (data.rates && data.rates.TWD) ? data.rates.TWD : null;
}catch(e){
return null;
}
}

async function initRate(){
var el = document.getElementById('fx-rate');
var rate = await fetchRate();
if(rate){
el.textContent = '目前匯率：1 JPY ≈ ' + rate.toFixed(4) + ' TWD';
window.__fxRate = rate;
}else{
el.textContent = '匯率查詢失敗，以下試算僅供參考（可稍後重試）';
}
}
function calcBudget(){
var days = parseInt(document.getElementById('b-days').value, 10) || 1;
var nights = Math.max(days - 1, 1);
var travelers = parseInt(document.getElementById('b-travelers').value, 10) || 1;
var hotelLevel = document.getElementById('b-hotel').value;
var cityType = document.getElementById('b-city').value;
var flight = parseFloat(document.getElementById('b-flight').value) || 0;
var jpyCash = parseFloat(document.getElementById('b-jpy').value) || 0;

var rooms = Math.ceil(travelers / 2);
var hotelTotal = HOTEL_RATES[hotelLevel] * nights * rooms;
var dailyTotal = DAILY_BASE * CITY_COEF[cityType] * days * travelers;
var flightTotal = flight * travelers;
var jpyInTwd = window.__fxRate ? jpyCash * window.__fxRate : null;
var grandTotal = hotelTotal + dailyTotal + flightTotal + (jpyInTwd || 0);

var html = '<table><tbody>';
html += '<tr><td>住宿（' + nights + '晚 × ' + rooms + '房）</td><td>NT$ ' + Math.round(hotelTotal).toLocaleString() + '</td></tr>';
html += '<tr><td>當地餐飲/交通/雜支（' + days + '天 × ' + travelers + '人）</td><td>NT$ ' + Math.round(dailyTotal).toLocaleString() + '</td></tr>';
html += '<tr><td>機票（' + travelers + '人）</td><td>NT$ ' + Math.round(flightTotal).toLocaleString() + '</td></tr>';
if(jpyInTwd != null){
html += '<tr><td>日幣現金換算</td><td>NT$ ' + Math.round(jpyInTwd).toLocaleString() + '</td></tr>';
}
html += '</tbody></table>';
html += '<p class="result-highlight">預估總花費：NT$ ' + Math.round(grandTotal).toLocaleString() + '</p>';
html += '<p class="disclaimer">試算結果僅供參考，實際花費依匯率、季節、個人消費習慣而異。</p>';
document.getElementById('budget-result').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function(){
initRate();
var btn = document.getElementById('b-calc-btn');
if(btn){ btn.addEventListener('click', calcBudget); }
});

(function(){
var m = new Date().getMonth() + 1;
var season = 'winter';
if(m>=3 && m<=5){ season = 'spring'; }
else if(m>=6 && m<=8){ season = 'summer'; }
else if(m>=9 && m<=11){ season = 'autumn'; }
document.body.classList.add('season-' + season);
})();

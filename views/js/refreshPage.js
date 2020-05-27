//Refresh every INTERVAL seconds
const INTERVAL = 10;
const URL = "./index.html";

setInterval(function() {
  window.open(URL, "_self");
}, INTERVAL * 1000);
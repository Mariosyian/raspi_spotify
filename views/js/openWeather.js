const axios = require('axios').default;
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const server = require('./../../server.js');

const LOGTAG = 'OpenWeather: ';

const mongoContext = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

const dbUrl = 'mongodb+srv://' + process.env.MONGO_USER + ':' +
              process.env.MONGO_PASS + '@raspi-weather-p6zoz.mongodb.net/weather';

mongoose.connect(dbUrl, mongoContext, function(err) {
  if (err) { 
    console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'Failed to connect to database! Exiting server...');
    console.error('\x1b[31m%s\x1b[0m', err);
    process.exit(1);
  } else {
    console.log(LOGTAG + 'Successfully connected to database!');
  }
});

const weatherData = mongoose.model('Weather');

module.exports = {
  postWeatherAPI: function() {
    const cityName = 'Manchester';
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' +
                cityName + '&appid=' + process.env.OPENWEATHER_API_KEY + '&units=metric';
  
    axios({
      url: url,
      method: 'POST',
      headers: {'Accept': 'application/json'}
    })
    .then(function(response) {
      console.log('POST @ ' + url + ' with response: ' + response.status);
      const date = new Date();
      const split = ('' + date).split(' ');
      const timestamp = split[0] + ', ' + split[2] + '-' + split[1] + '-' + split[3] +
                      ' @ ' + split[4] + ' (' + split[5] + ')';
      const weather = new weatherData({
        time : timestamp,
        temperature : response.data.main.temp,
        humidity : response.data.main.humidity
      });
  
      weather.save(function(err) {
        if (err) {
          console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'openWeatherAPI/ -- ERROR: ' + err);
        } else {
          console.log('Weather data has been successfully added to database!');
        }
      });
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'weather/ -- ERROR: ' + err);
    })
  }
}
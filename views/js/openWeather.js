const auth = require('./auth.js');
const axios = require('axios').default;
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const queryString = require('query-string');
const schedule = require('node-schedule');
const spotify = require('spotify-web-api-node');


exports = {
  postWeatherAPI: function() {
    console.log("Is this called?");
    const OpenWeatherAPI = auth.openWeatherAPI;
    const cityName = 'Manchester';
    const url = 'https://api.openweathermap.org/data/2.5/weather?q=' +
                cityName + '&appid=' + OpenWeatherAPI + '&units=metric';

    axios({
      url: url,
      method: 'POST',
      headers: {'Accept': 'application/json'}
    })
    .then(function(response) {
      logResponse('POST', url, {statusCode: response.status});

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
          // res.render('ejs/error', {error_msg: err});
        } else {
          console.log('Weather data have been successfully added to database!');
        }
      });
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'weather/ -- ERROR: ' + err);
      // res.render('ejs/error', {error_msg: err});
    })
  }
}
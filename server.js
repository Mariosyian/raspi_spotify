
/***** DEPENDENCIES *****/
const auth = require('./views/js/auth.js');
const axios = require('axios').default;
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const queryString = require('query-string');
const spotify = require('spotify-web-api-node');

/***** DEPENDENCY VARIABLES *****/
const app = express();
app.set('view engine', 'ejs');

/***** STATIC FILES *****/
app.use('/static', express.static(__dirname + '/views/'));
app.use(bodyParser.urlencoded({extended: true}));

/***** SERVER SETUP *****/
const port = 3000;
const homeURI = 'http://localhost:' + port + '/';

const mongoContext = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

const dbUrl = 'mongodb+srv://' + auth.mongoUser + ':' +
              auth.mongoPass + '@raspi-weather-p6zoz.mongodb.net/weather';

mongoose.connect(dbUrl, mongoContext, function(err) {
  if (err) { 
    console.error('\x1b[31m%s\x1b[0m', 'Failed to connect to database! Exiting server...');
    console.error('\x1b[31m%s\x1b[0m', err);
    process.exit(1);
  } else {
    console.log('Successfully connected to database!');
  }
});

const weatherSchema = new mongoose.Schema({
  time: String,
  temperature: Number,
  humidity: Number
});

const weatherData = mongoose.model('Weather', weatherSchema);

/***** GLOBAL VARIABLES *****/
const LOGTAG = 'Server: /';

const spotifyClientID = auth.spotifyClientID;
const spotifySecretID = auth.spotifySecretID;
const spotifyUserID = auth.spotifyUserID;

var spotifyAccessToken = null;
var spotifyRefreshToken = null;

/***** SPOTIFY PLAYLISTS ******/
const sunny = [
  '37i9dQZF1DX843Qf4lrFtZ', // Young, Wild & Free
  '37i9dQZF1DX1H4LbvY4OJi', // Happy pop
  '37i9dQZF1DXeby79pVadGa'  // Get Home Happy!
]

const rainy = [
  '37i9dQZF1DXaw68inx4UiN', // Sounds of the rainforest
  '37i9dQZF1DX4PP3DA4J0N8', // Nature Sounds
  '37i9dQZF1DX4aYNO8X5RpR'  // Nightstorms
]

/***** CONTEXT VARIABLES ******/
/* SPOTIFY */
var spotifyUser = '';
var currentDevice = null;
var currentTrack = null;
var errorMessages = '';
var playlist = [];
var recentTracks = [];
var repeat = '';
var shuffle = false;
var spotifyPlaying = false;
/* WEATHER */
var weatherObject = []

/***** GET REQUESTS *****/
/* Home Page */
app.get('/', function(req, res) {

  logResponse('GET', '/', res);
  if (spotifyAccessToken === null) {
    res.redirect('/spotify');
  } else {
    const context = {
      user: spotifyUser,
      current_device: currentDevice,
      current_track: currentTrack,
      playing: spotifyPlaying,
      playlist: playlist,
      recentTracks: recentTracks,
      repeat: repeat,
      shuffle: shuffle,
      weather: weatherObject
    };
    res.render('ejs/index', context);
  }
});

/* Error Page */
app.get('/error', function(req, res) {
  logResponse('GET', '/error', res);
  const context = {
    error_msg : errorMessages
  };
  res.render('ejs/error', context);
});

/* Spotify Authentication */
app.get('/spotify', function(req, res) {

  logResponse('GET', '/spotify', res);
  const callback = homeURI + 'spotify_callback';

  var scopes = 'user-modify-playback-state user-read-email ' +
               'user-read-playback-state user-read-private ' +
               'user-read-recently-played user-read-currently-playing ' +
               'user-modify-playback-state';
  var url = 'https://accounts.spotify.com/authorize?' +
            queryString.stringify({
              response_type: 'code',
              client_id: spotifyClientID,
              scope: scopes,
              redirect_uri: callback
            });
  res.redirect(url);
  console.log(LOGTAG + 'spotify/ -- ' + 'Spotify callback redirected to --> ' + callback);
  return;
});

/*
 * Spotify Authentication Callback
 * Used as redirect uri to obtain auth_token
 */
app.get('/spotify_callback', function(req, res) {

  logResponse('GET', '/spotify_callback', res);

  const code = req.query.code || null;
  if (code === null) {
    console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'Code returned null from authorisation endpoint');
    errorMessages = "Something went wrong during Spotify callback...Try again";
    res.render('ejs/error', {error_msg: errorMessages});
    return;
  }

  // POST to get an access token
  axios({
    url: 'https://accounts.spotify.com/api/token',
    method: 'POST',
    params: {
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: homeURI + 'spotify_callback'
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    auth: {
      username: spotifyClientID,
      password: spotifySecretID
    }
  })
  .then(function(response) {
    logResponse('POST', 'https://accounts.spotify.com/api/token', { statusCode: response.status });
    spotifyAccessToken = response.data.access_token;
    spotifyRefreshToken = response.data.refresh_token;
    console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_callback/ -- ' +
                                     'Succesfully retrieved access token!');
    
    res.redirect('/spotify_get_current');
  })
  .catch(function(err) {
    console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_callback/ -- ERROR: ' + err);
    res.render('ejs/error', {error_msg: err});
  })
  return;
});

/* Spotify current state and user info */
app.get('/spotify_get_current', function(req, res) {
  
  logResponse('GET', '/spotify_get_current', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    // GET Current user info
    axios({
      url: 'https://api.spotify.com/v1/me',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('GET', 'https://api.spotify.com/v1/me', { statusCode: response.status });
      if (response.status !== 200) {
        console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/me -- WARNING: ');
        console.log(repsonse);
      } else {
        console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/me -- ' +
                    'Succesfully logged user.');
        spotifyUser = response.data;
      }
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_get_current/me -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
    
    // GET Current player state
    /* Returns undefined if not using Spotify App on device */
    axios({
      url: 'https://api.spotify.com/v1/me/player',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('GET', 'https://api.spotify.com/v1/me/player', { statusCode: response.status });
      if (response.status !== 200) {
        console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/player -- WARNING: ' +
                                        'Player has returned an invalid result!');
      } else {
        console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/player -- ' +
                                        'Succesfully logged player state.');
        const body = response.data;

        spotifyPlaying = body.is_playing;
        currentTrack = body.item;
        currentDevice = body.device;
        volume = body.device.volume_percent;
        repeat = body.repeat_state;
        shuffle = body.shuffle_state;
      }
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_get_current/player -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })

    // GET recently played tracks
    axios({
      url: 'https://api.spotify.com/v1/me/player/recently-played',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('GET', 'https://api.spotify.com/v1/me/player/recently-played', {
        statusCode: response.status
      });
      if (response.status !== 200) {
        console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/recently-played -- WARNING:');
        console.log(response);
      } else {
        console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/recently-played -- ' +
                                        'Succesfully retrieved recent tracks.');
        recentTracks = [];
        if (response.data.items.length <= 5) {
          response.data.items.forEach(item => {
            recentTracks = recentTracks.concat(item);
          });
        } else {
          for (var i = 0; i < 5; i ++) {
            recentTracks = recentTracks.concat(response.data.items[i]);
          }
        }
      }

      /* After final API call ONLY continue to Weather API */
      res.redirect('/weather');
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_get_current/recently-played -- ERROR: ' +
                    err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Spotify play */
app.get('/spotify_play', function(req, res) {

  logResponse('PUT', '/spotify_play', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_play/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    // PUT player to play state
    axios({
      url: 'https://api.spotify.com/v1/me/player/play',
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('PUT', 'https://api.spotify.com/v1/me/player/play', {
        statusCode: response.status
      });
      res.redirect(homeURI);
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_play/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Spotify pause */
app.get('/spotify_pause', function(req, res) {

  logResponse('PUT', '/spotify_pause', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_pause/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    axios({
      url: 'https://api.spotify.com/v1/me/player/pause',
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('PUT', 'https://api.spotify.com/v1/me/player/pause', {
        statusCode: response.status
      });
      res.redirect(homeURI);
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_pause/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Get weather data */
app.get('/weather', function(req, res) {
  
  logResponse('GET', '/weather', res);
  weatherData.find(function(err, data) {
    if (err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'weather -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    } else {

      var playlistID = '';
      var randomIndex = 0;

      weatherObject = [];
      /*
       * Last entry in database is latest timestamp
       * so take data in reverse.
       */ 
      if (data.length <= 5) {
        for (var i = data.length - 1; i >= 0; i --) {
          weatherObject = weatherObject.concat(data[i]);
        }
      } else {
        var counter = 0;
        for (var i = data.length - 1; counter < 5; i --) {
          weatherObject = weatherObject.concat(data[i]);
          counter ++;
        }
      }

      // Decide which playlist to send based on readings
      if ( weatherObject[0].temperature > 17) {
        randomIndex = Math.round(Math.random() * sunny.length);
        playlistID = sunny[0];
      } else {
        randomIndex = Math.round(Math.random() * rainy.length);
        playlistID = rainy[0];
      }

      // GET playlist information
      axios({
        url: 'https://api.spotify.com/v1/playlists/'.concat(playlistID),
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + spotifyAccessToken
        }
      })
      .then(function(response) {
        logResponse('GET', 'https://api.spotify.com/v1/playlists/'.concat(playlistID), {
          statusCode: response.status
        });
        const body = response.data;
        playlist = {
          url : body.external_urls.spotify,
          img : body.images[0].url,
          name : body.name,
          owner : body.owner.display_name
        }
        res.redirect(homeURI);
      })
      .catch(function(err) {
        console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'weather/playlists/ -- ERROR: ' + err);
        res.render('ejs/error', {error_msg: err});
      })
    }
  });
  return;
});

/***** POST REQUESTS *****/
/* Spotify Play/Pause */
app.post('/spotify_play_pause', function(req, res) {

  logResponse('POST', '/spotify_play_pause', res);
  if (spotifyPlaying) {
    res.redirect('/spotify_pause');
    spotifyPlaying = false;
  } else {
    res.redirect('/spotify_play');
    spotifyPlaying = true;
  }
  return;
});

/* Spotify skip track */
app.post('/spotify_next', function(req, res) {

  logResponse('POST', '/spotify_next', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_next/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    // POST to player to skip track
    axios({
      url: 'https://api.spotify.com/v1/me/player/next',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('POST', 'https://api.spotify.com/v1/me/player/next', {
        statusCode: response.status
      });
      res.redirect('/spotify_get_current');
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_next/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Spotify previous track */
app.post('/spotify_previous', function(req, res) {

  logResponse('POST', '/spotify_previous', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_previous/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    var options = {
      url: 'https://api.spotify.com/v1/me/player/previous',
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // POST to player to skip to previous track
    axios({
      url: 'https://api.spotify.com/v1/me/player/previous',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('POST', 'https://api.spotify.com/v1/me/player/previous', {
        statusCode: response.status
      });
      res.redirect('/spotify_get_current');
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_previous/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Spotify repeat */
app.post('/spotify_repeat', function(req, res) {

  logResponse('POST', '/spotify_repeat', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_repeat/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {

    if ( repeat === 'track' || repeat === 'context' ) {
      repeat = 'off';
    } else {
      repeat = 'track';
    }

    // PUT player to toggle repeat mode
    axios({
      url: 'https://api.spotify.com/v1/me/player/repeat?state=' + repeat,
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('PUT', 'https://api.spotify.com/v1/me/player/repeat?state=' + repeat, {
        statusCode: response.status
      });
      res.redirect('/spotify_get_current');
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_next/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Spotify shuffle */
app.post('/spotify_shuffle', function(req, res) {

  logResponse('POST', '/spotify_shuffle', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_shuffle/ -- ' + 'Access token is null');noAuthToken(res);
  } else {

    var toggle = '';
    if ( shuffle ) {
      toggle = 'false';
    } else {
      toggle = 'true';
    }
    shuffle = !shuffle;

    // PUT player to toggle shuffle mode
    axios({
      url: 'https://api.spotify.com/v1/me/player/shuffle?state=' + toggle,
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken
      }
    })
    .then(function(response) {
      logResponse('PUT', 'https://api.spotify.com/v1/me/player/shuffle?state=' + toggle, {
        statusCode: response.status
      });
      res.redirect('/spotify_get_current');
    })
    .catch(function(err) {
      console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'spotify_next/ -- ERROR: ' + err);
      res.render('ejs/error', {error_msg: err});
    })
  }
  return;
});

/* Save weather data from senseHat to db */
app.post('/weather', function(req, res){

  logResponse('POST', '/weather', res);
  var date = new Date();
  var split = ('' + date).split(' ');
  var timestamp = split[0] + ', ' + split[2] + '-' + split[1] + '-' + split[3] +
                  ' @ ' + split[4] + ' (' + split[5] + ')';
  const weather = new weatherData({
    time : timestamp,
    temperature : req.query.temperature,
    humidity : req.query.humidity
  });

  weather.save(function(err) {
    console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'weather/ -- ERROR: ' + err);
    res.render('ejs/error', {error_msg: err});
  });
  console.log('Weather data have been successfully added to database!');
  return;
});
/*********** END OF REQUEST METHODS **********/

/***** BIND SERVER TO PORT *****/
app.listen(port, function() {
  console.log('Server listening at: ' + homeURI + ' on port: ' + port);
});

/***** UTILITY METHODS *****/
/**
 * Logs the type of request made to an endpoint and its status code.
 * @param {String} type 
 * @param {String} uri 
 * @param {Response} res 
 */
function logResponse(type, uri, res) {
  console.log(type + ' @ ' + uri + ' with response: ' + res.statusCode);
}

/**
 * User has no authentication token for Spotify API
 */
function noAuthToken(res) {
  errorMessages = 'You have not been authorised...try going to the home page to login?';
  res.render('ejs/error', {error_msg: errorMessages});
}
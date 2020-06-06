
/***** DEPENDENCIES *****/
const auth = require('./views/js/auth.js');
const bodyParser = require('body-parser');
const express = require('express');
const https = require('https');
const mongoose = require('mongoose');
const queryString = require('query-string');
const request = require('request');
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
    console.error("\x1b[31m%s\x1b[0m", "Failed to connect to database! Exiting server...");
    console.error("\x1b[31m%s\x1b[0m", err);
    process.exit(1);
  } else {
    console.log("Successfully connected to database!");
  }
});

const weatherSchema = new mongoose.Schema({
  time: String,
  temperature: Number,
  humidity: Number
});

const weatherData = mongoose.model("Weather", weatherSchema);

/***** GLOBAL VARIABLES *****/
const LOGTAG = "Server: /";

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
var spotifyUser = "";
var currentTrack = null;
var errorMessages = [];
var playlist = [];
var recentTracks = [];
var repeat = "";
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
      user : spotifyUser,
      current_track : currentTrack,
      error_msgs : errorMessages,
      playing : spotifyPlaying,
      playlist : playlist,
      recentTracks : recentTracks,
      repeat : repeat,
      shuffle : shuffle,
      weather: weatherObject
    };
    res.render('ejs/index', context);
  }
});

/* Error Page */
app.get('/error', function(req, res) {
  logResponse('GET', '/error', res);
  const context = {
    error_msgs : errorMessages
  };
  res.render('ejs/error', context);
});

/* Spotify Authentication */
app.get('/spotify', function(req, res) {

  logResponse('GET', '/spotify', res);
  const callback = homeURI + "spotify_callback";

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

  var code = req.query.code || null;
  
  // POST to get an access token
  const options = {
    form: {
      code: code,
      // Must be the same redirect URI as one used in /spotify endpoint
      redirect_uri: homeURI + "spotify_callback", 
      grant_type: 'authorization_code',
    },
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(spotifyClientID + ':' + spotifySecretID)
                                  .toString('base64'))
    },
    json: true,
    url: 'https://accounts.spotify.com/api/token'
  };
  request.post(options, function(err, response, body) {
    
    logResponse('POST', options.url, response);
    if (err) {
      console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_callback/ -- ERROR: ' +
                                'Spotify API broke and said: ' + err);
    } else {
      spotifyAccessToken = response.body.access_token;
      spotifyRefreshToken = response.body.refresh_token;

      console.log('\x1b[32m%s\x1b[0m', LOGTAG + "spotify_callback/ -- " +
                                       "Succesfully retrieved access token!");

      res.redirect('/spotify_get_current');
    }
  });
  return;
});

/* Spotify current state and user info */
app.get('/spotify_get_current', function(req, res) {
  
  logResponse('GET', '/spotify_get_current', res);
  // GET Current user info
  var options = {
    url: 'https://api.spotify.com/v1/me',
    headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
    json: true
  };
  
  request.get(options, function(error, response, body) {
    logResponse('GET', options.url, response);
    if (error) {
      console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- WARNING: ');
      console.log(body);
    } else {
      console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- Succesfully logged user.');
      spotifyUser = body;
    }
  });
  
  // GET Current player state
  /* Returns undefined if not using Spotify App on device */
  options = {
    url: 'https://api.spotify.com/v1/me/player',
    headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
    json: true
  };
  
  request.get(options, function(error, response, body) {
    logResponse('GET', options.url, response);
    if (error) {
      console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- WARNING: ' +
                  'Player has returned an invalid result!');
      errorMessages = errorMessages.concat("Player returned null! Are you sure the Spotify app is running?");
    } else {
      console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- ' +
                                       'Succesfully logged player state.');
      
      spotifyPlaying = body.is_playing;

      currentTrack = body.item;
      volume = body.device.volume_percent;
      repeat = body.repeat_state;
      shuffle = body.shuffle_state;
    }
  });

  // GET recently played tracks
  options = {
    url: 'https://api.spotify.com/v1/me/player/recently-played',
    headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
    json: true
  };
  
  request.get(options, function(error, response, body) {
    logResponse('GET', options.url, response);
    if (error) {
      console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- WARNING: ');
      console.log(body);
    } else {
      console.log('\x1b[32m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- ' + 
                                       'Succesfully retrieved recent tracks.');
      
      recentTracks = [];
      if (body.items.length <= 5) {
        body.items.forEach(item => {
          recentTracks = recentTracks.concat(item);
        });
      } else {
        for (var i = 0; i < 5; i ++) {
          recentTracks = recentTracks.concat(body.items[i]);
        }
      }
    }

    res.redirect('/weather');
    return;
  });
});

/* Spotify play */
app.get('/spotify_play', function(req, res) {

  logResponse('PUT', '/spotify_play', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_play -- ' + 'Access token is null');
  } else {
    var options = {
      url: 'https://api.spotify.com/v1/me/player/play',
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // PUT player to play state
    request.put(options, function(error, response, body) {
      logResponse('PUT', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_play/ -- ERROR: ' + error);
      } else {
        res.redirect(homeURI);
      }
    });
  }
  return;
});

/* Spotify pause */
app.get('/spotify_pause', function(req, res) {

  logResponse('PUT', '/spotify_pause', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_pause -- ' + 'Access token is null');
  } else {
    var options = {
      url: 'https://api.spotify.com/v1/me/player/pause',
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // PUT player to pause state
    request.put(options, function(error, response, body) {
      logResponse('PUT', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_pause/ -- ERROR: ' + error);
      } else {
        res.redirect(homeURI);
      }
    });
  }
  return;
});

/* Get weather data */
app.get('/weather', function(req, res) {
  
  logResponse('GET', '/weather', res);
  weatherData.find(function(err, data) {
    if (err) {
      console.error("\x1b[31m%s\x1b[0m", LOGTAG + "weather -- ERROR: " + err);
    } else {

      var playlistID = "";
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
      var options = {
        url: 'https://api.spotify.com/v1/playlists/'.concat(playlistID),
        headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
        json: true
      };
      
      request.get(options, function(error, response, body) {
        logResponse('GET', options.url, response);
        if (error) {
          console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_pause/ -- ERROR: ' + error);
        } else {
          playlist = {
            url : body.external_urls.spotify,
            img : body.images[0].url,
            name : body.name,
            owner : body.owner.display_name
          }
        }
        res.redirect(homeURI);
      });
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
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_next -- ' + 'Access token is null');
  } else {
    var options = {
      url: 'https://api.spotify.com/v1/me/player/next',
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // POST to player to skip track
    request.post(options, function(error, response, body) {
      logResponse('POST', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_next/ -- ERROR: ' + error);
      } else {
        res.redirect('/spotify_get_current');
      }
    });
  }
  return;
});

/* Spotify previous track */
app.post('/spotify_previous', function(req, res) {

  logResponse('POST', '/spotify_previous', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_previous -- ' + 'Access token is null');
  } else {
    var options = {
      url: 'https://api.spotify.com/v1/me/player/previous',
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // POST to player to skip to previous track
    request.post(options, function(error, response, body) {
      logResponse('POST', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_previous/ -- ERROR: ' + error);
      } else {
        res.redirect('/spotify_get_current');
      }
    });
  }
  return;
});

/* Spotify repeat */
app.post('/spotify_repeat', function(req, res) {

  logResponse('POST', '/spotify_repeat', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_repeat -- ' + 'Access token is null');
  } else {

    if ( repeat === "track" || repeat === "context" ) {
      repeat = "off";
    } else {
      repeat = "track";
    }

    var options = {
      url: 'https://api.spotify.com/v1/me/player/repeat?state=' + repeat,
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // PUT player to toggle repeat mode
    request.put(options, function(error, response, body) {
      logResponse('PUT', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_repeat/ -- ERROR: ' + error);
      } else {
        res.redirect('/spotify_get_current');
      }
    });
  }
  return;
});

/* Spotify shuffle */
app.post('/spotify_shuffle', function(req, res) {

  logResponse('POST', '/spotify_shuffle', res);
  if (spotifyAccessToken === null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + '/spotify_shuffle -- ' + 'Access token is null');
  } else {

    var toggle = '';
    if ( shuffle ) {
      toggle = 'false';
    } else {
      toggle = 'true';
    }
    shuffle = !shuffle;

    var options = {
      url: 'https://api.spotify.com/v1/me/player/shuffle?state=' + toggle,
      headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
      json: true
    };

    // PUT player to toggle shuffle mode
    request.put(options, function(error, response, body) {
      logResponse('PUT', options.url, response);
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", LOGTAG + 'spotify_shuffle/ -- ERROR: ' + error);
      } else {
        res.redirect('/spotify_get_current');
      }
    });
  }
  return;
});

/* Save weather data from senseHat to db */
app.post('/weather', function(req, res){

  logResponse('POST', '/weather', res);
  var date = new Date();
  var split = ("" + date).split(" ");
  var timestamp = split[0] + ", " + split[2] + "-" + split[1] + "-" + split[3] +
                  " @ " + split[4] + " (" + split[5] + ")";
  const weather = new weatherData({
    time : timestamp,
    temperature : req.query.temperature,
    humidity : req.query.humidity
  });

  weather.save();
  console.log("Weather data have been successfully added to database!");
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
  console.log(type + " @ " + uri + " with response: " + res.statusCode);
}

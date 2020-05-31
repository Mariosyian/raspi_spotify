
/***** DEPENDENCIES *****/
const auth = require('./views/js/auth.js');
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const request = require('request');
const queryString = require('query-string');
const spotify = require('spotify-web-api-node');
const time = require('./views/js/timestamp.js');

/***** DEPENDENCY VARIABLES *****/
const app = express();
app.set('view engine', 'ejs');

/***** STATIC FILES *****/
app.use('/static', express.static(__dirname + '/views/'));
app.use(bodyParser.urlencoded({extended: true}));

/***** SERVER SETUP *****/
let port = process.env.PORT;
if (port === null || port === "") {
  port = 3000;
}
const homeURI = 'http://localhost:'+port+'/';

const mongoContext = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

const dbUrl = 'mongodb+srv://' + auth.mongoUser + ':' +
              auth.mongoPass + '@raspi-weather-p6zoz.mongodb.net/weather';

mongoose.connect(dbUrl, mongoContext, function(err) {
  if (err) { 
    console.error("Failed to connect to database! Exiting server...");
    console.error(err);
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
var spotifyPlaying = false;

/***** CONTEXT VARIABLES ******/
/* SPOTIFY */
var spotifyUsername = "";
var currentTrackArtists = [];
var currentTrackImage = "";
var currentTrackName = "";
var errorMessages = [];
var recentTracks = [];
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
      username : spotifyUsername,
      current_track_name : currentTrackName,
      current_track_artists : currentTrackArtists,
      current_track_image : currentTrackImage,
      error_msgs : errorMessages,
      recentTracks : recentTracks,
      weather: weatherObject
    };
    res.render('ejs/index', context);
    errorMessages = [];
  }
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
  
  var spotifyAccessTokenOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      // Must be the same redirect URI as one used in /spotify endpoint
      redirect_uri: homeURI + "spotify_callback", 
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(spotifyClientID + ':' + spotifySecretID)
                                  .toString('base64'))
    },
    json: true
  };
  
  // POST to get an access token
  request.post(spotifyAccessTokenOptions, function(err, response, body) {
    
    logResponse('POST', spotifyAccessTokenOptions.url, response);
    if (err) {
      console.error(LOGTAG + 'spotify_callback/ -- ERROR: ' + 'Spotify API broke and said: ' + err);
    } else {
      spotifyAccessToken = response.body.access_token;
      spotifyRefreshToken = response.body.refresh_token;

      console.log(LOGTAG + "spotify_callback/ -- " + "Succesfully retrieved access token!");

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
      console.error(LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log(LOGTAG + 'spotify_get_current/ -- WARNING: ');
      console.log(body);
    } else {
      console.log(LOGTAG + 'spotify_get_current/ -- Succesfully logged user.');
      spotifyUsername = body.display_name;
    }
  });
  
  // GET Current player state -- Has to be using the spotify app on a device else undefined!
  options = {
    url: 'https://api.spotify.com/v1/me/player',
    headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
    json: true
  };
  
  request.get(options, function(error, response, body) {
    logResponse('GET', options.url, response);
    if (error) {
      console.error(LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log(LOGTAG + 'spotify_get_current/ -- WARNING: ' +
                  'Player has returned an invalid result!');
      errorMessages = errorMessages.concat("Player returned null. Are you using the Spotify app?");
    } else {
      console.log(LOGTAG + 'spotify_get_current/ -- ' +
                  'Succesfully logged player state.');
      
      spotifyPlaying = body.is_playing;

      currentTrackImage = body.item.album.images[0].url;
      currentTrackName = body.item.name;
      currentTrackArtists = [];   // Reset list for new track
      body.item.artists.forEach(artist => {
        currentTrackArtists.push(artist.name);
      });
      volume = body.device.volume_percent;
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
      console.error(LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else if (response.statusCode !== 200) {
      console.log(LOGTAG + 'spotify_get_current/ -- WARNING: ');
      console.log(body);
    } else {
      console.log(LOGTAG + 'spotify_get_current/ -- Succesfully retrieved recent tracks.');
      
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

    res.redirect(homeURI);
    return;
  });
});

/* Spotify play */
app.get('/spotify_play', function(req, res) {

  logResponse('PUT', '/spotify_play', res);
  if (spotifyAccessToken === null) {
    console.log(LOGTAG + '/spotify_play -- ' + 'Access token is null');
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
        console.error(LOGTAG + 'spotify_play/ -- ERROR: ' + error);
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
    console.log(LOGTAG + '/spotify_pause -- ' + 'Access token is null');
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
        console.error(LOGTAG + 'spotify_pause/ -- ERROR: ' + error);
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
      console.error(LOGTAG + "weather -- ERROR: " + err);
    } else {

      weatherObject = [];
      // Last entry in database is latest timestamp
      if (data.length <= 5) {
        for (var i = data.length - 1; i >= 0; i --) {
          weatherObject = weatherObject.concat(data[i]);
        }
      } else {
        for (var i = 4; i >= 0; i --) {
          weatherObject = weatherObject.concat(data[i]);
        }
      }
      res.redirect(homeURI);
    }
  });
  return;
});

/***** POST REQUESTS *****/
/* Spotify Play/Pause */
app.post('/spotify_play_pause', function(req, res) {

  logResponse('GET', '/spotify_play_pause', res);
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

  logResponse('GET', '/spotify_next', res);
  if (spotifyAccessToken === null) {
    console.log(LOGTAG + '/spotify_next -- ' + 'Access token is null');
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
        console.error(LOGTAG + 'spotify_next/ -- ERROR: ' + error);
      } else {
        res.redirect('/spotify_get_current');
      }
    });
  }
  return;
});

/* Spotify previous track */
app.post('/spotify_previous', function(req, res) {

  logResponse('GET', '/spotify_previous', res);
  if (spotifyAccessToken === null) {
    console.log(LOGTAG + '/spotify_previous -- ' + 'Access token is null');
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
        console.error(LOGTAG + 'spotify_previous/ -- ERROR: ' + error);
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
  const weather = new weatherData({
    time : time.timestamp,
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
  console.log('Server listening at ' + homeURI + ' on port: ' + port);
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


/***** DEPENDENCIES *****/
const auth = require('./views/js/auth.js');
const express = require('express');
const request = require('request');
const queryString = require('query-string');
const spotify = require('spotify-web-api-node');

/***** DEPENDENCY VARIABLES *****/
const app = express();
app.set('view engine', 'ejs');

/***** GLOBAL VARIABLES *****/
const hostname = 'localhost'
const port = 3000;
const homeURI = 'http://' + hostname + ':' + port + '/';

const LOGTAG = "Server: /";

const spotifyClientID = auth.spotifyClientID;
const spotifySecretID = auth.spotifySecretID;
const spotifyUserID = auth.spotifyUserID;

var spotifyAccessToken = null;
var spotifyRefreshToken = null;
var spotifyPlaying = false;

/* SPOTIFY CONTEXT VARIABLES */
var spotifyUsername = "";
var currentTrackArtists = [];
var currentTrackImage = "";
var currentTrackName = "";
/***** STATIC FILES *****/
app.use('/static', express.static(__dirname + '/views/'));

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
      current_track_image : currentTrackImage
    };
    res.render('ejs/index', context);
  }
});

/* Spotify Authentication */
app.get('/spotify', function(req, res) {

  logResponse('GET', '/spotify', res);
  const callback = homeURI + "spotify_callback";

  var scopes = 'user-modify-playback-state user-read-email ' +
               'user-read-playback-state user-read-private ' +
               'user-read-recently-played user-read-currently-playing ';
  var url = 'https://accounts.spotify.com/authorize?' +
            queryString.stringify({
              response_type: 'code',
              client_id: spotifyClientID,
              scope: scopes,
              redirect_uri: callback
            });
  res.redirect(url);
  console.log(LOGTAG + 'spotify/ -- ' + 'Spotify callback redirected to --> ' + callback);
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
});

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
  
  // GET Current player state
  request.get(options, function(error, response, body) {
    logResponse('GET', options.url, response);
    if (error) {
      console.error(LOGTAG + 'spotify_get_current/ -- ERROR: ' + error);
    } else {
      if (response.statusCode !== 200) {
        console.log(LOGTAG + 'spotify_get_current/ -- WARNING: ' +
                    'Player has returned an invalid result!');
        console.log(body);
      } else {
        console.log(LOGTAG + 'spotify_get_current/ -- ' +
                    'Succesfully logged player state.');
        
        spotifyPlaying = body.is_playing;
        // Set context vars
        currentTrackImage = body.item.album.images[0].url;
        currentTrackName = body.item.name;
        currentTrackArtists = []; // Reset artists to empty list
        body.item.artists.forEach(artist => {
          currentTrackArtists.push(artist.name);
        });
      }
      res.redirect(homeURI);
    }
  });
});
/* Spotify Play/Pause */
/* Spotify Authentication */
app.get('/spotify_play_pause', function(req, res) {

  logResponse('GET', '/spotify_play_pause', res);
  if (spotifyPlaying) {
    res.redirect('/spotify_pause');
    spotifyPlaying = false;
  } else {
    res.redirect('/spotify_play');
    spotifyPlaying = true;
  }
});

/* Spotify play */
app.get("/spotify_play", function(req, res) {

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
});

/* Spotify pause */
app.get("/spotify_pause", function(req, res) {

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
});

/* Spotify skip track */
app.get("/spotify_next", function(req, res) {

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
});

/* Spotify pause */
app.get("/spotify_previous", function(req, res) {

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
});

/***** BIND SERVER TO PORT *****/
app.listen(port, function() {
  console.log('Server listening at ' + homeURI);
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

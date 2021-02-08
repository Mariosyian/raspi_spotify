
/***** DEPENDENCIES *****/
const axios = require('axios').default;
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
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
const port = process.env.PORT || 3000;
const homeURI = process.env.HOME_URI || 'http://localhost:' + port + '/';

const mongoContext = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

const dbUrl = process.env.MONGO_URL;

mongoose.connect(dbUrl, mongoContext, function(err) {
  if (err) { 
    console.error('\x1b[31m%s\x1b[0m', 'Failed to connect to database! Exiting server...');
    console.error('\x1b[31m%s\x1b[0m', err);
    process.exit(1);
  } else {
    console.log('Successfully connected to database!');
  }
});

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

const weatherSchema = new mongoose.Schema({
  time: String,
  temperature: Number,
  humidity: Number,
});

const User = mongoose.model('User', userSchema);
const weatherData = mongoose.model('Weather', weatherSchema);
// Require here as it makes use of Weather model
// const openWeather = require(__dirname + '/views/js/openWeather');

/***** GLOBAL VARIABLES *****/
const LOGTAG = 'Server: /';

const spotifyClientID = process.env.SPOTIFY_CLIENT_ID;
const spotifySecretID = process.env.SPOTIFY_SECRET_ID;
const spotifyUserID = process.env.SPOTIFY_USER_ID;

var spotifyAccessToken = null;
var spotifyRefreshToken = null;

var userAuthenticated = false;

/***** SPOTIFY PLAYLISTS ******/
const sunny = [
  '37i9dQZF1DX843Qf4lrFtZ', // Young, Wild & Free
  '37i9dQZF1DX1H4LbvY4OJi', // Happy pop
  '37i9dQZF1DXeby79pVadGa', // Get Home Happy!
  '37i9dQZF1DXbtuVQL4zoey', // Sunny Beats
  '69pkbBraIGFlJOi21CEN80', // Sunny Music 2020 Chill Songs
]

const rainy = [
  '37i9dQZF1DXaw68inx4UiN', // Sounds of the rainforest
  '37i9dQZF1DX4PP3DA4J0N8', // Nature Sounds
  '37i9dQZF1DX4aYNO8X5RpR', // Nightstorms
  '3Jk5Y4eumHuQ3ai8nvGFDZ', // RAIN LOFI // Rainy chilled HipHop Beats
  '4eWBwGl0c5wtp6k5Krp6My', // Lo-Fi Rain | Rainy Lofi
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
var weatherObject = [];

/***** GET REQUESTS *****/
/* Home Page */
app.get('/', function(req, res) {
  logResponse('GET', '/', res);
  if (userAuthenticated) {
    if (spotifyAccessToken == null) {
      res.redirect('/spotify');
      return;
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
        weather: weatherObject,
      };
      res.render('ejs/index', context);
      return;
    }
  }
  res.redirect('/register');
});

/* Error Page */
app.get('/error', function(req, res) {
  logResponse('GET', '/error', res);
  const context = {
    error_msg : errorMessages,
  };
  res.render('ejs/error', context);
});

/* Login / Register / Logout */
app.get('/login', function(req, res) {
  logResponse('GET', '/login', res);
  res.render('ejs/login');
});

app.get('/register', function(req, res) {
  logResponse('GET', '/register', res);
  res.render('ejs/register');
});

app.post('/login', function(req, res) {
  logResponse('POST', '/login', res);
  const username = req.body.username;
  const password = req.body.password;
  User.find({$and: [{ username: username }, { password: password }]}, function(err, user) {
    if (err) {
      console.err(err);
    } else if (user.length == 1) {
      console.log('Succesful login');
      userAuthenticated = true;
    } else {
      console.log('Unsuccesful login attempt.');
    }
  }).then(function() {
    res.redirect('/');
  });
});

app.post('/register', function(req, res) {
  logResponse('POST', '/register', res);
  const username = req.body.username;
  const email = req.body.email;
  User.find({$or: [{ username: username }, { email: email }]}, function(err, user) {
    if (err) {
      console.err(err);
    } else if (user.length == 1) {
      console.log('User with this username or email already exists.');
    } else {
      const newUser = new User({
        username: username,
        email: email,
        password: req.body.password,
      });
      newUser.save(function(err) {
        if (err) {
          console.err(err);
        } else {
          console.log('User ' + username + ' was successfully created!');
        }
      });
    }
  }).then(function() {
    res.redirect('/register');
  });
});

app.get('/logout', function(req, res) {
  spotifyAccessToken = null;
  userAuthenticated = false;
  res.redirect('https://www.spotify.com/logout/');
});

/* Spotify Authentication */
app.get('/spotify', function(req, res) {
  logResponse('GET', '/spotify', res);
  const callback = homeURI + 'spotify_callback';
  let scopes = 'user-modify-playback-state user-read-email ' +
               'user-read-playback-state user-read-private ' +
               'user-read-recently-played user-read-currently-playing ' +
               'user-modify-playback-state';
  let url = 'https://accounts.spotify.com/authorize?' +
            queryString.stringify({
              response_type: 'code',
              client_id: spotifyClientID,
              scope: scopes,
              redirect_uri: callback,
              show_dialog: false,
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
  if (code == null) {
    console.error('\x1b[31m%s\x1b[0m', LOGTAG + 'Code returned null from authorisation endpoint');
    errorMessages = 'Something went wrong during Spotify callback...Try again';
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
      redirect_uri: homeURI + 'spotify_callback',
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    auth: {
      username: spotifyClientID,
      password: spotifySecretID,
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
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_get_current/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    // GET Current user info
    axios({
      url: 'https://api.spotify.com/v1/me',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
        'Authorization': 'Bearer ' + spotifyAccessToken,
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

        // TODO: Volume
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
    // TODO: Get player devices
    // GET recently played tracks
    axios({
      url: 'https://api.spotify.com/v1/me/player/recently-played',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
        // TODO: Pressing on a recent track should play it, not just visit the page??
        recentTracks = [];
        if (response.data.items.length <= 5) {
          response.data.items.forEach(item => {
            recentTracks = recentTracks.concat(item);
          });
        } else {
          for (let i = 0; i < 5; i ++) {
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
  logResponse('GET', '/spotify_play', res);
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_play/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    axios({
      url: 'https://api.spotify.com/v1/me/player/play',
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
  logResponse('GET', '/spotify_pause', res);
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_pause/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    axios({
      url: 'https://api.spotify.com/v1/me/player/pause',
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
      let playlistID = '';
      let randomIndex = 0;
      weatherObject = [];

      // Last entry in database is latest timestamp so take data in reverse.
      if (data.length <= 5) {
        for (let i = data.length - 1; i >= 0; i --) {
          weatherObject = weatherObject.concat(data[i]);
        }
      } else {
        let counter = 0;
        for (let i = data.length - 1; counter < 5; i --) {
          weatherObject = weatherObject.concat(data[i]);
          counter ++;
        }
      }

      // Decide which playlist to send based on readings
      if ( weatherObject[0].temperature >= 10 && weatherObject[0].humidity <= 76) {
        randomIndex = Math.round(Math.random() * sunny.length);
        playlistID = sunny[randomIndex];
      } else {
        randomIndex = Math.round(Math.random() * rainy.length);
        playlistID = rainy[randomIndex];
      }

      // GET playlist information
      axios({
        url: 'https://api.spotify.com/v1/playlists/'.concat(playlistID),
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + spotifyAccessToken,
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
          owner : body.owner.display_name,
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
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_next/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    axios({
      url: 'https://api.spotify.com/v1/me/player/next',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_previous/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {
    axios({
      url: 'https://api.spotify.com/v1/me/player/previous',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
// TODO: Spamming the repeat button can result in 4xx as API response doesn't arrive in time
app.post('/spotify_repeat', function(req, res) {
  logResponse('POST', '/spotify_repeat', res);
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_repeat/ -- ' + 'Access token is null');
    noAuthToken(res);
  } else {

    if ( repeat === 'context' ) {
      repeat = 'track';
    } else if ( repeat === 'track' ) {
      repeat = 'off';
    } else {
      repeat = 'context';
    }

    axios({
      url: 'https://api.spotify.com/v1/me/player/repeat?state=' + repeat,
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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
  if (spotifyAccessToken == null) {
    console.log('\x1b[33m%s\x1b[0m', LOGTAG + 'spotify_shuffle/ -- ' + 'Access token is null');noAuthToken(res);
  } else {

    let toggle = '';
    if ( shuffle ) {
      toggle = 'false';
    } else {
      toggle = 'true';
    }
    shuffle = !shuffle;

    axios({
      url: 'https://api.spotify.com/v1/me/player/shuffle?state=' + toggle,
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + spotifyAccessToken,
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

/**
 * Save weather data from OpenWeatherAPI to DB
 */
// setInterval(function() {
//   openWeather.postWeatherAPI();
// }, 1000 * 60 * 30);

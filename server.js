
/***** DEPENDENCIES *****/
const axios = require("axios").default;
const bodyParser = require("body-parser");
const dotenv = require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const queryString = require("query-string");
const session = require("express-session");
const spotify = require("spotify-web-api-node");

/***** DEPENDENCY VARIABLES *****/
const app = express();
app.set("view engine", "ejs");

/***** STATIC FILES *****/
app.use("/static", express.static(__dirname + "/views/"));
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(passport.initialize());
app.use(passport.session());

/***** SERVER SETUP *****/
const port = process.env.PORT || 3000;
const homeURI = process.env.HOME_URI || "http://localhost:" + port + "/";

const mongoContext = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};
const dbUrl = process.env.MONGO_URL;

mongoose.connect(dbUrl, mongoContext, (err) => {
  if (err) { 
    console.error("Failed to connect to database! Exiting server..." + err.message);
    process.exit(1);
  } else {
    console.log("Successfully connected to database!");
  }
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});
userSchema.plugin(passportLocalMongoose);

const weatherSchema = new mongoose.Schema({
  time: String,
  temperature: Number,
  humidity: Number,
});

const User = mongoose.model("User", userSchema);
// Add user session
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const weatherData = mongoose.model("Weather", weatherSchema);
// Require here as it makes use of Weather model
// const openWeather = require(__dirname + "/views/js/openWeather");

/***** GLOBAL VARIABLES *****/
const spotifyClientID = process.env.SPOTIFY_CLIENT_ID;
const spotifySecretID = process.env.SPOTIFY_SECRET_ID;
const spotifyUserID = process.env.SPOTIFY_USER_ID;

var spotifyAccessToken = null;
var spotifyRefreshToken = null;

/***** SPOTIFY PLAYLISTS ******/
const sunny = [
  "37i9dQZF1DX843Qf4lrFtZ", // Young, Wild & Free
  "37i9dQZF1DX1H4LbvY4OJi", // Happy pop
  "37i9dQZF1DXeby79pVadGa", // Get Home Happy!
  "37i9dQZF1DXbtuVQL4zoey", // Sunny Beats
  "69pkbBraIGFlJOi21CEN80", // Sunny Music 2020 Chill Songs
]

const rainy = [
  "37i9dQZF1DXaw68inx4UiN", // Sounds of the rainforest
  "37i9dQZF1DX4PP3DA4J0N8", // Nature Sounds
  "37i9dQZF1DX4aYNO8X5RpR", // Nightstorms
  "3Jk5Y4eumHuQ3ai8nvGFDZ", // RAIN LOFI // Rainy chilled HipHop Beats
  "4eWBwGl0c5wtp6k5Krp6My", // Lo-Fi Rain | Rainy Lofi
]

/***** CONTEXT VARIABLES ******/
/* SPOTIFY */
var spotifyUser = "";
var currentDevice = null;
var currentTrack = null;
var errorMessages = "";
var playlist = [];
var recentTracks = [];
var repeat = "";
var shuffle = false;
var spotifyPlaying = false;
/* WEATHER */
var weatherObject = [];

/***** GET REQUESTS *****/
/* Home Page */
app.get("/", (req, res) => {
  logResponse(res);
  if (req.isAuthenticated()) {
    if (spotifyAccessToken == null) {
      res.redirect("/spotify");
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
      res.render("ejs/index", context);
      return;
    }
  }
  res.redirect("/register");
});

/* Error Page */
app.get("/error", (req, res) => {
  logResponse(res);
  const context = {
    error_msg : errorMessages,
  };
  res.render("ejs/error", context);
});

/* Login / Register / Logout */
app.get("/login", (req, res) => {
  logResponse(res);
  res.render("ejs/login")
});

app.get("/register", (req, res) => {
  logResponse(res);
  res.render("ejs/register")
});

app.post("/login", (req, res) => {
  logResponse(res);
  const user = new User({
    username: req.body.username.trim(),
    password: req.body.password,
  })
  req.login(user, (err) => {
    if (err) {
      console.error(err);
    } else {
      res.redirect("/");
    }
  })
});

app.post("/register", (req, res) => {
  logResponse(res);
  User.register({ username: req.body.username.trim() }, req.body.password,  (err, user) => {
    if (err) {
      console.error(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/");
      })
    }
  });
});

app.get("/logout", (req, res) => {
  logResponse(res);
  spotifyAccessToken = null;
  res.redirect("https://www.spotify.com/logout/");
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
  const user = new User({
    username: req.body.username.trim(),
    password: req.body.password,
  });
  req.login(user, function(err) {
    if (err) {
      console.error(err);
    } else {
      res.redirect('/');
    }
  })
});

app.post('/register', function(req, res) {
  logResponse('POST', '/register', res);
  User.register({ username: req.body.username.trim() }, req.body.password, function (err, user) {
    if (err) {
      console.error(err);
    } else {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/');
      });
    }
  });
});

app.get('/logout', function(req, res) {
  spotifyAccessToken = null;
  res.redirect('https://www.spotify.com/logout/');
});

/* Spotify Authentication */
app.get("/spotify", (req, res) => {
  logResponse(res);
  const callback = homeURI + "spotify_callback";
  let scopes = "user-modify-playback-state user-read-email " +
               "user-read-playback-state user-read-private " +
               "user-read-recently-played user-read-currently-playing " +
               "user-modify-playback-state";
  let url = "https://accounts.spotify.com/authorize?" +
            queryString.stringify({
              response_type: "code",
              client_id: spotifyClientID,
              scope: scopes,
              redirect_uri: callback,
              show_dialog: false,
            });
  res.redirect(url);
  console.log("spotify/ -- " + "Spotify callback redirected to --> " + callback);
  return;
})

/*
 * Spotify Authentication Callback
 * Used as redirect uri to obtain auth_token
 */
app.get("/spotify_callback", (req, res) => {
  logResponse(res);
  const code = req.query.code || null;
  if (code == null) {
    console.error("Code returned null from authorisation endpoint");
    errorMessages = "Something went wrong during Spotify callback...Try again";
    res.render("ejs/error", {error_msg: errorMessages});
    return;
  }
  // POST to get an access token
  axios({
    url: "https://accounts.spotify.com/api/token",
    method: "POST",
    params: {
      code: code,
      grant_type: "authorization_code",
      redirect_uri: homeURI + "spotify_callback",
    },
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    auth: {
      username: spotifyClientID,
      password: spotifySecretID,
    }
  })
  .then((response) => {
    spotifyAccessToken = response.data.access_token;
    spotifyRefreshToken = response.data.refresh_token;
    console.log("spotify_callback/ -- Succesfully retrieved access token!");
    res.redirect("/spotify_get_current");
  })
  .catch((err) => {
    console.error("spotify_callback/ -- ERROR: " + err.message);
    res.render("ejs/error", {error_msg: err});
  });
  return;
})

/* Spotify current state and user info */
app.get("/spotify_get_current", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_get_current/ -- Access token is null");
    noAuthToken(res);
  } else {
    // GET Current user info
    axios({
      url: "https://api.spotify.com/v1/me",
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      if (response.status !== 200) {
        console.log("spotify_get_current/me -- WARNING: ", response);
      } else {
        console.log("spotify_get_current/me -- Succesfully logged user.");
        spotifyUser = response.data;
      }
    })
    .catch((err) => {
      console.error("spotify_get_current/me -- ERROR: " + err.message)
      res.render("ejs/error", {error_msg: err})
    });
    // GET Current player state
    /* Returns undefined if not using Spotify App on device */
    axios({
      url: "https://api.spotify.com/v1/me/player",
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      if (response.status !== 200) {
        console.log("spotify_get_current/player -- WARNING: Player has returned an invalid result!");
      } else {
        console.log("spotify_get_current/player -- Succesfully logged player state.");
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
    .catch((err) => {
      console.error("spotify_get_current/player -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
    // TODO: Get player devices
    // GET recently played tracks
    axios({
      url: "https://api.spotify.com/v1/me/player/recently-played",
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      if (response.status !== 200) {
        console.log("spotify_get_current/recently-played -- WARNING: ", response);
      } else {
        console.log("spotify_get_current/recently-played -- Succesfully retrieved recent tracks.");
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
      res.redirect("/weather");
    })
    .catch((err) => {
      console.error("spotify_get_current/recently-played -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Spotify play */
app.get("/spotify_play", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_play/ -- " + "Access token is null");
    noAuthToken(res);
  } else {
    axios({
      url: "https://api.spotify.com/v1/me/player/play",
      method: "PUT",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect(homeURI);
    })
    .catch((err) => {
      console.error("spotify_play/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Spotify pause */
app.get("/spotify_pause", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_pause/ -- Access token is null");
    noAuthToken(res);
  } else {
    axios({
      url: "https://api.spotify.com/v1/me/player/pause",
      method: "PUT",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect(homeURI);
    })
    .catch((err) => {
      console.error("spotify_pause/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Get weather data */
app.get("/weather", (req, res) => {
  logResponse(res);
  weatherData.find((err, data) => {
    if (err) {
      console.error("weather/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    } else {
      let playlistID = "";
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
      if (weatherObject[0].temperature >= 10 && weatherObject[0].humidity <= 76) {
        randomIndex = Math.round(Math.random() * sunny.length);
        playlistID = sunny[randomIndex];
      } else {
        randomIndex = Math.round(Math.random() * rainy.length);
        playlistID = rainy[randomIndex];
      }

      // GET playlist information
      axios({
        url: "https://api.spotify.com/v1/playlists/".concat(playlistID),
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": "Bearer " + spotifyAccessToken,
        }
      })
      .then((response) => {
        const body = response.data;
        playlist = {
          url : body.external_urls.spotify,
          img : body.images[0].url,
          name : body.name,
          owner : body.owner.display_name,
        }
        res.redirect(homeURI);
      })
      .catch((err) => {
        console.error("weather/playlists/ -- ERROR: " + err.message);
        res.render("ejs/error", {error_msg: err});
      });
    }
  });
  return;
});

/***** POST REQUESTS *****/
/* Spotify Play/Pause */
app.post("/spotify_play_pause", (req, res) => {
  logResponse(res);
  if (spotifyPlaying) {
    res.redirect("/spotify_pause");
    spotifyPlaying = false;
  } else {
    res.redirect("/spotify_play");
    spotifyPlaying = true;
  }
  return;
});

/* Spotify skip track */
app.post("/spotify_next", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_next/ -- Access token is null");
    noAuthToken(res);
  } else {
    axios({
      url: "https://api.spotify.com/v1/me/player/next",
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect("/spotify_get_current");
    })
    .catch((err) => {
      console.error("spotify_next/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Spotify previous track */
app.post("/spotify_previous", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_previous/ -- Access token is null");
    noAuthToken(res);
  } else {
    axios({
      url: "https://api.spotify.com/v1/me/player/previous",
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect("/spotify_get_current");
    })
    .catch((err) => {
      console.error("spotify_previous/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Spotify repeat */
// TODO: Spamming the repeat button can result in 4xx as API response doesn"t arrive in time
app.post("/spotify_repeat", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_repeat/ -- Access token is null");
    noAuthToken(res);
  } else {

    if ( repeat === "context" ) {
      repeat = "track";
    } else if ( repeat === "track" ) {
      repeat = "off";
    } else {
      repeat = "context";
    }

    axios({
      url: "https://api.spotify.com/v1/me/player/repeat?state=" + repeat,
      method: "PUT",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect("/spotify_get_current");
    })
    .catch((err) => {
      console.error("spotify_next/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});

/* Spotify shuffle */
app.post("/spotify_shuffle", (req, res) => {
  logResponse(res);
  if (spotifyAccessToken == null) {
    console.log("spotify_shuffle/ -- Access token is null");
    noAuthToken(res);
  } else {

    let toggle = "";
    if ( shuffle ) {
      toggle = "false";
    } else {
      toggle = "true";
    }
    shuffle = !shuffle;

    axios({
      url: "https://api.spotify.com/v1/me/player/shuffle?state=" + toggle,
      method: "PUT",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer " + spotifyAccessToken,
      }
    })
    .then((response) => {
      res.redirect("/spotify_get_current");
    })
    .catch((err) => {
      console.error("spotify_next/ -- ERROR: " + err.message);
      res.render("ejs/error", {error_msg: err});
    });
  }
  return;
});
/*********** END OF REQUEST METHODS **********/

/***** BIND SERVER TO PORT *****/
app.listen(port, () => {
  console.log("Server listening at: " + homeURI + " on port: " + port);
})

/***** UTILITY METHODS *****/
/**
 * Logs the type of request made to an endpoint and its status code.
 * @param {String} type 
 * @param {String} uri 
 * @param {Response} res 
 */
function logResponse(res) {
  console.log(res.req.method + " @ "
    + res.req.url + " with response: "
    + res.statusCode
  );
}

/**
 * User has no authentication token for Spotify API
 */
function noAuthToken(res) {
  errorMessages = "You have not been authorised...try going to the home page to login?";
  res.render("ejs/error", {error_msg: errorMessages});
}

/**
 * Save weather data from OpenWeatherAPI to DB
 */
// setInterval(() => {
//   openWeather.postWeatherAPI();
// }, 1000 * 60 * 30);

# About:
This project is for use as a personal hobby and to further explore use of databases, web development and the Python programming language. This project is open-source, so feel free to fork this repository and make it your own.

# Requirements (Alphabetically):
* Axios -- Version Used: v0.19.2
* Body-Parser -- Version Used: v1.19.0
* Dotenv -- Version Used: v8.2.0
* EJS -- Version Used: v3.1.5
* Express -- Version Used: v4.17.1
* Mongoose -- Version Used: v5.10.7
* Node.js -- Version Used: v12.16.3
* Nodemon -- Version Used: v2.0.4
* NPM -- Version Used: v6.14.4
* Query-String -- Version Used: v6.13.5
* Spotify-Web-Api-Node -- Version Used: v4.0.0

# Usage:
**NOTE:** All API Keys and other sensitive information is kept inside a `.env` file.

Navigate to the root directory
```
npm install
node server.js
```

# Project Idea:
Create a RaspberryPi program that will make use of the SenseHAT extension, in order to take weather readings such as temperature and humidity. These readings will work along the Spotify API to form a RaspberryPi Spotify Web Server, that plays different playlists, based on weather conditions.

This project is in very early stages so no screenshots or data exist. Hopefully this gets filled out with time.

01/06/2020: Deployed using Heroku service: https://raspi-spotify.herokuapp.com/

# Implementation:
## Spotify:
* Use of Spotify API
  * Allow for play / pause track
  * View currently playing track
  * Skip to previous / next track
  * Toggle repeat between off / context / track
  * Will append for:
    * volume control -- Spotify currently allows only for Desktop client support
    * device switching

## Weather Logging:
* <strike>Use of SenseHAT</strike> OpenWeather API for data gathering
* MongoDB for data storage and access
* <strike>Python and BeautifulSoup requests library to send data into website as live test</strike>

## WebPage:
* CSS and Bootstrap Framework for styling
* EJS for HTML templates (View Model)
* Heroku WebService to host NodeJS application online
* HTML for creating the page
* MongoDB and Mongoose framework for data storage
* Node.js and Express for back-end

# About:
This project is for use as a personal hobby and to further explore use of databases, web development and the Python programming language. This project is open-source, so feel free to fork this repository and make it your own.

# Requirements (Alphabetically):
* Axios -- Version Used: v0.19.2
* Body-Parser -- Version Used: v1.19.0
* EJS -- Version Used: v3.1.3
* Express -- Version Used: v4.17.1
* Mongoose -- Version Used: v5.9.16
* Node.js -- Version Used: v12.16.3
* Nodemon -- Version Used: v2.0.4
* NPM -- Version Used: v6.14.4
* Query-String -- Version Used: v6.12.1
* Spotify-Web-Api-Node -- Version Used: v4.0.0

# Usage:
**NOTE:** You will need to create an auth.js where I kept all API Keys / User credentials for security.
I keep mine in the views/js directory (views/js/auth.js is already added in gitignore file).

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
  * Allow for play / pause / skip
  * View currently playing track
  * Will append for:
    * previous / next track
    * volume control -- Spotify currently allows only for Desktop client support
    * device switching

## Weather Logging:
* Use of SenseHAT for data gathering
* MongoDB for data storage and access
* Python and <strike>BeautifulSoup</strike> requests library to send data into website as live test

## WebPage:
* CSS and Bootstrap Framework for styling
* EJS for HTML templates (View Model)
* Heroku WebService to host NodeJS application online
* HTML for creating the page
* MongoDB and Mongoose framework for database
* Node.js and Express for server-side coding

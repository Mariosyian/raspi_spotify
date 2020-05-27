from bs4 import BeautifulSoup
from datetime import datetime
from sense_hat import SenseHat

import requests
import time

sense = SenseHat()

# Repeat every 10 seconds
while True:
  # GET the website
  requests.get('../index.html')
  
  # load the file
  html = open("../index.html").read()
  soup = BeautifulSoup(html, "html.parser")

  # get sensor data
  temp = round(sense.get_temperature(), 2)
  humidity = round(sense.get_humidity(), 2)

  # find html elements
  time_td = soup.find(id="time")
  temp_td = soup.find(id="temp")
  humidity_td = soup.find(id="humidity")

  # rewrite content into tags
  time_td.string = datetime.now()
  temp_td.string = str(temp)
  humidity_td.string = str(humidity)

  # write back to file
  with open("../index.html", "w") as file:
    file.write(str(soup))

  time.sleep(10)
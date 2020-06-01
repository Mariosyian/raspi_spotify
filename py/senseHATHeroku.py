from datetime import datetime
from sense_hat import SenseHat

import requests
import time

sense = SenseHat()
url = "https://raspi-spotify.herokuapp.com/weather"

# Repeat every 3600 seconds (1 hour)
while True:
  # get sensor data
  temp = round(sense.get_temperature(), 2)
  humidity = round(sense.get_humidity(), 2)

  data = {'temperature' : temp, 'humidity' : humidity}
  requests.post(url = url, params = data)
  print('Sent request @ ', datetime.now())
  time.sleep(3600)

from datetime import datetime
from sense_hat import SenseHat

import requests
import time

sense = SenseHat()
url = "http://localhost:3000/weather"

# Repeat every 10 seconds
while True:
  # get sensor data
  temp = round(sense.get_temperature(), 2)
  humidity = round(sense.get_humidity(), 2)

  data = {'temperature' : temp, 'humidity' : humidity}
  requests.post(url = url, params = data)
  print('Sent request @ ', datetime.now())
  time.sleep(10)
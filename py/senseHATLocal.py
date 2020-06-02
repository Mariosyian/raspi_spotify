from datetime import datetime
from sense_hat import SenseHat

import requests
import time

# Set colors
e = (0, 0, 0)
w = (255, 255, 255)
r = (255, 0, 0)     # temperature
g = (0, 255, 0)     # pressure
b = (0, 0, 255)     # humidity

# Set matrix of colors
data = [
  # Temperature
e, e, e, e, e, e, e, e,
e, e, e, e, e, e, e, e,
e, e, e, e, e, e, e, e,
  # Humidity
e, e, e, e, e, e, e, e,
e, e, e, e, e, e, e, e,
e, e, e, e, e, e, e, e,
  # Pressure
e, e, e, e, e, e, e, e,
e, e, e, e, e, e, e, e
]

def get_temp_bar():
  t = []
  if 0.0 <= temp and temp <= 5.0:
    t = [
      r, e, e, e, e, e, e, e,
      r, e, e, e, e, e, e, e,
      r, e, e, e, e, e, e, e
    ]
  elif 5.0 < temp and temp <= 10.0:
    t = [
      r, r, e, e, e, e, e, e,
      r, r, e, e, e, e, e, e,
      r, r, e, e, e, e, e, e
    ]
  elif 10.0 < temp and temp <= 15.0:
    t = [
      r, r, r, e, e, e, e, e,
      r, r, r, e, e, e, e, e,
      r, r, r, e, e, e, e, e
    ]
  elif 15.0 < temp and temp <= 20.0:
    t = [
      r, r, r, r, e, e, e, e,
      r, r, r, r, e, e, e, e,
      r, r, r, r, e, e, e, e
    ]
  elif 20.0 < temp and temp <= 25.0:
    t = [
      r, r, r, r, r, e, e, e,
      r, r, r, r, r, e, e, e,
      r, r, r, r, r, e, e, e
    ]
  elif 25.0 < temp and temp <= 30.0:
    t = [
      r, r, r, r, r, r, e, e,
      r, r, r, r, r, r, e, e,
      r, r, r, r, r, r, e, e
    ]
  elif 30.0 < temp and temp <= 35.0:
    t = [
      r, r, r, r, r, r, r, e,
      r, r, r, r, r, r, r, e,
      r, r, r, r, r, r, r, e
    ]
  elif 35.0 < temp and temp <= 40.0:
    t = [
      r, r, r, r, r, r, r, r,
      r, r, r, r, r, r, r, r,
      r, r, r, r, r, r, r, r
    ]
  else:
    t = [
      r, r, r, r, r, r, r, r,
      r, r, r, r, r, r, r, r,
      r, r, r, r, r, r, r, r
    ]
  
  return t

def get_humi_bar():
  h = []
  if 0.0 <= humidity and humidity <= 10.0:
    h = [
      b, e, e, e, e, e, e, e,
      b, e, e, e, e, e, e, e,
      b, e, e, e, e, e, e, e
    ]
  elif 10.0 < humidity and humidity <= 20.0:
    h = [
      b, b, b, e, e, e, e, e,
      b, b, b, e, e, e, e, e,
      b, b, b, e, e, e, e, e
    ]
  elif 20.0 < humidity and humidity <= 30.0:
    h = [
      b, b, b, b, b, e, e, e,
      b, b, b, b, b, e, e, e,
      b, b, b, b, b, e, e, e
    ]
  elif 30.0 < humidity and humidity <= 40.0:
    h = [
      b, b, b, b, b, b, b, e,
      b, b, b, b, b, b, b, e,
      b, b, b, b, b, b, b, e
    ]
  else:
    h = [
      b, b, b, b, b, b, b, b,
      b, b, b, b, b, b, b, b,
      b, b, b, b, b, b, b, b
    ]
  
  return h

def get_press_bar():
  t = []
  if 0 <= pressure and pressure <= 300.0:
    p = [
      g, e, e, e, e, e, e, e,
      g, e, e, e, e, e, e, e
    ]
  elif 300.0 < pressure and pressure <= 600.0:
    p = [
      g, g, g, e, e, e, e, e,
      g, g, g, e, e, e, e, e
    ]
  elif 600.0 < pressure and pressure <= 900.0:
    p = [
      g, g, g, g, g, e, e, e,
      g, g, g, g, g, e, e, e
    ]
  elif 600.0 < pressure and pressure <= 1200.0:
    p = [
      g, g, g, g, g, g, g, e,
      g, g, g, g, g, g, g, e
    ]
  else:
    p = [
      g, g, g, g, g, g, g, g,
      g, g, g, g, g, g, g, g
    ]
  
  return p

sense = SenseHat()
sense.clear()

url = "https://localhost:3000/weather"

# Repeat every 10 seconds (testing purposes only)
while True:
  # get sensor data
  temp = round(sense.get_temperature(), 2)
  humidity = round(sense.get_humidity(), 2)
  pressure = round(sense.get_pressure(), 2)

  # construct the object to send to db
  data = {'temperature' : temp, 'humidity' : humidity}
  
  # execute POST request
  requests.post(url = url, params = data)
  print('Sent request @ ', datetime.now(), ' -- ', data)

  # display on senseHAT
  readings = get_temp_bar() + get_humi_bar() + get_press_bar()
  sense.set_pixels(readings)

  time.sleep(10)
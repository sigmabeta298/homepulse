import time
from machine import Pin
import dht

sensor = dht.DHT22(Pin(4))

while True:
    try:
        sensor.measure()
        temp = sensor.temperature()
        humidity = sensor.humidity()
        print("Temp: {} C   Humidity: {} %".format(temp, humidity))
    except OSError as e:
        print("Read failed:", e)
    time.sleep(2)
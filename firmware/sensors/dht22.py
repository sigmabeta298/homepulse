"""
DHT22 temperature/humidity sensor.

MicroPython ships a built-in `dht` module that already handles the DHT22's
one-wire timing protocol - this is just a thin wrapper that returns clean
values (or Nones on a failed read) instead of raising, so one bad reading
never crashes the main loop.
"""

import dht
from machine import Pin


class DHT22Sensor:
    def __init__(self, pin_number):
        self._sensor = dht.DHT22(Pin(pin_number))

    def read(self):
        """Returns (temperature_c, humidity_pct), either of which may be
        None if the read failed. DHT22s are a little flaky over long
        wires/breadboards - a None here and there is normal, not a bug."""
        try:
            self._sensor.measure()
            return self._sensor.temperature(), self._sensor.humidity()
        except OSError as e:
            print("DHT22 read failed:", e)
            return None, None

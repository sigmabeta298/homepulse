"""
Runs automatically on every boot/reset (MicroPython convention).
Just gets WiFi up before main.py starts - keeps main.py focused on the
actual sensor/capture logic.
"""

import time
import network
import config


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        print("WiFi already connected:", wlan.ifconfig()[0])
        return wlan

    print("Connecting to WiFi:", config.WIFI_SSID)
    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)

    timeout_ms = 20000
    started = time.ticks_ms()
    while not wlan.isconnected():
        if time.ticks_diff(time.ticks_ms(), started) > timeout_ms:
            print("WiFi connection timed out")
            return wlan
        time.sleep_ms(200)

    print("WiFi connected:", wlan.ifconfig()[0])
    return wlan


connect_wifi()

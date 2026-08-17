import network
import time

SSID = ""
PASSWORD = ""

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(SSID, PASSWORD)

for i in range(20):
    if wlan.isconnected():
        print("Connected! IP address:", wlan.ifconfig()[0])
        break
    print("Waiting for connection...")
    time.sleep(1)
else:
    print("Failed to connect within timeout")
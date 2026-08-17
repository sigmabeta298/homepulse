import network
import time
import urequests

SSID = ""
PASSWORD = ""

API_URL = "http://192.168.0.105:5173/api/ingest"
API_KEY = ""

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(SSID, PASSWORD)

for i in range(20):
    if wlan.isconnected():
        print("WiFi connected:", wlan.ifconfig()[0])
        break
    time.sleep(1)
else:
    print("WiFi failed to connect")
    raise SystemExit

payload = {
    "deviceSlug": "homepulse",
    "temperatureC": 25.5,
    "humidityPct": 50.0,
}

print("Posting:", payload)

response = urequests.post(
    API_URL,
    json=payload,
    headers={"Content-Type": "application/json", "x-api-key": API_KEY},
)

print("Status:", response.status_code)
print("Body:", response.text)
response.close()
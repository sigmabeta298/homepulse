"""
HomePulse firmware - main loop.

Two modes, matching the web app's Settings > Capture Mode:

  continuous: read + POST on a timer, forever. Use while the device is
              parked in one room (set MODE = "continuous" in config.py).

  spot:       read + POST only when the button is pressed. Use while
              carrying the device room to room. Remember to arm the
              target room on the Compare page in the web app BEFORE
              pressing the button - the server tags whichever room was
              armed, not whatever this firmware thinks it is (the
              firmware doesn't know what room it's in; the app does).

Which mode to run is a local setting in config.py, not something fetched
from the server - keeps the firmware simple and offline-safe. Set it to
match whatever mode you've selected in the web app's Settings page.
"""

import time
import network
import urequests

import config
from sensors.dht22 import DHT22Sensor
from boot import connect_wifi

try:
    from machine import Pin
except ImportError:
    Pin = None  # allows this file to be imported off-device for review/testing


dht22 = DHT22Sensor(config.DHT22_PIN)

pms7003 = None
if getattr(config, "ENABLE_PMS7003", False):
    from sensors.pms7003 import PMS7003Sensor

    pms7003 = PMS7003Sensor(config.PMS7003_UART_ID, config.PMS7003_TX_PIN, config.PMS7003_RX_PIN)

def ensure_wifi():
    wlan = network.WLAN(network.STA_IF)
    if not wlan.isconnected():
        connect_wifi()


def take_reading():
    """Reads all sensors and returns a dict ready to POST. Any sensor that
    fails to read comes back as None in its field - the server's schema
    already treats every sensor field as optional, precisely so one flaky
    sensor doesn't block the whole reading from being recorded."""
    temperature_c, humidity_pct = dht22.read()
    pm25, pm10 = pms7003.read() if pms7003 else (None, None)

    return {
        "deviceSlug": config.DEVICE_SLUG,
        "temperatureC": temperature_c,
        "humidityPct": humidity_pct,
        "pm25UgM3": pm25,
        # pm10 is read but not sent - the current schema/dashboard only
        # tracks pm25. Easy to add a pm10UgM3 column later if you want it.
    }


def post_reading(payload):
    url = config.API_BASE_URL.rstrip("/") + "/api/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": config.INGEST_API_KEY,
    }

    try:
        response = urequests.post(url, json=payload, headers=headers)
        ok = response.status_code == 201
        if not ok:
            print("Ingest failed:", response.status_code, response.text)
        response.close()
        return ok
    except Exception as e:
        # Covers WiFi drops, DNS failures, server unreachable, etc. One
        # failed POST should never crash the loop - just log and move on.
        print("POST failed:", e)
        return False


def capture_and_send():
    ensure_wifi()
    payload = take_reading()
    print("Reading:", payload)
    success = post_reading(payload)
    print("Sent OK" if success else "Send failed")
    return success


def run_continuous():
    print("Starting continuous mode, interval =", config.CONTINUOUS_INTERVAL_SECONDS, "s")
    while True:
        capture_and_send()
        time.sleep(config.CONTINUOUS_INTERVAL_SECONDS)


def run_spot_check():
    print("Starting spot-check mode. Press the button to capture a reading.")
    print("Remember to arm the target room on the Compare page first!")

    button = Pin(config.CAPTURE_BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    # Polling with debounce rather than an interrupt: network calls are too
    # slow/heavy to run inside an ISR, and this device only reacts to a
    # human pressing a button - polling every 50ms is plenty responsive.
    last_state = 1  # pull-up idle state is 1 (HIGH)

    while True:
        state = button.value()
        if last_state == 1 and state == 0:
            # Falling edge = button pressed (active-low with pull-up).
            time.sleep_ms(30)  # debounce
            if button.value() == 0:
                capture_and_send()
                # Wait for release so a held button doesn't fire repeatedly.
                while button.value() == 0:
                    time.sleep_ms(20)
        last_state = state
        time.sleep_ms(50)


def main():
    ensure_wifi()

    if config.MODE == "continuous":
        run_continuous()
    elif config.MODE == "spot":
        run_spot_check()
    else:
        raise ValueError("config.MODE must be 'continuous' or 'spot', got: %r" % config.MODE)


if __name__ == "__main__":
    main()

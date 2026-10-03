"""
HomePulse firmware - main loop.

Capture mode is read from the authenticated HomePulse API, so changes in
the web app's Settings page take effect without copying config.py again.
The local MODE value is only the fallback used while the API is
unreachable. The physical button captures a reading while in spot mode.
"""

import time
import network
import urequests
import ujson

import config
from sensors.dht22 import DHT22Sensor
from boot import connect_wifi

try:
    from machine import Pin
except ImportError:
    Pin = None  # allows this file to be imported off-device for review/testing


dht22 = DHT22Sensor(config.DHT22_PIN)

pms5003 = None
if getattr(config, "ENABLE_PMS5003", False):
    from sensors.pms5003 import PMS5003Sensor

    pms5003 = PMS5003Sensor(config.PMS5003_UART_ID, config.PMS5003_TX_PIN, config.PMS5003_RX_PIN)

MODE_POLL_INTERVAL_MS = 15 * 1000


def ensure_wifi():
    wlan = network.WLAN(network.STA_IF)
    if not wlan.isconnected():
        connect_wifi()


def fetch_capture_mode(fallback):
    """Return the web app's mode, retaining the last known mode on failure."""
    ensure_wifi()
    wlan = network.WLAN(network.STA_IF)
    if not wlan.isconnected():
        return fallback

    response = None
    try:
        url = config.API_BASE_URL.rstrip("/") + "/api/device/config"
        response = urequests.get(url, headers={"x-api-key": config.INGEST_API_KEY})
        if response.status_code != 200:
            print("Mode check failed:", response.status_code)
            return fallback

        payload = ujson.loads(response.text)
        mode = payload.get("mode") if isinstance(payload, dict) else None
        if mode not in ("continuous", "spot"):
            print("Mode check returned an invalid mode")
            return fallback
        return mode
    except Exception as e:
        print("Mode check failed:", e)
        return fallback
    finally:
        if response:
            response.close()


def take_reading():
    """Reads all sensors and returns a dict ready to POST. Any sensor that
    fails to read comes back as None in its field - the server's schema
    already treats every sensor field as optional, precisely so one flaky
    sensor doesn't block the whole reading from being recorded."""
    temperature_c, humidity_pct = dht22.read()
    pm1, pm25, pm10 = pms5003.read() if pms5003 else (None, None, None)

    return {
        "deviceSlug": config.DEVICE_SLUG,
        "temperatureC": temperature_c,
        "humidityPct": humidity_pct,
        "pm1UgM3": pm1,
        "pm25UgM3": pm25,
        "pm10UgM3": pm10,
    }


def post_reading(payload):
    url = config.API_BASE_URL.rstrip("/") + "/api/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": config.INGEST_API_KEY,
    }

    response = None
    try:
        response = urequests.post(url, json=payload, headers=headers)
        ok = response.status_code == 201
        if not ok:
            print("Ingest failed:", response.status_code)
        return ok
    except Exception as e:
        # Covers WiFi drops, DNS failures, server unreachable, etc. One
        # failed POST should never crash the loop - just log and move on.
        print("POST failed:", e)
        return False
    finally:
        if response:
            response.close()


def capture_and_send():
    ensure_wifi()
    payload = take_reading()
    print("Reading:", payload)
    success = post_reading(payload)
    print("Sent OK" if success else "Send failed")
    return success


def main():
    ensure_wifi()
    mode = getattr(config, "MODE", "continuous")
    if mode not in ("continuous", "spot"):
        raise ValueError("MODE fallback must be 'continuous' or 'spot', got: %r" % mode)
    mode = fetch_capture_mode(mode)
    print("Starting HomePulse; capture mode =", mode)

    button = Pin(config.CAPTURE_BUTTON_PIN, Pin.IN, Pin.PULL_UP)
    last_button_state = button.value()
    next_mode_check = time.ticks_add(time.ticks_ms(), MODE_POLL_INTERVAL_MS)
    next_continuous_reading = time.ticks_ms()
    interval_ms = max(1, config.CONTINUOUS_INTERVAL_SECONDS) * 1000

    while True:
        now = time.ticks_ms()

        if time.ticks_diff(now, next_mode_check) >= 0:
            new_mode = fetch_capture_mode(mode)
            if new_mode != mode:
                mode = new_mode
                print("Capture mode changed from web app:", mode)
                if mode == "continuous":
                    next_continuous_reading = time.ticks_ms()
            next_mode_check = time.ticks_add(time.ticks_ms(), MODE_POLL_INTERVAL_MS)

        if mode == "continuous" and time.ticks_diff(now, next_continuous_reading) >= 0:
            print("Continuous mode; interval =", config.CONTINUOUS_INTERVAL_SECONDS, "s")
            capture_and_send()
            next_continuous_reading = time.ticks_add(time.ticks_ms(), interval_ms)

        button_state = button.value()
        if last_button_state == 1 and button_state == 0:
            time.sleep_ms(30)
            if button.value() == 0:
                if mode == "spot":
                    print("Spot-check button pressed")
                    capture_and_send()
                while button.value() == 0:
                    time.sleep_ms(20)
                button_state = 1

        last_button_state = button_state
        time.sleep_ms(50)


if __name__ == "__main__":
    main()

# HomePulse Firmware (MicroPython)

Runs on the ESP32-S3. Reads a DHT22 (temp/humidity) and a PMS5003
(PM2.5/PM10), then POSTs readings to the HomePulse web app.

## Wiring

Default pin assignments (change in `config.py` if you wire it differently
- nothing is hardcoded elsewhere):

| Sensor            | Pin                  | ESP32-S3 GPIO (default) | Notes                                    |
|--------------------|----------------------|--------------------------|-------------------------------------------|
| DHT22              | VCC                  | 3V3                      |                                            |
| DHT22              | GND                  | GND                      |                                            |
| DHT22              | DATA                 | GPIO4                    | Check if your breakout has a built-in pull-up resistor; if not, add a 10k ohm resistor between DATA and VCC |
| PMS5003            | VCC                  | 5V                       | **Needs 5V, not 3.3V** - use the board's `5V`/`VIN` pin |
| PMS5003            | GND                  | GND                      |                                            |
| PMS5003            | TX                   | GPIO18 (ESP32-S3 RX)     | Sensor TX -> board RX                     |
| PMS5003            | RX                   | GPIO17 (ESP32-S3 TX)     | Sensor RX -> board TX                     |
| Capture button (spot mode only) | one leg | GPIO5   | Other leg to GND. No resistor needed - internal pull-up is enabled in code |

Avoid GPIO 0, 3, 26-32, 35-37, 45, 46 on the N16R8 - these are strapping
pins or reserved for the onboard flash/PSRAM.

The PMS5003 fan takes about 30 seconds to spin up and give stable
readings after power-on - the first reading or two may look off. That's
normal.

## One-time setup

### 1. Install tools (on your computer, not the board)

```bash
pip install esptool mpremote --break-system-packages
```

### 2. Flash MicroPython onto the board

Download the latest ESP32-S3 MicroPython `.bin` from
https://micropython.org/download/ESP32_GENERIC_S3/ (pick the N16R8/spiram
variant matching your board's 16MB flash / 8MB PSRAM).

Put the board in bootloader mode (usually: hold BOOT, tap RESET, release
BOOT), then:

```bash
# find your board's serial port first: on Mac /dev/tty.usbserial-*,
# on Linux /dev/ttyUSB* or /dev/ttyACM*, on Windows COM<n>
esptool.py --chip esp32s3 --port <YOUR_PORT> erase_flash
esptool.py --chip esp32s3 --port <YOUR_PORT> write_flash -z 0 <downloaded>.bin
```

### 3. Copy this project onto the board

```bash
cd firmware
cp config.py.example config.py
# edit config.py: WiFi SSID/password, API_BASE_URL, INGEST_API_KEY, MODE

mpremote connect <YOUR_PORT> mip install urequests

mpremote connect <YOUR_PORT> fs cp boot.py :boot.py
mpremote connect <YOUR_PORT> fs cp main.py :main.py
mpremote connect <YOUR_PORT> fs cp config.py :config.py
mpremote connect <YOUR_PORT> fs mkdir :sensors
mpremote connect <YOUR_PORT> fs cp sensors/dht22.py :sensors/dht22.py
mpremote connect <YOUR_PORT> fs cp sensors/pms5003.py :sensors/pms5003.py
```

### 4. Watch it run

```bash
mpremote connect <YOUR_PORT>
```

This drops into a REPL attached to the board's output. Press the board's
RESET button (or power-cycle it) and you should see WiFi connect, then
either the continuous-mode loop or "waiting for button press," depending
on what you set `MODE` to in `config.py`.

## Local testing before you deploy to Vercel

Point `API_BASE_URL` in `config.py` at your computer's LAN IP while
running `npm run dev` (not `localhost` - the ESP32 is a separate device
on your WiFi network and can't resolve your computer's `localhost`):

```
API_BASE_URL = "http://192.168.1.50:5173"
```

(swap in your actual LAN IP; `ipconfig`/`ifconfig` will show it). Once
you deploy to Vercel, switch this to your `https://...vercel.app` URL.

## Switching modes

`MODE` in `config.py` is a **local** setting on the device, separate from
(but should match) the "Capture Mode" you pick in the web app's Settings
page:

- Set both to **spot** while you're walking the device room to room.
  Arm the target room on the Compare page first, then press the button.
- Set both to **continuous** once you park the device in one room. It'll
  post automatically every `CONTINUOUS_INTERVAL_SECONDS`.

After changing `MODE` in `config.py`, re-copy it to the board (`mpremote
... fs cp config.py :config.py`) and reset the board.

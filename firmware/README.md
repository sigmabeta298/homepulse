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
python -m mpremote connect <YOUR_PORT> repl
```

This drops into a REPL attached to the board's output. Press the board's
RESET button (or power-cycle it) and you should see Wi-Fi connect, then
the firmware fetch the capture mode from the web application. It will
send on the timer in Continuous mode or wait for a button press in
Spot-check mode.

## Windows testing and debugging

These steps assume PowerShell is open in the `firmware` directory and that
Python, `mpremote`, and the project files are installed as above.

### Find the ESP32 COM port

1. Connect the ESP32 to the computer with a USB data cable.
2. Open **Device Manager** and expand **Ports (COM & LPT)**. Note the port
   shown for the ESP32/USB serial device (for example, `COM9`).
3. If no port appears, try another USB data cable/port and check whether the
   board needs its USB-to-UART driver.

You can also list detected serial ports from PowerShell:

```powershell
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Name
```

In the commands below, replace `COM9` with the port you found. Run them
from the directory containing `config.py`, `main.py`, and `sensors/`.

### List files on the ESP32

```powershell
python -m mpremote connect COM9 fs ls :
python -m mpremote connect COM9 fs ls :sensors
```

The root should contain `boot.py`, `main.py`, `config.py`, and `sensors/`.
The `sensors` directory should contain `dht22.py` and `pms5003.py`.
`fs ls` only lists files; it does not copy them.

### Copy changed files to the board

Copy only the files you changed. The following commands copy the main
runtime files and sensor drivers:

```powershell
python -m mpremote connect COM9 fs mkdir :sensors
python -m mpremote connect COM9 fs cp boot.py :boot.py
python -m mpremote connect COM9 fs cp main.py :main.py
python -m mpremote connect COM9 fs cp config.py :config.py
python -m mpremote connect COM9 fs cp sensors/dht22.py :sensors/dht22.py
python -m mpremote connect COM9 fs cp sensors/pms5003.py :sensors/pms5003.py
```

The `mkdir` command is needed only once; skip it if `:sensors` already
exists. After copying, list the files again to confirm they are on the
board. If you changed `config.py`, copy that file too; editing the
computer copy alone does not update the ESP32.

### Open the REPL, reset, and exit

```powershell
python -m mpremote connect COM9 repl
```

The REPL displays startup output. Press **Ctrl-D** to soft-reset the board
and watch it boot again. In continuous mode, look for the Wi-Fi status,
`Starting continuous mode`, and then `Sent OK` or a reported error.

Press **Ctrl-]** to leave the REPL and return to PowerShell. This does not
erase the files on the ESP32. Pressing **Ctrl-C** interrupts the running
MicroPython program; reset the board to start it again.

### Common checks when no reading appears

- Confirm `WIFI_SSID` and `WIFI_PASSWORD` in the local `config.py`, then
  copy that file to the board and reset.
- Confirm `API_BASE_URL` is the deployed HTTPS app URL when using Vercel,
  or the computer's reachable LAN address when testing against a local
  server.
- Confirm `INGEST_API_KEY` on the board matches the Vercel environment
  variable. Do not paste the key into logs or messages.
- Confirm `DEVICE_SLUG` is the expected device name and `MODE` is
  `continuous` for automatic readings.
- Check the REPL output for import errors, Wi-Fi timeouts, `POST failed`,
  or `Ingest failed: <status>`. A successful ingestion prints `Sent OK`.
- A `401` response usually means the API key is missing or mismatched; a
  network/DNS/TLS error means the ESP32 could not reach the configured URL.

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

Choose the capture mode in the web app's Settings page. The ESP32 checks
the authenticated `/api/device/config` endpoint every 15 seconds and
switches automatically; you do not need to edit or copy `config.py` when
changing modes. The web app and ESP32 should be connected to the same
deployment/database.

- Choose **Spot-check** while walking the device room to room. Arm the
  target room on Room Comparison, then press the physical button or use
  **Capture this room now** on the page within 15 minutes.
- Choose **Continuous** once you park the device in one room. It sends
  automatically every `CONTINUOUS_INTERVAL_SECONDS`.

The dashboard's **Capture this room now** button on Room Comparison queues
a one-time reading request for the currently armed room. The ESP32 checks
for it during the same 15-second mode poll and sends the reading with the
room and walkthrough selected when the request was made. Keep the device
powered and connected to Wi-Fi; the dashboard shows when the request is
waiting or has completed.

`MODE` in local `config.py` is only a fallback for booting when the API
cannot be reached; a successful API response overrides it. The button is
a capture button in Spot-check mode, not a hardware mode switch.
The PMS5003 streams frames continuously; a spot capture reads a valid frame
when the button is pressed, with a 10-second timeout if no valid frame is
available. Allow about 30 seconds after power-on for its fan to stabilize.

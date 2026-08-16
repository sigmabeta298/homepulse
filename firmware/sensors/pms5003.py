"""
PMS5003 particulate matter sensor (UART, 9600 baud, 8N1).

The PMS5003 continuously streams 32-byte frames once powered (no commands
needed for basic use - it defaults to "active mode"). Frame layout:

  byte 0-1   : start bytes, always 0x42 0x4D
  byte 2-3   : frame length (28, i.e. everything after this field)
  byte 4-5   : PM1.0, standard particle
  byte 6-7   : PM2.5, standard particle
  byte 8-9   : PM10,  standard particle
  byte 10-11 : PM1.0, atmospheric environment
  byte 12-13 : PM2.5, atmospheric environment   <- what we report
  byte 14-15 : PM10,  atmospheric environment   <- what we report
  byte 16-29 : particle counts by size bucket (unused here)
  byte 30-31 : checksum (sum of bytes 0-29, big-endian)

We use the "atmospheric environment" values rather than "standard
particle" - that's what Plantower's own docs recommend for reporting
real-world air quality rather than a calibration-reference number.

Note: the sensor's fan needs ~30s after power-on to give stable readings.
The first reading or two after boot may be noisy - that's normal, not a
wiring problem.
"""

from machine import UART, Pin

FRAME_LENGTH = 32
START_BYTE_1 = 0x42
START_BYTE_2 = 0x4D


class PMS5003Sensor:
    def __init__(self, uart_id, tx_pin, rx_pin):
        self._uart = UART(
            uart_id, baudrate=9600, tx=Pin(tx_pin), rx=Pin(rx_pin), timeout=2000
        )

    def read(self):
        """Returns (pm25_ug_m3, pm10_ug_m3), or (None, None) if no valid
        frame could be read/checksummed within the timeout."""
        frame = self._read_frame()
        if frame is None:
            return None, None

        checksum = (frame[30] << 8) | frame[31]
        if sum(frame[0:30]) != checksum:
            print("PMS5003 checksum mismatch, discarding frame")
            return None, None

        pm25 = (frame[12] << 8) | frame[13]
        pm10 = (frame[14] << 8) | frame[15]
        return pm25, pm10

    def _read_frame(self):
        # Scan byte-by-byte for the two start bytes, then read the rest of
        # a fixed-length frame. The sensor streams continuously, so garbage
        # bytes can appear if we start reading mid-frame - this resyncs.
        start_found = False
        for _ in range(FRAME_LENGTH * 4):  # generous scan window
            b = self._uart.read(1)
            if not b:
                return None  # timed out waiting for data
            if b[0] == START_BYTE_1:
                b2 = self._uart.read(1)
                if b2 and b2[0] == START_BYTE_2:
                    start_found = True
                    break

        if not start_found:
            return None

        rest = self._uart.read(FRAME_LENGTH - 2)
        if not rest or len(rest) != FRAME_LENGTH - 2:
            return None

        return bytes([START_BYTE_1, START_BYTE_2]) + rest

"""
PMS5003 particulate matter sensor.

UART: 9600 baud, 8N1
The PMS5003 continuously streams 32-byte frames beginning with 0x42 0x4D.

Returns atmospheric-environment PM values:
  PM1.0
  PM2.5
  PM10
"""

import time
from machine import UART, Pin


FRAME_LENGTH = 32
FRAME_HEADER = b"\x42\x4D"


class PMS5003Sensor:
    def __init__(self, uart_id, tx_pin, rx_pin):
        self._uart = UART(
            uart_id,
            baudrate=9600,
            tx=Pin(tx_pin),
            rx=Pin(rx_pin),
            timeout=2000,
        )

        # Give the PMS5003 time to start its fan and begin streaming.
        time.sleep(5)

    def read(self):
        """
        Wait for a complete valid PMS5003 frame.

        Returns:
            (pm1, pm25, pm10)

        Returns:
            (None, None, None) if no valid frame arrives within 10 seconds.
        """

        deadline = time.ticks_add(time.ticks_ms(), 10000)
        buffer = bytearray()

        while time.ticks_diff(deadline, time.ticks_ms()) > 0:

            # Read whatever is currently available.
            waiting = self._uart.any()

            if waiting:
                data = self._uart.read(waiting)

                if data:
                    buffer.extend(data)

                    # Look for the PMS5003 frame header.
                    start = buffer.find(FRAME_HEADER)

                    if start >= 0:

                        # Keep collecting until we have a full frame.
                        if len(buffer) - start >= FRAME_LENGTH:

                            frame = buffer[start:start + FRAME_LENGTH]

                            # PMS5003 frame length must be 28.
                            frame_length = (
                                (frame[2] << 8) | frame[3]
                            )

                            if frame_length != 28:
                                buffer = buffer[start + 2:]
                                continue

                            # Validate checksum.
                            checksum = (
                                (frame[30] << 8) | frame[31]
                            )

                            calculated = sum(frame[0:30])

                            if calculated != checksum:
                                buffer = buffer[start + 2:]
                                continue

                            # Atmospheric-environment values.
                            pm1 = (
                                (frame[10] << 8) | frame[11]
                            )

                            pm25 = (
                                (frame[12] << 8) | frame[13]
                            )

                            pm10 = (
                                (frame[14] << 8) | frame[15]
                            )

                            return pm1, pm25, pm10

            # Give the sensor/UART a moment before checking again.
            time.sleep_ms(50)

        print("PMS5003: timeout waiting for valid frame")
        return None, None, None
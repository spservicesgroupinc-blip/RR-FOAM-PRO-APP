/**
 * ESP32-S3 WebUSB Stroke Counter — Test Firmware
 * ─────────────────────────────────────────────────────────────────────────
 * PURPOSE: Prove the USB link works. Two physical buttons (or GPIO wires
 *          touched to GND) increment open-cell / closed-cell stroke counters
 *          and send JSON packets to the browser test page over WebUSB.
 *
 * Browser side: /public/usb-test.html
 * Protocol:     Newline-delimited JSON  (\n terminated)
 *
 * WIRING (for bench test — just bridge GPIO to GND with a wire):
 *   GPIO 0  → Open Cell  button (boot button on most S3 boards, active LOW)
 *   GPIO 1  → Closed Cell button (or any free GPIO, active LOW)
 *   GND     → other leg of each button
 *
 * Once real ESP32-S3-Touch-LCD-4.3B arrives, replace GPIO button reads
 * with LVGL touchscreen tap events on the + buttons.
 * ─────────────────────────────────────────────────────────────────────────
 */

#include <Arduino.h>
#include <USB.h>
#include <USBCDC.h>          // We'll override with WebUSB below
#include "esp32-hal-tinyusb.h"

// ── Pin definitions (bench test) ────────────────────────────────────────
#define BTN_OPEN_CELL   0    // GPIO0  = BOOT button on most ESP32-S3 boards
#define BTN_CLOSED_CELL 1    // GPIO1  = wire to GND for test
#define LED_BUILTIN_PIN 38   // Onboard LED (many S3 boards)

// ── Stroke counters ──────────────────────────────────────────────────────
volatile uint32_t strokesOC = 0;
volatile uint32_t strokesCC = 0;
String            activeJobId = "";   // Set by browser via USB

// ── Debounce ─────────────────────────────────────────────────────────────
unsigned long lastPressOC = 0;
unsigned long lastPressCC = 0;
const unsigned long DEBOUNCE_MS = 200;

// ── WebUSB / TinyUSB setup ───────────────────────────────────────────────
// The ESP32 Arduino core exposes WebUSB through TinyUSB.
// We use USBCDC for now as the simplest working transport that Chrome
// can talk to via WebUSB. For production, swap to a proper WebUSB
// vendor class — the JSON protocol stays identical either way.
USBCDC WebUSBSerial;

// ── Send a JSON packet to the browser ────────────────────────────────────
void sendPacket(const String& json) {
  WebUSBSerial.println(json);   // \n delimiter so browser can parse line by line
  WebUSBSerial.flush();
}

// ── Build stroke packet ───────────────────────────────────────────────────
void sendStroke(const char* foam) {
  // Minimal JSON — matches what handleESP32Message() expects in usb-test.html
  String pkt = "{\"type\":\"STROKE\",\"foam\":\"";
  pkt += foam;
  pkt += "\",\"oc\":";
  pkt += strokesOC;
  pkt += ",\"cc\":";
  pkt += strokesCC;
  pkt += "}";
  sendPacket(pkt);
}

// ── Parse incoming packet from browser ───────────────────────────────────
void handleIncoming(const String& raw) {
  // We only care about a few message types for this test:
  //   {"type":"JOB_SELECTED","jobId":"job-abc12345"}
  //   {"type":"RESET"}
  //   {"type":"PING"}

  if (raw.indexOf("\"PING\"") >= 0) {
    sendPacket("{\"type\":\"ACK\",\"message\":\"pong\"}");
    return;
  }

  if (raw.indexOf("\"RESET\"") >= 0) {
    strokesOC = strokesCC = 0;
    sendPacket("{\"type\":\"ACK\",\"message\":\"counters reset\"}");
    return;
  }

  if (raw.indexOf("\"JOB_SELECTED\"") >= 0) {
    // Parse jobId — simple substring find, no full JSON parser needed here
    int start = raw.indexOf("\"jobId\":\"") + 9;
    int end   = raw.indexOf("\"", start);
    if (start > 9 && end > start) {
      activeJobId = raw.substring(start, end);
      String ack = "{\"type\":\"ACK\",\"message\":\"job set: " + activeJobId + "\"}";
      sendPacket(ack);
    }
    return;
  }
}

// ── setup ────────────────────────────────────────────────────────────────
void setup() {
  // Button pins — internal pull-up, active LOW
  pinMode(BTN_OPEN_CELL,   INPUT_PULLUP);
  pinMode(BTN_CLOSED_CELL, INPUT_PULLUP);
  pinMode(LED_BUILTIN_PIN, OUTPUT);

  // Start WebUSB serial (shows up as ESP32-S3 in Chrome device picker)
  WebUSBSerial.begin(115200);
  USB.begin();

  // Blink to show we're alive
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN_PIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN_PIN, LOW);
    delay(100);
  }

  // Wait up to 3s for browser to connect, then proceed
  unsigned long wait = millis();
  while (!WebUSBSerial && (millis() - wait < 3000)) { delay(10); }

  // Announce ourselves
  sendPacket("{\"type\":\"HELLO\",\"version\":\"0.1.0\",\"device\":\"ESP32-S3-USB-Test\"}");
}

// ── loop ─────────────────────────────────────────────────────────────────
void loop() {

  // ── Read buttons (debounced) ────────────────────────────────────────
  unsigned long now = millis();

  if (digitalRead(BTN_OPEN_CELL) == LOW && (now - lastPressOC > DEBOUNCE_MS)) {
    lastPressOC = now;
    strokesOC++;
    digitalWrite(LED_BUILTIN_PIN, HIGH);
    sendStroke("oc");
    delay(30);
    digitalWrite(LED_BUILTIN_PIN, LOW);
  }

  if (digitalRead(BTN_CLOSED_CELL) == LOW && (now - lastPressCC > DEBOUNCE_MS)) {
    lastPressCC = now;
    strokesCC++;
    digitalWrite(LED_BUILTIN_PIN, HIGH);
    sendStroke("cc");
    delay(30);
    digitalWrite(LED_BUILTIN_PIN, LOW);
  }

  // ── Read incoming from browser ──────────────────────────────────────
  if (WebUSBSerial.available()) {
    String line = WebUSBSerial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleIncoming(line);
    }
  }

  // ── Periodic heartbeat (every 5s) ──────────────────────────────────
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 5000) {
    lastHeartbeat = millis();
    String hb = "{\"type\":\"HEARTBEAT\",\"oc\":";
    hb += strokesOC;
    hb += ",\"cc\":";
    hb += strokesCC;
    hb += ",\"jobId\":\"";
    hb += activeJobId;
    hb += "\"}";
    sendPacket(hb);
  }
}

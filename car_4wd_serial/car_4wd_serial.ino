// ============================================================
//  Smart Agriculture Robot -- Arduino Uno Q
//  Car (L298N) + Sensors (DHT22, soil, gas) + Pump/Fan relays,
//  all on one sketch since the board only runs one program at a
//  time on its microcontroller.
//
//  Every command arrives newline-terminated over Serial (whether
//  typed into a monitor or sent by api/arduino_bridge.py through
//  the Arduino Router's TCP passthrough) so it's all parsed as
//  line-buffered text, not char-by-char -- that's what lets
//  multi-character commands like "SPRAY_FULL" and single-character
//  ones like "F" share one command path below.
//
//  Movement commands (immediate, no delay() blocking):
//    F/B/L/R/S  -> forward/back/left/right/stop
//    (+/- are accepted but no-op: this L298N wiring has no PWM
//    enable pins connected, so there's no speed to adjust)
//
//  Actuator commands (relay control, active-LOW modules):
//    SPRAY_OFF / SPRAY_LIGHT / SPRAY_MODERATE / SPRAY_FULL -> pump
//    FAN_ON / FAN_OFF -> fan
//
//  Sensor reporting: one JSON line every 2s, matching the field
//  names api/arduino_bridge.py's _ingest_line() expects:
//    {"temperature":.., "humidity":.., "soil_moisture":..,
//     "gas_level":.., "fan_state":.., "pump_state":..}
// ============================================================

#include <DHT.h>

// A hardware watchdog (auto-reset the MCU if the sketch hangs) was
// investigated but isn't achievable through the normal Arduino sketch
// build: this board runs sketches as a loadable plugin (LLEXT) inside a
// prebuilt Zephyr kernel image, and that prebuilt kernel doesn't have the
// IWDG driver compiled in. Enabling it would require rebuilding the whole
// kernel from the Zephyr SDK, not just this sketch. Resilience against a
// hung sketch is instead handled Linux-side, in api/arduino_bridge.py's
// stale-connection detector.

// ---------- L298N motor driver ----------
#define IN1 12
#define IN2 11
#define IN3 10
#define IN4 9

// ---------- Sensors ----------
#define DHTPIN 3
#define DHTTYPE DHT22
#define SOIL_PIN A1
#define GAS_PIN A0
DHT dht(DHTPIN, DHTTYPE);

// ---------- Relays (active LOW: LOW = on, HIGH = off) ----------
#define FAN_RELAY 7
#define PUMP_RELAY 8

const unsigned long SENSOR_INTERVAL_MS = 2000;
unsigned long lastSensorRead = 0;

// Soil moisture calibration -- raw analogRead() at fully dry / fully
// wet, used to map the raw ADC value onto a 0-100% scale.
const int SOIL_DRY_RAW = 850;
const int SOIL_WET_RAW = 350;

bool fanOn = false;
bool pumpOn = false;

// A spray command starts a timed burst rather than running until told
// otherwise -- the pump auto-stops on its own after SPRAY_DURATION_MS.
// An explicit SPRAY_OFF still works immediately and just cancels the timer.
const unsigned long SPRAY_DURATION_MS = 5000;
unsigned long sprayStartTime = 0;
bool sprayTimerActive = false;

String inputBuffer;

// ============================================================
//  SETUP
// ============================================================
void setup() {
  // Both loads are physically wired to their relay's NC terminal instead of
  // NO (a hardware fact we're compensating for here rather than rewiring),
  // so the electrical result of each relay state is the opposite of what
  // it'd normally be: de-energized (HIGH on this active-LOW module) leaves
  // the load powered via NC, energized (LOW) disconnects it. "Off" is
  // therefore LOW here, not HIGH.
  //
  // Relay pins first, before anything else, and write that OFF level
  // *before* switching them to OUTPUT mode, so there's no boot window where
  // an unconfigured pin could leave the load in an undefined state.
  digitalWrite(FAN_RELAY, LOW);
  digitalWrite(PUMP_RELAY, LOW);
  pinMode(FAN_RELAY, OUTPUT);
  pinMode(PUMP_RELAY, OUTPUT);
  digitalWrite(FAN_RELAY, LOW);   // off (re-asserted once the pin is a real output)
  digitalWrite(PUMP_RELAY, LOW);  // off

  Serial.begin(9600);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopCar();

  dht.begin();

  inputBuffer.reserve(32);

  Serial.println("================================");
  Serial.println(" SMART AGRICULTURE ROBOT");
  Serial.println("================================");
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  readSerialCommands();

  unsigned long now = millis();

  if (sprayTimerActive && (now - sprayStartTime >= SPRAY_DURATION_MS)) {
    sprayTimerActive = false;
    pumpOn = false;
    applyRelayStates();
    Serial.println(">> PUMP OFF (spray timer elapsed)");
  }

  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;
    reportSensors();
  }
}

// ------------------------------------------------------------
//  Command parsing -- buffer characters until '\n', then dispatch
//  the whole line. Handles both single-char movement commands and
//  word-form actuator commands the same way.
// ------------------------------------------------------------
void readSerialCommands() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        handleCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
      if (inputBuffer.length() > 24) inputBuffer = "";  // guard against garbage
    }
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "F") { moveForward();  Serial.println(">> FORWARD");  return; }
  if (cmd == "B") { moveBackward(); Serial.println(">> BACKWARD"); return; }
  if (cmd == "L") { turnLeft();     Serial.println(">> LEFT");     return; }
  if (cmd == "R") { turnRight();    Serial.println(">> RIGHT");    return; }
  if (cmd == "S") { stopCar();      Serial.println(">> STOPPED");  return; }

  if (cmd == "SPRAY_OFF") {
    pumpOn = false;
    sprayTimerActive = false;
  } else if (cmd == "SPRAY_LIGHT" || cmd == "SPRAY_MODERATE" || cmd == "SPRAY_FULL") {
    pumpOn = true;
    sprayStartTime = millis();
    sprayTimerActive = true;
  } else if (cmd == "FAN_ON") {
    fanOn = true;
  } else if (cmd == "FAN_OFF") {
    fanOn = false;
  } else {
    return;  // unknown command (e.g. "+"/"-", no PWM pins wired) -- no-op
  }

  applyRelayStates();
  Serial.print(">> PUMP "); Serial.print(pumpOn ? "ON" : "OFF");
  Serial.print(" | FAN "); Serial.println(fanOn ? "ON" : "OFF");
}

void applyRelayStates() {
  // Inverted vs. the relay's own active-LOW coil logic: both loads sit on
  // NC, so de-energized (HIGH) is what leaves them powered. "On" needs the
  // coil actively energized (LOW) to disconnect NC and cut power instead.
  digitalWrite(PUMP_RELAY, pumpOn ? HIGH : LOW);
  digitalWrite(FAN_RELAY, fanOn ? HIGH : LOW);
}

// ============================================================
//  SENSOR REPORTING
// ============================================================
void reportSensors() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soilRaw = analogRead(SOIL_PIN);
  int gasRaw = analogRead(GAS_PIN);
  bool dhtOk = !(isnan(temperature) || isnan(humidity));

  float soilMoisture = ((float)(SOIL_DRY_RAW - soilRaw) / (SOIL_DRY_RAW - SOIL_WET_RAW)) * 100.0;
  soilMoisture = constrain(soilMoisture, 0, 100);

  // The DHT22 is flaky and fails to read fairly often -- when it does, still
  // report everything else (soil, gas, fan, pump) instead of dropping the
  // whole line, so one bad sensor doesn't blank out all the others.
  Serial.print("{");
  if (dhtOk) {
    Serial.print("\"temperature\":");
    Serial.print(temperature);
    Serial.print(",\"humidity\":");
    Serial.print(humidity);
    Serial.print(",");
  }
  Serial.print("\"soil_moisture\":");
  Serial.print(soilMoisture);
  Serial.print(",\"gas_level\":");
  Serial.print(gasRaw);
  Serial.print(",\"fan_state\":");
  Serial.print(fanOn ? "true" : "false");
  Serial.print(",\"pump_state\":");
  Serial.print(pumpOn ? "true" : "false");
  Serial.println("}");
}

// ============================================================
//  MOVEMENT FUNCTIONS
// ============================================================
void moveForward() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}

void moveBackward() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW); digitalWrite(IN4, HIGH);
}

void turnLeft() {
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);  digitalWrite(IN4, HIGH);
}

void turnRight() {
  digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
}

void stopCar() {
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

// ============================================================
//  4WD Car with L293D Motor Driver — Serial Monitor Control
//  Arduino Uno Q
//
//  PIN LAYOUT (verified from your wiring diagram):
//  --- RIGHT MOTORS (C & D terminals on L293D) ---
//  A1  → D2    orange  (direction pin A)
//  A2  → D4    brown   (direction pin B)
//  ENA → D11   red     (PWM speed, right side)
//
//  --- LEFT MOTORS (A & B terminals on L293D) ---
//  B1  → D5    dark blue (direction pin A)
//  B2  → D6    white     (direction pin B)
//  ENB → D10   grey      (PWM speed, left side)
//
//  Serial Commands (open Serial Monitor at 9600 baud):
//    F → Forward
//    B → Backward
//    L → Turn Left
//    R → Turn Right
//    S → Stop
//    + → Increase speed
//    - → Decrease speed
//    ? → Help
// ============================================================

// ---------- RIGHT motors ----------
const int RIGHT_IN1 = 2;    // A1 on L293D (orange)
const int RIGHT_IN2 = 4;    // A2 on L293D (brown)
const int RIGHT_EN  = 11;   // ENA on L293D (red, PWM ~ pin)

// ---------- LEFT motors ----------
const int LEFT_IN1  = 5;    // B1 on L293D (dark blue)
const int LEFT_IN2  = 6;    // B2 on L293D (white)
const int LEFT_EN   = 10;   // ENB on L293D (grey, PWM ~ pin)

// ---------- Speed ----------
int motorSpeed        = 255;
const int SPEED_STEP  =  20;
const int MIN_SPEED   =  60;
const int MAX_SPEED   = 255;

// ============================================================
//  SETUP
// ============================================================
void setup() {
  pinMode(RIGHT_IN1, OUTPUT);
  pinMode(RIGHT_IN2, OUTPUT);
  pinMode(RIGHT_EN,  OUTPUT);

  pinMode(LEFT_IN1,  OUTPUT);
  pinMode(LEFT_IN2,  OUTPUT);
  pinMode(LEFT_EN,   OUTPUT);

  stopCar();

  Serial.begin(9600);
  printHelp();
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  if (Serial.available() > 0) {
    char cmd = toupper((char)Serial.read());

    switch (cmd) {
      case 'F': moveForward();  Serial.println(">> FORWARD");    break;
      case 'B': moveBackward(); Serial.println(">> BACKWARD (hold, send S to stop)"); break;
      case 'L': turnLeft();     Serial.println(">> TURN LEFT");  break;
      case 'R': turnRight();    Serial.println(">> TURN RIGHT"); break;
      case 'S': stopCar();      Serial.println(">> STOPPED");    break;
      case '+': speedUp();                                        break;
      case '-': speedDown();                                      break;
      case '?': printHelp();                                      break;
      default:
        if (cmd != '\n' && cmd != '\r' && cmd != ' ') {
          Serial.print("Unknown command: ");
          Serial.println(cmd);
        }
        break;
    }
  }
}

// ============================================================
//  MOVEMENT FUNCTIONS
// ============================================================

void moveForward() {
  setSpeed(motorSpeed);
  digitalWrite(RIGHT_IN1, HIGH);
  digitalWrite(RIGHT_IN2, LOW);
  digitalWrite(LEFT_IN1,  HIGH);
  digitalWrite(LEFT_IN2,  LOW);
}

void moveBackward() {
  setSpeed(motorSpeed);
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, HIGH);
  digitalWrite(LEFT_IN1,  LOW);
  digitalWrite(LEFT_IN2,  HIGH);
}

void turnLeft() {
  setSpeed(motorSpeed);
  digitalWrite(RIGHT_IN1, HIGH);  // Right side forward
  digitalWrite(RIGHT_IN2, LOW);
  digitalWrite(LEFT_IN1,  LOW);   // Left side backward
  digitalWrite(LEFT_IN2,  HIGH);
}

void turnRight() {
  setSpeed(motorSpeed);
  digitalWrite(RIGHT_IN1, LOW);   // Right side backward
  digitalWrite(RIGHT_IN2, HIGH);
  digitalWrite(LEFT_IN1,  HIGH);  // Left side forward
  digitalWrite(LEFT_IN2,  LOW);
}

void stopCar() {
  analogWrite(RIGHT_EN, 0);
  analogWrite(LEFT_EN,  0);
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, LOW);
  digitalWrite(LEFT_IN1,  LOW);
  digitalWrite(LEFT_IN2,  LOW);
}

// ============================================================
//  HELPERS
// ============================================================

void setSpeed(int spd) {
  analogWrite(RIGHT_EN, spd);
  analogWrite(LEFT_EN,  spd);
}

void speedUp() {
  motorSpeed = min(motorSpeed + SPEED_STEP, MAX_SPEED);
  Serial.print(">> Speed: ");
  Serial.println(motorSpeed);
}

void speedDown() {
  motorSpeed = max(motorSpeed - SPEED_STEP, MIN_SPEED);
  Serial.print(">> Speed: ");
  Serial.println(motorSpeed);
}

void printHelp() {
  Serial.println("==================================");
  Serial.println("  4WD Serial Monitor Controller  ");
  Serial.println("==================================");
  Serial.println("  F  → Forward");
  Serial.println("  B  → Backward");
  Serial.println("  L  → Turn Left  (pivot)");
  Serial.println("  R  → Turn Right (pivot)");
  Serial.println("  S  → Stop");
  Serial.println("  +  → Speed up");
  Serial.println("  -  → Speed down");
  Serial.println("  ?  → Show this help");
  Serial.println("==================================");
  Serial.print("  Current speed: ");
  Serial.println(motorSpeed);
  
}
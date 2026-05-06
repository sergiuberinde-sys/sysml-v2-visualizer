export const BRK_SAMPLE = `package BrakeByWire;

// Brake-by-Wire System — SysML v2 Demo
// Edit the model below — views update live.

// ── Interface Definitions ─────────────────────────
interface def BrakeCommand;
interface def WheelSpeedSignal;
interface def PedalPositionSignal;

// ── Part Type Definitions (with ports) ────────────
part def BrakePedal {
  port out pedalPosition : PedalPositionSignal;
}

part def WheelSpeedSensor {
  port out wheelSpeed : WheelSpeedSignal;
}

part def BrakeController {
  port in  pedalPosition : PedalPositionSignal;
  port in  wheelSpeed    : WheelSpeedSignal;
  port out brakeCommand  : BrakeCommand;
}

part def HydraulicModulator {
  port in brakeCommand : BrakeCommand;
}

// ── System Composition ────────────────────────────
part def BrakeByWireSystem {
  part pedal      : BrakePedal;
  part sensor     : WheelSpeedSensor;
  part controller : BrakeController;
  part modulator  : HydraulicModulator;

  connect pedal.pedalPosition  to controller.pedalPosition;
  connect sensor.wheelSpeed    to controller.wheelSpeed;
  connect controller.brakeCommand to modulator.brakeCommand;
}

// ── Scenario: Normal Braking ─────────────────────
occurrence def NormalBraking {
  message pedalPressed  from Driver to BrakePedal;
  message sensorSignal  from BrakePedal to BrakeController;
  message brakeCommand  from BrakeController to HydraulicModulator;
}

// ── Scenario: Fault Handling ─────────────────────
occurrence def FaultHandling {
  message sensorFault   from WheelSpeedSensor to BrakeController;
  message degradeForce  from BrakeController to HydraulicModulator;
  message driverWarning from BrakeController to Driver;
}

// ── Scenario: CAN Communication ──────────────────
occurrence def CANComms {
  message canRequest      from BrakeController to CANBus;
  message sensorBroadcast from WheelSpeedSensor to CANBus;
  message canResponse     from CANBus to BrakeController;
}

// ── Action Definitions ────────────────────────────
action def ReadWheelSpeed;
action def ComputeBrakeTorque;
action def ApplyBrakePressure;
action def DetectFault;

// ── Behavior: Brake Control Logic ────────────────
behavior def BrakeControlLogic {
  action readSpeed     : ReadWheelSpeed;
  action computeTorque : ComputeBrakeTorque;
  action applyPressure : ApplyBrakePressure;

  flow readSpeed     -> computeTorque;
  flow computeTorque -> applyPressure;
}

// ── Behavior: Fault Detection ────────────────────
behavior def FaultDetection {
  action readSpeed   : ReadWheelSpeed;
  action detectFault : DetectFault;

  flow readSpeed -> detectFault;
}

// ── State Machine: Brake System ───────────────────
state def BrakeSystemStateMachine {
  state Off;
  state SelfTest;
  state Ready;
  state Braking;
  state ABSActive;
  state Fault;

  initial -> Off;
  transition Off      -> SelfTest   on powerOn;
  transition SelfTest -> Ready      on selfTestPassed;
  transition Ready    -> Braking    on pedalPressed;
  transition Braking  -> ABSActive  on wheelSlipDetected;
  transition ABSActive -> Braking   on wheelRecovered;
  transition Braking  -> Ready      on pedalReleased;
  transition Ready    -> Fault      on diagnosticFailure;
  transition Fault    -> Ready      on faultCleared;
}

// ── Requirements ──────────────────────────────────────────
requirement def BrakeResponseTime {
  id = "REQ-BBW-001";
  text = "The brake controller shall command brake pressure within 50 ms of pedal input.";
  priority = "High";
}

requirement def ABSActivation {
  id = "REQ-BBW-002";
  text = "The system shall activate ABS when wheel slip is detected.";
  priority = "High";
}

requirement def SelfTestOnStartup {
  id = "REQ-BBW-003";
  text = "The system shall perform a self-test on power-on before entering the Ready state.";
  priority = "Medium";
}

// ── Traceability ──────────────────────────────────────────
satisfy BrakeController satisfies BrakeResponseTime;
satisfy BrakeByWireSystem satisfies ABSActivation;
verify BrakeSystemStateMachine verifies SelfTestOnStartup;
trace BrakeControlLogic traces BrakeResponseTime;
trace FaultDetection traces ABSActivation;
`;

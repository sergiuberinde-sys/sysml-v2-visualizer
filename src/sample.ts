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
`;

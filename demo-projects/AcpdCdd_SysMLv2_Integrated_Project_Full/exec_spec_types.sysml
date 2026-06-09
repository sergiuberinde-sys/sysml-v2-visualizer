// Action definitions shared across exec_spec_test.sysml.
// Kept in a separate file to exercise cross-file port inheritance
// in the Actions view — receiveSensorData : RCVSENS must pick up
// rawSensorReading even though RCVSENS lives here, not in the
// file that uses it.
package ExecSpecTypes {

    action def RCVSENS {
        out item rawSensorReading : SensorReading;
    }
}

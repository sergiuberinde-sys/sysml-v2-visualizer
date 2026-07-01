package SCP_MainActionSignatures {

    // Primitive action signatures used by SignalConditioningAndProcessingMain.
    // Cross-package references are resolved through the private imports below.

    // Action signatures used by SignalConditioningAndProcessingMain.
    // Owned by the cluster behavior team.
    private import SCP_Foundation::*;

    action def AcquireSensorAndSupplyVoltage {
        // The six input pins are anonymous/untyped in the UML CallBehaviorAction itself.
        // They are resolved through the XMI-derived structural boundary ports connected to
        // the allocated SignalConversion function, preserving the original logical-interface item types.
        in item batterySupply : BatterySupply_Item;
        in item canFlexrayPhysicalSupplyVoltage : CANFlexray_PhysicalSupplyVoltage_Item;
        in item vdd3v3PhysicalSupplyVoltage : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
        in item vdd5dPhysicalSupplyVoltage : VDD5D_PhysicalSupplyVoltage_Item;
        in item ethernetPLCPhysicalSupplyVoltage : ETH_PhysicalSupplyVoltage_Item;
        in item wakeupVBATBusCommPhysicalSupplyVoltage : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
        out item digActualMeasAcceleratorPedalSensor : DigActualMeasAcceleratorPedalSensor_Item;
    }

    action def ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware {
        in item digActualMeasAcceleratorPedalSensor : DigActualMeasAcceleratorPedalSensor_Item;
        out item rawVoltageAcceleratorPedalSensor1 : RawVoltageAcceleratorPedalSensor1_Item;
        out item rawVoltageAcceleratorPedalSensorRedundant1 : RawVoltageAcceleratorPedalSensorRedundant1_Item;
        out item rawVoltageAcceleratorPedalSensor2 : RawVoltageAcceleratorPedalSensor2_Item;
        out item rawVoltageAcceleratorPedalSensorRedundant2 : RawVoltageAcceleratorPedalSensorRedundant2_Item;
        out item rawSupplyVoltageAcceleratorPedalSensor1 : RawSupplyVoltageAcceleratorPedalSensor1_Item;
        out item rawSupplyVoltageAcceleratorPedalSensor2 : RawSupplyVoltageAcceleratorPedalSensor2_Item;
    }

    action def ProcessAndQualifySensorAndSupplyVoltages {
        in item rawVoltageAcceleratorPedalSensor1 : RawVoltageAcceleratorPedalSensor1_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant1 : RawVoltageAcceleratorPedalSensorRedundant1_Item;
        in item rawVoltageAcceleratorPedalSensor2 : RawVoltageAcceleratorPedalSensor2_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant2 : RawVoltageAcceleratorPedalSensorRedundant2_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor1 : RawSupplyVoltageAcceleratorPedalSensor1_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor2 : RawSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualVoltageAcceleratorPedalSensor1 : ActualVoltageAcceleratorPedalSensor1_Item;
        out item actualVoltageAcceleratorPedalSensor2 : ActualVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusVoltageAcceleratorPedalSensor1 : ActualStatusVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusVoltageAcceleratorPedalSensor2 : ActualStatusVoltageAcceleratorPedalSensor2_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor1 : ActualSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor2 : ActualSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor1 : ActualStatusSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor2 : ActualStatusSupplyVoltageAcceleratorPedalSensor2_Item;
    }

    action def EnableDisableThePowerSupply {
        in item acceleratorPedalHwCtrl : AcceleratorPedalHwCtrl_Item;
        out item acceleratorPedalPowerSupplyCtrl : AcceleratorPedalPowerSupplyCtrl_Item;
    }

    action def CommandDIOToEnableDisablePowerSupply {
        in item acceleratorPedalDioCtrl : AcceleratorPedalDioCtrl_Item;
        out item acceleratorPedalHwCtrl : AcceleratorPedalHwCtrl_Item;
    }

    action def GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine {
        in item acceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Item;
        out item acceleratorPedalDioCtrl : AcceleratorPedalDioCtrl_Item;
    }

}

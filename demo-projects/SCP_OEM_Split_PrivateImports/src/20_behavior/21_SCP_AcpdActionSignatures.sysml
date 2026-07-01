package SCP_AcpdActionSignatures {

    // Primitive action signatures used by AcceleratorPedalSignalProcessing.
    // Cross-package references are resolved through the private imports below.

    // Action signatures used by the AcpdSignalProcessing classifier behavior.
    // Owned by the AcpdSignalProcessing behavior team.
    private import SCP_Foundation::*;

    action def ScaleSupplyVoltages {
        in item rawSupplyVoltageAcceleratorPedalSensor1 : RawSupplyVoltageAcceleratorPedalSensor1_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor2 : RawSupplyVoltageAcceleratorPedalSensor2_Item;
        out item scaledSupplyVoltage1 : ScaledSupplyVoltage1_Item;
        out item scaledSupplyVoltage2 : ScaledSupplyVoltage2_Item;
    }

    action def CompareSupplyVoltagesAgainstAdcReferenceVoltages {
        in item rawSupplyVoltageAcceleratorPedalSensor1 : RawSupplyVoltageAcceleratorPedalSensor1_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor2 : RawSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor1 : ActualStatusSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor2 : ActualStatusSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusVoltageAcceleratorPedalSensor1 : ActualStatusVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusVoltageAcceleratorPedalSensor2 : ActualStatusVoltageAcceleratorPedalSensor2_Item;
    }

    action def GetActivationStatusFromLcmAndCommandThePowerSupply {
        in item acceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Item;
        out item acceleratorPedalDioCtrl : AcceleratorPedalDioCtrl_Item;
    }

    action def CreateMeanValuesForAllSignals {
        in item rawVoltageAcceleratorPedalSensor1 : RawVoltageAcceleratorPedalSensor1_Item;
        in item rawVoltageAcceleratorPedalSensor2 : RawVoltageAcceleratorPedalSensor2_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant1 : RawVoltageAcceleratorPedalSensorRedundant1_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant2 : RawVoltageAcceleratorPedalSensorRedundant2_Item;
        out item meanValueActualVoltageSensor1 : MeanValueActualVoltageSensor1_Item;
        out item meanValueActualVoltageSensor1Redundant : MeanValueActualVoltageSensor1Redundant_Item;
        out item meanValueActualVoltageSensor2 : MeanValueActualVoltageSensor2_Item;
        out item meanValueActualVoltageSensor2Redundant : MeanValueActualVoltageSensor2Redundant_Item;
    }

    action def PerformRedundancyCheckForSensor1Voltage {
        in item meanValueActualVoltageSensor1 : MeanValueActualVoltageSensor1_Item;
        in item meanValueActualVoltageSensor1Redundant : MeanValueActualVoltageSensor1Redundant_Item;
        out item actualStatusVoltageAcceleratorPedalSensor1 : ActualStatusVoltageAcceleratorPedalSensor1_Item;
        out item actualVoltageAcceleratorPedalSensor1 : ActualVoltageAcceleratorPedalSensor1_Item;
    }

    action def PerformRedundancyCheckForSensor2Voltage {
        in item meanValueActualVoltageSensor2 : MeanValueActualVoltageSensor2_Item;
        in item meanValueActualVoltageSensor2Redundant : MeanValueActualVoltageSensor2Redundant_Item;
        out item actualStatusVoltageAcceleratorPedalSensor2 : ActualStatusVoltageAcceleratorPedalSensor2_Item;
        out item actualVoltageAcceleratorPedalSensor2 : ActualVoltageAcceleratorPedalSensor2_Item;
    }

    action def PerformLatencyAndJitterDetection {
        in item adcIsr : ADC_ISR_Item;
        out item isrErrorState : ISRErrorState_Item;
    }

    action def CreateMovingAverageForSupplyVoltages {
        in item scaledSupplyVoltage1 : ScaledSupplyVoltage1_Item;
        in item scaledSupplyVoltage2 : ScaledSupplyVoltage2_Item;
        in item isrErrorState : ISRErrorState_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor1 : ActualSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor2 : ActualSupplyVoltageAcceleratorPedalSensor2_Item;
    }

}

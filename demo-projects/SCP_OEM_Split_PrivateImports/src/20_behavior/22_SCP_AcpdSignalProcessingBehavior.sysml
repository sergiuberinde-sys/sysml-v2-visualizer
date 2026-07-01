package SCP_AcpdBehavior {

    // Classifier behavior of AcpdSignalProcessing: AcceleratorPedalSignalProcessing.
    // Cross-package references are resolved through the private imports below.

    // Activity behavior translated from AcceleratorPedalSignalProcessing.
    // Owns only the action body; primitive action signatures remain in 21_SCP_AcpdActionSignatures.sysml.
    private import SCP_Foundation::*;
    private import SCP_AcpdActionSignatures::*;

    action def AcceleratorPedalSignalProcessing {
        in item rawVoltageAcceleratorPedalSensor1 : RawVoltageAcceleratorPedalSensor1_Item;
        in item rawVoltageAcceleratorPedalSensor2 : RawVoltageAcceleratorPedalSensor2_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant1 : RawVoltageAcceleratorPedalSensorRedundant1_Item;
        in item rawVoltageAcceleratorPedalSensorRedundant2 : RawVoltageAcceleratorPedalSensorRedundant2_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor1 : RawSupplyVoltageAcceleratorPedalSensor1_Item;
        in item rawSupplyVoltageAcceleratorPedalSensor2 : RawSupplyVoltageAcceleratorPedalSensor2_Item;
        in item acceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Item;
        in item adcIsr : ADC_ISR_Item;

        out item acceleratorPedalDioCtrl : AcceleratorPedalDioCtrl_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor1 : ActualStatusSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor2 : ActualStatusSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusVoltageAcceleratorPedalSensor1 : ActualStatusVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusVoltageAcceleratorPedalSensor2 : ActualStatusVoltageAcceleratorPedalSensor2_Item;
        out item actualVoltageAcceleratorPedalSensor1 : ActualVoltageAcceleratorPedalSensor1_Item;
        out item actualVoltageAcceleratorPedalSensor2 : ActualVoltageAcceleratorPedalSensor2_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor1 : ActualSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor2 : ActualSupplyVoltageAcceleratorPedalSensor2_Item;

        action scaleSupplyVoltages : ScaleSupplyVoltages {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        action compareSupplyVoltagesAgainstAdcReferenceVoltages : CompareSupplyVoltagesAgainstAdcReferenceVoltages {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        action getActivationStatusFromLcmAndCommandThePowerSupply : GetActivationStatusFromLcmAndCommandThePowerSupply {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        action createMeanValuesForAllSignals : CreateMeanValuesForAllSignals {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        action performRedundancyCheckForSensor1Voltage : PerformRedundancyCheckForSensor1Voltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        action performRedundancyCheckForSensor2Voltage : PerformRedundancyCheckForSensor2Voltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        action performLatencyAndJitterDetection : PerformLatencyAndJitterDetection {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        action createMovingAverageForSupplyVoltages : CreateMovingAverageForSupplyVoltages {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }

        fork initialFork;
        fork afterScaleSupplyVoltagesFork;
        fork afterCreateMeanValuesFork;
        join redundancyChecksJoin;
        join finalJoin;

        succession startToInitialFork first start then initialFork;
        succession initialForkToScaleSupplyVoltages first initialFork then scaleSupplyVoltages;
        succession scaleSupplyVoltagesToAfterScaleSupplyVoltagesFork first scaleSupplyVoltages then afterScaleSupplyVoltagesFork;
        succession afterScaleSupplyVoltagesForkToCompareSupplyVoltagesAgainstAdcReferenceVoltages first afterScaleSupplyVoltagesFork then compareSupplyVoltagesAgainstAdcReferenceVoltages;
        succession compareSupplyVoltagesAgainstAdcReferenceVoltagesToFinalJoin first compareSupplyVoltagesAgainstAdcReferenceVoltages then finalJoin;
        succession initialForkToGetActivationStatusFromLcmAndCommandThePowerSupply first initialFork then getActivationStatusFromLcmAndCommandThePowerSupply;
        succession getActivationStatusFromLcmAndCommandThePowerSupplyToFinalJoin first getActivationStatusFromLcmAndCommandThePowerSupply then finalJoin;
        succession initialForkToCreateMeanValuesForAllSignals first initialFork then createMeanValuesForAllSignals;
        succession createMeanValuesForAllSignalsToAfterCreateMeanValuesFork first createMeanValuesForAllSignals then afterCreateMeanValuesFork;
        succession afterCreateMeanValuesForkToPerformRedundancyCheckForSensor1Voltage first afterCreateMeanValuesFork then performRedundancyCheckForSensor1Voltage;
        succession afterCreateMeanValuesForkToPerformRedundancyCheckForSensor2Voltage first afterCreateMeanValuesFork then performRedundancyCheckForSensor2Voltage;
        succession performRedundancyCheckForSensor1VoltageToRedundancyChecksJoin first performRedundancyCheckForSensor1Voltage then redundancyChecksJoin;
        succession performRedundancyCheckForSensor2VoltageToRedundancyChecksJoin first performRedundancyCheckForSensor2Voltage then redundancyChecksJoin;
        succession redundancyChecksJoinToFinalJoin first redundancyChecksJoin then finalJoin;
        succession initialForkToPerformLatencyAndJitterDetection first initialFork then performLatencyAndJitterDetection;
        succession performLatencyAndJitterDetectionToCreateMovingAverageForSupplyVoltages first performLatencyAndJitterDetection then createMovingAverageForSupplyVoltages;
        succession afterScaleSupplyVoltagesForkToCreateMovingAverageForSupplyVoltages first afterScaleSupplyVoltagesFork then createMovingAverageForSupplyVoltages;
        succession createMovingAverageForSupplyVoltagesToFinalJoin first createMovingAverageForSupplyVoltages then finalJoin;
        succession finalJoinToDone first finalJoin then done;

        flow rawSupplyVoltage1ToScaleSupplyVoltages from rawSupplyVoltageAcceleratorPedalSensor1 to scaleSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawSupplyVoltage2ToScaleSupplyVoltages from rawSupplyVoltageAcceleratorPedalSensor2 to scaleSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawSupplyVoltage1ToCompareSupplyVoltages from rawSupplyVoltageAcceleratorPedalSensor1 to compareSupplyVoltagesAgainstAdcReferenceVoltages.rawSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawSupplyVoltage2ToCompareSupplyVoltages from rawSupplyVoltageAcceleratorPedalSensor2 to compareSupplyVoltagesAgainstAdcReferenceVoltages.rawSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusSupplyVoltage1FromCompare from compareSupplyVoltagesAgainstAdcReferenceVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor1 to actualStatusSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusSupplyVoltage2FromCompare from compareSupplyVoltagesAgainstAdcReferenceVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor2 to actualStatusSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusVoltage1FromCompare from compareSupplyVoltagesAgainstAdcReferenceVoltages.actualStatusVoltageAcceleratorPedalSensor1 to actualStatusVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusVoltage2FromCompare from compareSupplyVoltagesAgainstAdcReferenceVoltages.actualStatusVoltageAcceleratorPedalSensor2 to actualStatusVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow acceleratorPedalPowerSupplyStateToGetActivationStatus from acceleratorPedalPowerSupplyState to getActivationStatusFromLcmAndCommandThePowerSupply.acceleratorPedalPowerSupplyState {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow acceleratorPedalDioCtrlFromGetActivationStatus from getActivationStatusFromLcmAndCommandThePowerSupply.acceleratorPedalDioCtrl to acceleratorPedalDioCtrl {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow rawVoltage1ToCreateMeanValues from rawVoltageAcceleratorPedalSensor1 to createMeanValuesForAllSignals.rawVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawVoltage2ToCreateMeanValues from rawVoltageAcceleratorPedalSensor2 to createMeanValuesForAllSignals.rawVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawVoltageRedundant1ToCreateMeanValues from rawVoltageAcceleratorPedalSensorRedundant1 to createMeanValuesForAllSignals.rawVoltageAcceleratorPedalSensorRedundant1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow rawVoltageRedundant2ToCreateMeanValues from rawVoltageAcceleratorPedalSensorRedundant2 to createMeanValuesForAllSignals.rawVoltageAcceleratorPedalSensorRedundant2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow meanValue1ToRedundancyCheck1 from createMeanValuesForAllSignals.meanValueActualVoltageSensor1 to performRedundancyCheckForSensor1Voltage.meanValueActualVoltageSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow meanValue1RedundantToRedundancyCheck1 from createMeanValuesForAllSignals.meanValueActualVoltageSensor1Redundant to performRedundancyCheckForSensor1Voltage.meanValueActualVoltageSensor1Redundant {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow meanValue2ToRedundancyCheck2 from createMeanValuesForAllSignals.meanValueActualVoltageSensor2 to performRedundancyCheckForSensor2Voltage.meanValueActualVoltageSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow meanValue2RedundantToRedundancyCheck2 from createMeanValuesForAllSignals.meanValueActualVoltageSensor2Redundant to performRedundancyCheckForSensor2Voltage.meanValueActualVoltageSensor2Redundant {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusVoltage1FromRedundancyCheck from performRedundancyCheckForSensor1Voltage.actualStatusVoltageAcceleratorPedalSensor1 to actualStatusVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualStatusVoltage2FromRedundancyCheck from performRedundancyCheckForSensor2Voltage.actualStatusVoltageAcceleratorPedalSensor2 to actualStatusVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualVoltage1FromRedundancyCheck from performRedundancyCheckForSensor1Voltage.actualVoltageAcceleratorPedalSensor1 to actualVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualVoltage2FromRedundancyCheck from performRedundancyCheckForSensor2Voltage.actualVoltageAcceleratorPedalSensor2 to actualVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow scaledSupplyVoltage1ToMovingAverage from scaleSupplyVoltages.scaledSupplyVoltage1 to createMovingAverageForSupplyVoltages.scaledSupplyVoltage1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow scaledSupplyVoltage2ToMovingAverage from scaleSupplyVoltages.scaledSupplyVoltage2 to createMovingAverageForSupplyVoltages.scaledSupplyVoltage2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualSupplyVoltage1FromMovingAverage from createMovingAverageForSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor1 to actualSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow actualSupplyVoltage2FromMovingAverage from createMovingAverageForSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor2 to actualSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow adcIsrToLatencyAndJitterDetection from adcIsr to performLatencyAndJitterDetection.adcIsr {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow isrErrorStateToMovingAverage from performLatencyAndJitterDetection.isrErrorState to createMovingAverageForSupplyVoltages.isrErrorState {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
    }

}

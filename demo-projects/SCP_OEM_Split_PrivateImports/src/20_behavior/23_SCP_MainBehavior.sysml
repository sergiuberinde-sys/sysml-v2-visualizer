package SCP_MainBehavior {

    // Cluster behavior: SignalConditioningAndProcessingMain.
    // Cross-package references are resolved through the private imports below.

    // Activity behavior translated from SignalConditioningAndProcessing_acpd_act.
    // Owns action control, object flows, and extracted ASIL annotations.
    private import SCP_Foundation::*;
    private import SCP_MainActionSignatures::*;

    action def SignalConditioningAndProcessingMain {
        out item actualVoltageAcceleratorPedalSensor1 : ActualVoltageAcceleratorPedalSensor1_Item;
        out item actualVoltageAcceleratorPedalSensor2 : ActualVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusVoltageAcceleratorPedalSensor1 : ActualStatusVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusVoltageAcceleratorPedalSensor2 : ActualStatusVoltageAcceleratorPedalSensor2_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor1 : ActualSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualSupplyVoltageAcceleratorPedalSensor2 : ActualSupplyVoltageAcceleratorPedalSensor2_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor1 : ActualStatusSupplyVoltageAcceleratorPedalSensor1_Item;
        out item actualStatusSupplyVoltageAcceleratorPedalSensor2 : ActualStatusSupplyVoltageAcceleratorPedalSensor2_Item;
        in item batterySupply : BatterySupply_Item;
        in item canFlexrayPhysicalSupplyVoltage : CANFlexray_PhysicalSupplyVoltage_Item;
        in item vdd3v3PhysicalSupplyVoltage : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
        in item vdd5dPhysicalSupplyVoltage : VDD5D_PhysicalSupplyVoltage_Item;
        in item ethernetPLCPhysicalSupplyVoltage : ETH_PhysicalSupplyVoltage_Item;
        in item wakeupVBATBusCommPhysicalSupplyVoltage : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
        out item acceleratorPedalPowerSupplyCtrl : AcceleratorPedalPowerSupplyCtrl_Item;
        in item acceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Item;

        action acquireSensorAndSupplyVoltage : AcquireSensorAndSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        action extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware : ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        action processAndQualifySensorAndSupplyVoltages : ProcessAndQualifySensorAndSupplyVoltages {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        action enableDisableThePowerSupply : EnableDisableThePowerSupply {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        action commandDIOToEnableDisablePowerSupply : CommandDIOToEnableDisablePowerSupply {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        action getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine : GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine {
            @ASIL {
                level = ASILLevel::QM;
            }
        }

        fork initialFork;
        join finalJoin;

        succession acquireSensorAndSupplyVoltageToextractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware first acquireSensorAndSupplyVoltage then extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware;
        succession extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardwareToprocessAndQualifySensorAndSupplyVoltages first extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware then processAndQualifySensorAndSupplyVoltages;
        succession startToinitialFork first start then initialFork;
        succession initialForkToacquireSensorAndSupplyVoltage first initialFork then acquireSensorAndSupplyVoltage;
        succession initialForkTogetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine first initialFork then getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine;
        succession getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachineTocommandDIOToEnableDisablePowerSupply first getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine then commandDIOToEnableDisablePowerSupply;
        succession commandDIOToEnableDisablePowerSupplyToenableDisableThePowerSupply first commandDIOToEnableDisablePowerSupply then enableDisableThePowerSupply;
        succession enableDisableThePowerSupplyTofinalJoin first enableDisableThePowerSupply then finalJoin;
        succession processAndQualifySensorAndSupplyVoltagesTofinalJoin first processAndQualifySensorAndSupplyVoltages then finalJoin;
        succession finalJoinTodone first finalJoin then done;

        flow activityObjectFlow_01 from acquireSensorAndSupplyVoltage.digActualMeasAcceleratorPedalSensor to extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.digActualMeasAcceleratorPedalSensor {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_02 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensor1 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_03 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensorRedundant1 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensorRedundant1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_04 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensor2 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_05 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensorRedundant2 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensorRedundant2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_06 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawSupplyVoltageAcceleratorPedalSensor1 to processAndQualifySensorAndSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_07 from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawSupplyVoltageAcceleratorPedalSensor2 to processAndQualifySensorAndSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_08 from processAndQualifySensorAndSupplyVoltages.actualVoltageAcceleratorPedalSensor1 to actualVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_09 from processAndQualifySensorAndSupplyVoltages.actualVoltageAcceleratorPedalSensor2 to actualVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_10 from processAndQualifySensorAndSupplyVoltages.actualStatusVoltageAcceleratorPedalSensor1 to actualStatusVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_11 from processAndQualifySensorAndSupplyVoltages.actualStatusVoltageAcceleratorPedalSensor2 to actualStatusVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_12 from processAndQualifySensorAndSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor1 to actualSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_13 from processAndQualifySensorAndSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor2 to actualSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_14 from processAndQualifySensorAndSupplyVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor1 to actualStatusSupplyVoltageAcceleratorPedalSensor1 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_15 from processAndQualifySensorAndSupplyVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor2 to actualStatusSupplyVoltageAcceleratorPedalSensor2 {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_16 from batterySupply to acquireSensorAndSupplyVoltage.batterySupply {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_17 from canFlexrayPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.canFlexrayPhysicalSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_18 from vdd3v3PhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.vdd3v3PhysicalSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_19 from vdd5dPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.vdd5dPhysicalSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_20 from ethernetPLCPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.ethernetPLCPhysicalSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_21 from wakeupVBATBusCommPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.wakeupVBATBusCommPhysicalSupplyVoltage {
            @ASIL {
                level = ASILLevel::ASIL_C;
            }
        }
        flow activityObjectFlow_22 from acceleratorPedalPowerSupplyState to getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine.acceleratorPedalPowerSupplyState {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow activityObjectFlow_23 from getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine.acceleratorPedalDioCtrl to commandDIOToEnableDisablePowerSupply.acceleratorPedalDioCtrl {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow activityObjectFlow_24 from commandDIOToEnableDisablePowerSupply.acceleratorPedalHwCtrl to enableDisableThePowerSupply.acceleratorPedalHwCtrl {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
        flow activityObjectFlow_25 from enableDisableThePowerSupply.acceleratorPedalPowerSupplyCtrl to acceleratorPedalPowerSupplyCtrl {
            @ASIL {
                level = ASILLevel::QM;
            }
        }
    }

}

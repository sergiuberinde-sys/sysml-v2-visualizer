package SCP_LogicalFunctions {

    // Internal logical-function part definitions, typed ports, and owned performed behaviors.
    // Cross-package references are resolved through the private imports below.

    // Internal logical-function definitions and their XMI-derived port usages.
    // Owned by logical-function architects; no cluster-level connectors are defined here.
    private import SCP_Foundation::*;
    private import SCP_Interfaces::*;
    private import SCP_MainActionSignatures::*;
    private import SCP_AcpdBehavior::*;

    part def AcpdSignalProcessing {
        port AcceleratorPedalPowerSupplyState : ~AcceleratorPedalPowerSupplyState_Port;
        port ActualSupplyVoltageAcceleratorPedal : ActualSupplyVoltageAcceleratorPedal_Port;
        port ActualVoltageAcceleratorPedal : ActualVoltageAcceleratorPedal_Port;
        port RawSupplyVoltageAcceleratorPedalSensor : ~RawSupplyVoltageAcceleratorPedalSensor_Port;
        port RawVoltageAcceleratorSensor : ~RawVoltageAcceleratorSensor_Port;
        port p1 : AcceleratorPedalDioCtrl_Port;

        perform action getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachinePerformed : GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine;
        perform action processAndQualifySensorAndSupplyVoltagesPerformed : ProcessAndQualifySensorAndSupplyVoltages;
        perform action acceleratorPedalSignalProcessingPerformed : AcceleratorPedalSignalProcessing;
    }

    part def InputOutputDriver {
        @Realization {
            kind = RealizationKind::SW;
        }
        port CANFlexray_RawSupplyVoltage : CANFlexray_RawSupplyVoltage_Port;
        port Clamp30OVMeasRawVoltage : Clamp30OVMeasRawVoltage_Port;
        port Clamp30UVMeasRawVoltage : Clamp30UVMeasRawVoltage_Port;
        port DigActualECUVoltagesMeas : ~DigActualECUVoltagesMeas_Port;
        port ETH_RawSupplyVoltage : ETH_RawSupplyVoltage_Port;
        port InterMicrocontrollers_RawSupplyVoltage : InterMicrocontrollers_RawSupplyVoltage_Port;
        port VDD5DRawSupplyVoltage : VDD5DRawSupplyVoltage_Port;
        port WakeupVBATBusComm_RawSupplyVoltage : WakeupVBATBusComm_RawSupplyVoltage_Port;
        port p10 : Trcvs_StandbyPins_RawVoltage_Port;
        port p11 : PortEmergencyStop_PinLevels_Port;
        port p12 : Bandgap_voltage_value_Port;
        port p2 : RawVoltageAcceleratorSensor_Port;
        port p3 : ~DigActualMeasAcceleratorPedal_Port;
        port p5 : RawSupplyVoltageAcceleratorPedalSensor_Port;
        port p7 : ~AcceleratorPedalDioCtrl_Port;
        port p8 : AcceleratorPedalHwCtrl_Port;
        port p9 : ~CAN_Standby_VoltageMeas_Port;

        perform action commandDIOToEnableDisablePowerSupplyPerformed : CommandDIOToEnableDisablePowerSupply;
        perform action extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardwarePerformed : ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware;
    }

    part def OnChipVTSupervision {
        port AlarmSignalInfo : AlarmSignalInfo_Port;
        port ChipExternalSupplyRailsRawVoltages : ChipExternalSupplyRailsRawVoltages_Port;
        port ChipExternalSupplyVoltageRailsThresholdsConfigHw : ~ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port;
        port ChipInternalSupplyRailsRawVoltages : ChipInternalSupplyRailsRawVoltages_Port;
        port ChipInternalSupplyVoltageRailsThresholdsConfigHW : ~ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port;
        port DieTemperaturesThresholdsConfigHW : ~DieTemperaturesThresholdsConfigHW_Port;
        port RawDieTemperatures : RawDieTemperatures_Port;
        port p3 : ~OnChipTemperature_Port;
        port p5 : ~ChipPeripheralSupply_Port;
    }

    part def OnChipVTSupervisionDriver {
        port ActualDieTemperatures : ActualDieTemperatures_Port;
        port ChipExternalSupplyRailsActualVoltages : ChipExternalSupplyRailsActualVoltages_Port;
        port ChipExternalSupplyRailsRawVoltages : ~ChipExternalSupplyRailsRawVoltages_Port;
        port ChipExternalSupplyVoltageRailsThresholdsConfigHw : ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port;
        port ChipInternalSupplyRailsActualVoltages : ChipInternalSupplyRailsActualVoltages_Port;
        port ChipInternalSupplyRailsRawVoltages : ~ChipInternalSupplyRailsRawVoltages_Port;
        port ChipInternalSupplyVoltageRailsThresholdsConfigHW : ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port;
        port ConfigureChipExternalSupplyVoltageRailsThresholds : ~ConfigureChipExternalSupplyVoltageRailsThresholds_Port;
        port ConfigureChipInternalSupplyVoltageRailsThresholds : ~ConfigureChipInternalSupplyVoltageRailsThresholds_Port;
        port ConfigureDieTemperaturesThresholds : ~ConfigureDieTemperaturesThresholds_Port;
        port DieTemperaturesThresholdsConfigHW : DieTemperaturesThresholdsConfigHW_Port;
        port RawDieTemperatures : ~RawDieTemperatures_Port;
    }

    part def SignalConversion {
        @ASIL {
            level = ASILLevel::ASIL_B;
        }
        port BatterySupply_In : ~BatterySupply_In_Port;
        port CANFlexray_PhysicalSupplyVoltage : ~CANFlexray_PhysicalSupplyVoltage_Port;
        port DigActualECUVoltagesMeas : DigActualECUVoltagesMeas_Port;
        port EthernetPLCPhysicalSupplyVoltage : ~EthernetPLCPhysicalSupplyVoltage_Port;
        port VDD3V3PhysicalSupplyVoltage : ~VDD3V3PhysicalSupplyVoltage_Port;
        port VDD5DPhysicalSupplyVoltage : ~VDD5DPhysicalSupplyVoltage_Port;
        port WakeupVBATBusComm_PhysicalSupplyVoltage : ~WakeupVBATBusComm_PhysicalSupplyVoltage_Port;
        port p3 : ~PhysActualVoltageAcceleratorPedalSensor_Port;
        port p4 : DigActualMeasAcceleratorPedal_Port;
        port p5 : ~PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port;
        port p6 : ~AcceleratorPedalHwCtrl_Port;
        port p7 : AcceleratorPedalPowerSupplyCtrl_Port;
        port p8 : ~CAN_Standby_PhysicalVoltage_Port;
        port p9 : CAN_Standby_VoltageMeas_Port;

        perform action acquireSensorAndSupplyVoltagePerformed : AcquireSensorAndSupplyVoltage;
        perform action enableDisableThePowerSupplyPerformed : EnableDisableThePowerSupply;
    }

    part def VoltageTemperatureSignalProcessing {
        port ActualReferenceVoltage : ActualReferenceVoltage_Port;
        port CANFlexray_ActualSupplyVoltage : CANFlexray_ActualSupplyVoltage_Port;
        port CANFlexray_RawSupplyVoltage : ~CANFlexray_RawSupplyVoltage_Port;
        port ChipExternalSupplyRailsActualVoltages : ~ChipExternalSupplyRailsActualVoltages_Port;
        port ChipInternalSupplyRailsActualVoltages : ~ChipInternalSupplyRailsActualVoltages_Port;
        port Clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Port;
        port Clamp30OVMeasRawVoltage : ~Clamp30OVMeasRawVoltage_Port;
        port Clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Port;
        port Clamp30UVMeasRawVoltage : ~Clamp30UVMeasRawVoltage_Port;
        port ETH_ActualSupplyVoltage : ETH_ActualSupplyVoltage_Port;
        port ETH_RawSupplyVoltage : ~ETH_RawSupplyVoltage_Port;
        port InterMicrocontrollers_ActualSupplyVoltage : InterMicrocontrollers_ActualSupplyVoltage_Port;
        port InterMicrocontrollers_RawSupplyVoltage : ~InterMicrocontrollers_RawSupplyVoltage_Port;
        port VDD5DRawSupplyVoltage : ~VDD5DRawSupplyVoltage_Port;
        port VDD5D_ActualSupplyVoltage : VDD5D_ActualSupplyVoltage_Port;
        port WakeupVBATBusComm_ActualSupplyVoltage : WakeupVBATBusComm_ActualSupplyVoltage_Port;
        port WakeupVBATBusComm_RawSupplyVoltage : ~WakeupVBATBusComm_RawSupplyVoltage_Port;
    }

}

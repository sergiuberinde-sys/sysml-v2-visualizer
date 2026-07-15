package SCP_Assembly {

    // Authoritative cluster assembly: boundary ports, parts, FDD-filtered bindings/connections, and allocations.
    // Cross-package references are resolved through the private imports below.

    // Authoritative cluster assembly.
    // Owns boundary ports, contained function usages, FDD-filtered delegation bindings, assembly connections, and allocations.
    private import SCP_Foundation::*;
    private import SCP_Interfaces::*;
    private import SCP_LogicalFunctions::*;
    private import SCP_MainBehavior::*;
    private import SCP_Interactions::*;

    part def BatteryComponent {
        port BattOutPort : BatterySupply_In_Port;
    }

    part def AssemblyTest {
        part battout : BatteryComponent;
        part scp : SignalConditioningAndProcessing;

        connect battout.BattOutPort to scp.BatterySupply_In;
    }

    part def SignalConditioningAndProcessing {

        // Boundary ports owned by SignalConditioningAndProcessing.
        port BatterySupply_In : ~BatterySupply_In_Port;
        port CANFlexray_PhysicalSupplyVoltage : ~CANFlexray_PhysicalSupplyVoltage_Port;
        port VDD3V3PhysicalSupplyVoltage : ~VDD3V3PhysicalSupplyVoltage_Port;
        port VDD5DPhysicalSupplyVoltage : ~VDD5DPhysicalSupplyVoltage_Port;
        port EthernetPLCPhysicalSupplyVoltage : ~EthernetPLCPhysicalSupplyVoltage_Port;
        port WakeupVBATBusComm_PhysicalSupplyVoltage : ~WakeupVBATBusComm_PhysicalSupplyVoltage_Port;
        port Clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Port;
        port CANFlexray_ActualSupplyVoltage : CANFlexray_ActualSupplyVoltage_Port;
        port InterMicrocontrollers_ActualSupplyVoltage : InterMicrocontrollers_ActualSupplyVoltage_Port;
        port VDD5D_ActualSupplyVoltage : VDD5D_ActualSupplyVoltage_Port;
        port ETH_ActualSupplyVoltage : ETH_ActualSupplyVoltage_Port;
        port WakeupVBATBusComm_ActualSupplyVoltage : WakeupVBATBusComm_ActualSupplyVoltage_Port;
        port ActualDieTemperatures : ActualDieTemperatures_Port;
        port ActualReferenceVoltage : ActualReferenceVoltage_Port;
        port ConfigureDieTemperaturesThresholds : ~ConfigureDieTemperaturesThresholds_Port;
        port ConfigureChipExternalSupplyVoltageRailsThresholds : ~ConfigureChipExternalSupplyVoltageRailsThresholds_Port;
        port ConfigureChipInternalSupplyVoltageRailsThresholds : ~ConfigureChipInternalSupplyVoltageRailsThresholds_Port;
        port Clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Port;
        port ChipExternalSupplyRailsActualVoltages : ChipExternalSupplyRailsActualVoltages_Port;
        port ChipInternalSupplyRailsActualVoltages : ChipInternalSupplyRailsActualVoltages_Port;
        port AlarmSignalInfo : AlarmSignalInfo_Port;
        port p21 : ~CAN_Standby_PhysicalVoltage_Port;
        port p22 : Trcvs_StandbyPins_RawVoltage_Port;
        port p23 : PortEmergencyStop_PinLevels_Port;
        port p24 : Bandgap_voltage_value_Port;
        port p25 : PDD_Result_Port;
        port p26 : ~Pulldown_Control_Port;
        port p29 : p29_Port;
        port p30 : ~OnChipTemperature_Port;
        port p31 : ~ChipPeripheralSupply_Port;
        port p32 : ~InterMicrocontrollers_PhysicalSupplyVoltage_Port;
        port p33 : ~ETH_PhysicalSupplyVoltage_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2021x_1_68c018f_1670824403585_757635_1307
        port External_ActualVoltageAcceleratorPedal : ~ActualVoltageAcceleratorPedal_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2021x_1_68c018f_1670824481035_265353_1329
        port External_ActualSupplyVoltageAcceleratorPedal : ~ActualSupplyVoltageAcceleratorPedal_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2021x_1_68c018f_1670824077896_684229_1147
        port External_PhysActualVoltageAcceleratorPedalSensor : PhysActualVoltageAcceleratorPedalSensor_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739450243970_930410_395
        port External_PhysSupplyVoltageAcceleratorPedalSensorChannel1 : PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739803183384_79946_420
        port External_AcceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739790423963_642330_319
        port External_AcceleratorPedalPowerSupplyCtrl : ~AcceleratorPedalPowerSupplyCtrl_Port;

        // Internal logical-function parts.
        part acpdSignalProcessing : AcpdSignalProcessing;
        part signalConversion : SignalConversion;
        part inputOutputDriver : InputOutputDriver;
        @Realization {
            kind = RealizationKind::SW;
        }
        part voltageTemperatureSignalProcessing : VoltageTemperatureSignalProcessing {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        @Realization {
            kind = RealizationKind::SW;
        }
        part onChipVTSupervisionDriver : OnChipVTSupervisionDriver {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }
        @Realization {
            kind = RealizationKind::HW;
        }
        part onChipVTSupervision : OnChipVTSupervision {
            @ASIL {
                level = ASILLevel::ASIL_D;
            }
        }

        perform action mainBehavior : SignalConditioningAndProcessingMain;
        perform action acpdSequence : SignalConditioningAndProcessing_acpd_seq;

        // Swimlane/responsibility allocations generated from UML ActivityPartition::represents.
        allocate mainBehavior.acquireSensorAndSupplyVoltage to signalConversion.acquireSensorAndSupplyVoltagePerformed;
        allocate mainBehavior.extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware to inputOutputDriver.extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardwarePerformed;
        allocate mainBehavior.processAndQualifySensorAndSupplyVoltages to acpdSignalProcessing.processAndQualifySensorAndSupplyVoltagesPerformed;
        allocate mainBehavior.enableDisableThePowerSupply to signalConversion.enableDisableThePowerSupplyPerformed;
        allocate mainBehavior.commandDIOToEnableDisablePowerSupply to inputOutputDriver.commandDIOToEnableDisablePowerSupplyPerformed;
        allocate mainBehavior.getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine to acpdSignalProcessing.getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachinePerformed;

        // Internal and boundary connectors owned by SignalConditioningAndProcessing.
        interface External_ActualVoltageAcceleratorPedalToacpdSignalProcessing_ActualVoltageAcceleratorPedal connect
            External_ActualVoltageAcceleratorPedal to acpdSignalProcessing.ActualVoltageAcceleratorPedal;
        interface c02_connection connect
            acpdSignalProcessing.ActualSupplyVoltageAcceleratorPedal to External_ActualSupplyVoltageAcceleratorPedal;
        interface signalConversion_p3ToExternal_PhysActualVoltageAcceleratorPedalSensor connect
            signalConversion.p3 to External_PhysActualVoltageAcceleratorPedalSensor;
        interface signalConversion_p4ToinputOutputDriver_p3 connect
            signalConversion.p4 to inputOutputDriver.p3;
        interface inputOutputDriver_p2ToacpdSignalProcessing_RawVoltageAcceleratorSensor connect
            inputOutputDriver.p2 to acpdSignalProcessing.RawVoltageAcceleratorSensor;
        interface inputOutputDriver_p5ToacpdSignalProcessing_RawSupplyVoltageAcceleratorPedalSensor connect
            inputOutputDriver.p5 to acpdSignalProcessing.RawSupplyVoltageAcceleratorPedalSensor;
        interface External_PhysSupplyVoltageAcceleratorPedalSensorChannel1TosignalConversion_p5 connect
            External_PhysSupplyVoltageAcceleratorPedalSensorChannel1 to signalConversion.p5;
        interface External_AcceleratorPedalPowerSupplyStateToacpdSignalProcessing_AcceleratorPedalPowerSupplyState connect
            External_AcceleratorPedalPowerSupplyState to acpdSignalProcessing.AcceleratorPedalPowerSupplyState;
        interface signalConversion_p7ToExternal_AcceleratorPedalPowerSupplyCtrl connect
            signalConversion.p7 to External_AcceleratorPedalPowerSupplyCtrl;
        interface acpdSignalProcessing_p1ToinputOutputDriver_p7 connect
            acpdSignalProcessing.p1 to inputOutputDriver.p7;
        interface inputOutputDriver_p8TosignalConversion_p6 connect
            inputOutputDriver.p8 to signalConversion.p6;
        // FDD delegation connector: BatterySupply_InTosignalConversion_BatterySupply_In
        bind BatterySupply_In = signalConversion.BatterySupply_In;
        // FDD delegation connector: CANFlexray_PhysicalSupplyVoltageTosignalConversion_CANFlexray_PhysicalSupplyVoltage
        bind CANFlexray_PhysicalSupplyVoltage = signalConversion.CANFlexray_PhysicalSupplyVoltage;
        // FDD delegation connector: VDD3V3PhysicalSupplyVoltageTosignalConversion_VDD3V3PhysicalSupplyVoltage
        bind VDD3V3PhysicalSupplyVoltage = signalConversion.VDD3V3PhysicalSupplyVoltage;
        // FDD delegation connector: VDD5DPhysicalSupplyVoltageTosignalConversion_VDD5DPhysicalSupplyVoltage
        bind VDD5DPhysicalSupplyVoltage = signalConversion.VDD5DPhysicalSupplyVoltage;
        // FDD delegation connector: EthernetPLCPhysicalSupplyVoltageTosignalConversion_EthernetPLCPhysicalSupplyVoltage
        bind EthernetPLCPhysicalSupplyVoltage = signalConversion.EthernetPLCPhysicalSupplyVoltage;
        // FDD delegation connector: WakeupVBATBusComm_PhysicalSupplyVoltageTosignalConversion_WakeupVBATBusComm_PhysicalSupplyVoltage
        bind WakeupVBATBusComm_PhysicalSupplyVoltage = signalConversion.WakeupVBATBusComm_PhysicalSupplyVoltage;
        // FDD delegation connector: voltageTemperatureSignalProcessing_Clamp30OVMeasActualVoltageToClamp30OVMeasActualVoltage
        bind Clamp30OVMeasActualVoltage = voltageTemperatureSignalProcessing.Clamp30OVMeasActualVoltage;
        // FDD delegation connector: c19_connection
        bind ConfigureChipExternalSupplyVoltageRailsThresholds = onChipVTSupervisionDriver.ConfigureChipExternalSupplyVoltageRailsThresholds;
        // FDD delegation connector: c20_connection
        bind ConfigureChipInternalSupplyVoltageRailsThresholds = onChipVTSupervisionDriver.ConfigureChipInternalSupplyVoltageRailsThresholds;
        // FDD delegation connector: voltageTemperatureSignalProcessing_Clamp30UVMeasActualVoltageToClamp30UVMeasActualVoltage
        bind Clamp30UVMeasActualVoltage = voltageTemperatureSignalProcessing.Clamp30UVMeasActualVoltage;
        // FDD delegation connector: c22_connection
        bind ChipExternalSupplyRailsActualVoltages = onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages;
        // FDD delegation connector: ConfigureDieTemperaturesThresholdsToonChipVTSupervisionDriver_ConfigureDieTemperaturesThresholds
        bind ConfigureDieTemperaturesThresholds = onChipVTSupervisionDriver.ConfigureDieTemperaturesThresholds;
        interface c24_connection connect
            inputOutputDriver.CANFlexray_RawSupplyVoltage to voltageTemperatureSignalProcessing.CANFlexray_RawSupplyVoltage;
        interface c25_connection connect
            inputOutputDriver.Clamp30UVMeasRawVoltage to voltageTemperatureSignalProcessing.Clamp30UVMeasRawVoltage;
        interface c26_connection connect
            inputOutputDriver.Clamp30OVMeasRawVoltage to voltageTemperatureSignalProcessing.Clamp30OVMeasRawVoltage;
        interface c27_connection connect
            inputOutputDriver.InterMicrocontrollers_RawSupplyVoltage to voltageTemperatureSignalProcessing.InterMicrocontrollers_RawSupplyVoltage;
        interface inputOutputDriver_VDD5DRawSupplyVoltageTovoltageTemperatureSignalProcessing_VDD5DRawSupplyVoltage connect
            inputOutputDriver.VDD5DRawSupplyVoltage to voltageTemperatureSignalProcessing.VDD5DRawSupplyVoltage;
        interface inputOutputDriver_ETH_RawSupplyVoltageTovoltageTemperatureSignalProcessing_ETH_RawSupplyVoltage connect
            inputOutputDriver.ETH_RawSupplyVoltage to voltageTemperatureSignalProcessing.ETH_RawSupplyVoltage;
        interface c30_connection connect
            inputOutputDriver.WakeupVBATBusComm_RawSupplyVoltage to voltageTemperatureSignalProcessing.WakeupVBATBusComm_RawSupplyVoltage;
        // FDD delegation connector: c31_connection
        bind WakeupVBATBusComm_ActualSupplyVoltage = voltageTemperatureSignalProcessing.WakeupVBATBusComm_ActualSupplyVoltage;
        // FDD delegation connector: voltageTemperatureSignalProcessing_ETH_ActualSupplyVoltageToETH_ActualSupplyVoltage
        bind ETH_ActualSupplyVoltage = voltageTemperatureSignalProcessing.ETH_ActualSupplyVoltage;
        // FDD delegation connector: voltageTemperatureSignalProcessing_VDD5D_ActualSupplyVoltageToVDD5D_ActualSupplyVoltage
        bind VDD5D_ActualSupplyVoltage = voltageTemperatureSignalProcessing.VDD5D_ActualSupplyVoltage;
        // FDD delegation connector: c34_connection
        bind InterMicrocontrollers_ActualSupplyVoltage = voltageTemperatureSignalProcessing.InterMicrocontrollers_ActualSupplyVoltage;
        // FDD delegation connector: voltageTemperatureSignalProcessing_CANFlexray_ActualSupplyVoltageToCANFlexray_ActualSupplyVoltage
        bind CANFlexray_ActualSupplyVoltage = voltageTemperatureSignalProcessing.CANFlexray_ActualSupplyVoltage;
        interface signalConversion_DigActualECUVoltagesMeasToinputOutputDriver_DigActualECUVoltagesMeas connect
            signalConversion.DigActualECUVoltagesMeas to inputOutputDriver.DigActualECUVoltagesMeas;
        interface onChipVTSupervision_RawDieTemperaturesToonChipVTSupervisionDriver_RawDieTemperatures connect
            onChipVTSupervision.RawDieTemperatures to onChipVTSupervisionDriver.RawDieTemperatures;
        interface c38_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyVoltageRailsThresholdsConfigHw to onChipVTSupervision.ChipExternalSupplyVoltageRailsThresholdsConfigHw;
        interface c39_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyVoltageRailsThresholdsConfigHW to onChipVTSupervision.ChipInternalSupplyVoltageRailsThresholdsConfigHW;
        interface c40_connection connect
            onChipVTSupervision.ChipExternalSupplyRailsRawVoltages to onChipVTSupervisionDriver.ChipExternalSupplyRailsRawVoltages;
        interface c41_connection connect
            onChipVTSupervision.ChipInternalSupplyRailsRawVoltages to onChipVTSupervisionDriver.ChipInternalSupplyRailsRawVoltages;
        // FDD delegation connector: onChipVTSupervision_AlarmSignalInfoToAlarmSignalInfo
        bind AlarmSignalInfo = onChipVTSupervision.AlarmSignalInfo;
        interface c43_connection connect
            onChipVTSupervisionDriver.DieTemperaturesThresholdsConfigHW to onChipVTSupervision.DieTemperaturesThresholdsConfigHW;
        // FDD delegation connector: c45_connection
        bind ChipInternalSupplyRailsActualVoltages = onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages;
        // FDD delegation connector: onChipVTSupervisionDriver_ActualDieTemperaturesToActualDieTemperatures
        bind ActualDieTemperatures = onChipVTSupervisionDriver.ActualDieTemperatures;
        // FDD delegation connector: signalConversion_p8Top21
        bind p21 = signalConversion.p8;
        interface signalConversion_p9ToinputOutputDriver_p9 connect
            signalConversion.p9 to inputOutputDriver.p9;
        // FDD delegation connector: inputOutputDriver_p10Top22
        bind p22 = inputOutputDriver.p10;
        // FDD delegation connector: inputOutputDriver_p11Top23
        bind p23 = inputOutputDriver.p11;
        // FDD delegation connector: inputOutputDriver_p12Top24
        bind p24 = inputOutputDriver.p12;
        // FDD delegation connector: p30ToonChipVTSupervision_p3
        bind p30 = onChipVTSupervision.p3;
        // FDD delegation connector: p31ToonChipVTSupervision_p5
        bind p31 = onChipVTSupervision.p5;
    }

}

package SignalConditioningAndProcessing_XmiResolved {

    /*
     * XMI-resolved reconstruction of the Accelerator Pedal Interface logical cluster
     * SignalConditioningAndProcessing.
     *
     * Source: Functional Architecture Platform(1).xml, MagicDraw UML 2024x v6 export.
     * Target class id: _2024x_1_86c020f_1739133149275_721475_275.
     *
     * Modeling choices in this pass:
     * - The cluster is modeled as one SysML v2 part definition, not split across files.
     * - UML logical-interface classes become port definitions.
     * - UML logical-information signals become item definitions.
     * - UML connectors become interface connect usages.
     * - Boundary ports that have no UML name are named from the connected/internal port type
     *   or from the conveyed information flow where available.
     * - Ports named p22, p23, ... in the XMI are kept as pNN usages and typed using the
     *   resolved/conveyed logical item.
     */

    // Logical information items resolved from SignalConditioningAndProcessing interfaces/flows.
    item def BatterySupply_Item;
    item def CANFlexray_PhysicalSupplyVoltage_Item;
    item def InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    item def VDD5D_PhysicalSupplyVoltage_Item;
    item def ETH_PhysicalSupplyVoltage_Item;
    item def WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
    item def Clamp30OVMeasActualVoltage_Item;
    item def CANFlexRay_ActualSupplyVoltage_Item;
    item def InterMicrocontrollersComm_ActualSupplyVoltage_Item;
    item def VDD5DActualSupplyVoltage_Item;
    item def ETH_ActualSupplyVoltage_Item;
    item def WakeupVBATComm_ActualSupplyVoltage_Item;
    item def ActualDieTemperatures_Item;
    item def ActualReferenceVoltage_Item;
    item def DieTemperaturesThresholdConfig_Item;
    item def ChipExternalVoltageRailsThresholdsConfig_Item;
    item def ChipInternalVoltageRailsThresholdsConfig_Item;
    item def Clamp30UVMeasActualVoltage_Item;
    item def ChipExternalSupplyRailsActualVoltages_Item;
    item def ChipInternalSupplyRailsActualVoltages_Item;
    item def ErrorAlarmSignal_Item;
    item def Trcvs_Standby_RawVoltage_Item;
    item def PortEmergencyStop_PinLevels_Item;
    item def Bandgap_voltage_value_Item;
    item def PDD_Result_Item;
    item def Pulldown_Control_Item;
    item def OnChipTemperature_Item;
    item def PeripheralSupply_Item;
    item def DigActualVoltagesMeas_Item;
    item def CAN_Standby_MeasuredVoltage_Item;
    item def CANFlexray_RawSupplyVoltage_Item;
    item def Clamp30UVMeasRawVoltage_Item;
    item def Clamp30OVMeasRawVoltage_Item;
    item def InterMicrocontrollers_RawSupplyVoltage_Item;
    item def VDD5D_RawSupplyVoltage_Item;
    item def ETH_RawSupplyVoltage_Item;
    item def WakeupVBATBusComm_RawSupplyVoltage_Item;
    item def RawDieTemperatures_Item;
    item def ChipExternalVoltageRailsThresholdsConfigHW_Item;
    item def ChipInternalVoltageRailsThresholdsConfigHW_Item;
    item def ChipExternalSupplyVoltageRails_Item;
    item def ChipInternalSupplyVoltageRails_Item;
    item def DieTemperaturesThresholdConfigHW_Item;

    // Port definitions resolved from logical-interface classes.
    // <html light="true"><body><a href="mdel://_2024x_1_86d01ee_1745739946034_37429_4167" erit:display="NAME" erit:update="AUTOMATIC_UPDATE">BatterySupply_In</a></body></html>
    port def BatterySupply_Port {
        out item payload : BatterySupply_Item;
    }

    // VDD5_DCDC_COM physical supply voltage
    port def CANFlexray_PhysicalSupplyVoltage_Port {
        out item payload : CANFlexray_PhysicalSupplyVoltage_Item;
    }

    port def InterMicrocontrollers_PhysicalSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    }

    port def VDD5D_PhysicalSupplyVoltage_Port {
        out item payload : VDD5D_PhysicalSupplyVoltage_Item;
    }

    port def ETH_PhysicalSupplyVoltage_Port {
        out item payload : ETH_PhysicalSupplyVoltage_Item;
    }

    // VDZ5_PERM phisical supply voltage
    port def WakeupVBATBusComm_PhysicalSupplyVoltage_Port {
        out item payload : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
    }

    // Provides measured value for KL30 overvoltage
    port def Clamp30OVMeasActualVoltage_Port {
        out item payload : Clamp30OVMeasActualVoltage_Item;
    }

    port def CANFlexRay_ActualSupplyVoltage_Port {
        out item payload : CANFlexRay_ActualSupplyVoltage_Item;
    }

    port def InterMicrocontrollersComm_ActualSupplyVoltage_Port {
        inout item payload : InterMicrocontrollersComm_ActualSupplyVoltage_Item;
    }

    port def VDD5DActualSupplyVoltage_Port {
        out item payload : VDD5DActualSupplyVoltage_Item;
    }

    // Provides voltage value for VDD3V3_ETHSW
    port def ETH_ActualSupplyVoltage_Port {
        out item payload : ETH_ActualSupplyVoltage_Item;
    }

    port def WakeupVBATComm_ActualSupplyVoltage_Port {
        inout item payload : WakeupVBATComm_ActualSupplyVoltage_Item;
    }

    // PMS DTS temperature
    port def ActualDieTemperatures_Port {
        out item payload : ActualDieTemperatures_Item;
    }

    // Provides reference voltage
    port def ActualReferenceVoltage_Port {
        out item payload : ActualReferenceVoltage_Item;
    }

    port def DieTemperaturesThresholdConfig_Port {
        inout item payload : DieTemperaturesThresholdConfig_Item;
    }

    port def ChipExternalVoltageRailsThresholdsConfig_Port {
        inout item payload : ChipExternalVoltageRailsThresholdsConfig_Item;
    }

    port def ChipInternalVoltageRailsThresholdsConfig_Port {
        inout item payload : ChipInternalVoltageRailsThresholdsConfig_Item;
    }

    // Provides measured value for KL30 undervoltage
    port def Clamp30UVMeasActualVoltage_Port {
        out item payload : Clamp30UVMeasActualVoltage_Item;
    }

    // Provides the values for external supply voltage rails
    port def ChipExternalSupplyRailsActualVoltages_Port {
        out item payload : ChipExternalSupplyRailsActualVoltages_Item;
    }

    // Provides the values for internal supply voltage rails
    port def ChipInternalSupplyRailsActualVoltages_Port {
        out item payload : ChipInternalSupplyRailsActualVoltages_Item;
    }

    port def ErrorAlarmSignal_Port {
        inout item payload : ErrorAlarmSignal_Item;
    }

    port def Trcvs_Standby_RawVoltage_Port {
        inout item payload : Trcvs_Standby_RawVoltage_Item;
    }

    port def PortEmergencyStop_PinLevels_Port {
        out item payload : PortEmergencyStop_PinLevels_Item;
    }

    port def Bandgap_voltage_value_Port {
        out item payload : Bandgap_voltage_value_Item;
    }

    port def PDD_Result_Port {
        out item payload : PDD_Result_Item;
    }

    port def Pulldown_Control_Port {
        out item payload : Pulldown_Control_Item;
    }

    port def OnChipTemperature_Port {
        out item payload : OnChipTemperature_Item;
    }

    port def PeripheralSupply_Port {
        inout item payload : PeripheralSupply_Item;
    }

    port def BatterySupply_In_Port {
        out item payload : BatterySupply_Item;
    }

    // VDD3V3_LDSVFLEX_UC2  physical supply voltage
    port def VDD3V3PhysicalSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    }

    // VDD5D physical supply voltage
    port def VDD5DPhysicalSupplyVoltage_Port {
        out item payload : VDD5D_PhysicalSupplyVoltage_Item;
    }

    // VDD3V3_ETHSW physical supply voltage
    port def EthernetPLCPhysicalSupplyVoltage_Port {
        out item payload : ETH_PhysicalSupplyVoltage_Item;
    }

    // Digital values for ECU voltages
    port def DigActualECUVoltagesMeas_Port {
        out item payload : DigActualVoltagesMeas_Item;
    }

    port def CAN_Standby_VoltageMeas_Port {
        out item payload : CAN_Standby_MeasuredVoltage_Item;
    }

    // VDD5_DCDC_COM raw supply voltage
    port def CANFlexray_RawSupplyVoltage_Port {
        out item payload : CANFlexray_RawSupplyVoltage_Item;
    }

    // KL30 raw measurement for undervoltage
    port def Clamp30UVMeasRawVoltage_Port {
        out item payload : Clamp30UVMeasRawVoltage_Item;
    }

    // KL30 raw measurement for overvoltage
    port def Clamp30OVMeasRawVoltage_Port {
        out item payload : Clamp30OVMeasRawVoltage_Item;
    }

    // VDD3V3_LDSVFLEX_UC2  raw supply voltage
    port def InterMicrocontrollers_RawSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_RawSupplyVoltage_Item;
    }

    // VDD5D supply voltage raw value
    port def VDD5DRawSupplyVoltage_Port {
        out item payload : VDD5D_RawSupplyVoltage_Item;
    }

    // VDD3V3_ETHSW raw supply voltage
    port def ETH_RawSupplyVoltage_Port {
        out item payload : ETH_RawSupplyVoltage_Item;
    }

    // VDZ5_PERM  raw supply voltage
    port def WakeupVBATBusComm_RawSupplyVoltage_Port {
        out item payload : WakeupVBATBusComm_RawSupplyVoltage_Item;
    }

    // Provides value for VDZ5_PERM
    port def WakeupVBATBusComm_ActualSupplyVoltage_Port {
        out item payload : WakeupVBATComm_ActualSupplyVoltage_Item;
    }

    // Provides voltage value for VDD5D
    port def VDD5D_ActualSupplyVoltage_Port {
        out item payload : VDD5DActualSupplyVoltage_Item;
    }

    // Provides voltage value for VDD3V3_LDSVFLEX_UC2
    port def InterMicrocontrollers_ActualSupplyVoltage_Port {
        out item payload : InterMicrocontrollersComm_ActualSupplyVoltage_Item;
    }

    // Provides voltage value for VDD5_DCDC_COM
    port def CANFlexray_ActualSupplyVoltage_Port {
        out item payload : CANFlexRay_ActualSupplyVoltage_Item;
    }

    // Configure external voltage rails thresholds
    port def ConfigureChipExternalSupplyVoltageRailsThresholds_Port {
        out item payload : ChipExternalVoltageRailsThresholdsConfig_Item;
    }

    // Configure internal voltage rails thresholds
    port def ConfigureChipInternalSupplyVoltageRailsThresholds_Port {
        out item payload : ChipInternalVoltageRailsThresholdsConfig_Item;
    }

    // Configure PMS DTS thresholds
    port def ConfigureDieTemperaturesThresholds_Port {
        out item payload : DieTemperaturesThresholdConfig_Item;
    }

    // PM DTS raw value
    port def RawDieTemperatures_Port {
        out item payload : RawDieTemperatures_Item;
    }

    // HW access to set the thresholds for external voltage rails
    port def ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port {
        out item payload : ChipExternalVoltageRailsThresholdsConfigHW_Item;
    }

    // HW access to set the thresholds for internal voltage rails
    port def ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port {
        out item payload : ChipInternalVoltageRailsThresholdsConfigHW_Item;
    }

    // external supply voltage rails raw values
    port def ChipExternalSupplyRailsRawVoltages_Port {
        out item payload : ChipExternalSupplyVoltageRails_Item;
    }

    // internal supply voltage rails raw values
    port def ChipInternalSupplyRailsRawVoltages_Port {
        out item payload : ChipInternalSupplyVoltageRails_Item;
    }

    // HW access to PMS DTS
    port def DieTemperaturesThresholdsConfigHW_Port {
        out item payload : DieTemperaturesThresholdConfigHW_Item;
    }

    port def AlarmSignalInfo_Port {
        out item payload : ErrorAlarmSignal_Item;
    }

    port def ChipPeripheralSupply_Port {
        out item payload : PeripheralSupply_Item;
    }

    part def SignalConversion {
        // XMI isConjugated=true
        port BatterySupply_In : ~BatterySupply_In_Port;
        // XMI isConjugated=true
        port CANFlexray_PhysicalSupplyVoltage : ~CANFlexray_PhysicalSupplyVoltage_Port;
        // XMI isConjugated=true
        port VDD3V3PhysicalSupplyVoltage : ~VDD3V3PhysicalSupplyVoltage_Port;
        // XMI isConjugated=true
        port VDD5DPhysicalSupplyVoltage : ~VDD5DPhysicalSupplyVoltage_Port;
        // XMI isConjugated=true
        port EthernetPLCPhysicalSupplyVoltage : ~EthernetPLCPhysicalSupplyVoltage_Port;
        // XMI isConjugated=true
        port WakeupVBATBusComm_PhysicalSupplyVoltage : ~WakeupVBATBusComm_PhysicalSupplyVoltage_Port;
        port DigActualECUVoltagesMeas : DigActualECUVoltagesMeas_Port;
        port p9 : CAN_Standby_VoltageMeas_Port;
    }

    part def InputOutputDriver {
        port CANFlexray_RawSupplyVoltage : CANFlexray_RawSupplyVoltage_Port;
        port Clamp30UVMeasRawVoltage : Clamp30UVMeasRawVoltage_Port;
        port Clamp30OVMeasRawVoltage : Clamp30OVMeasRawVoltage_Port;
        port InterMicrocontrollers_RawSupplyVoltage : InterMicrocontrollers_RawSupplyVoltage_Port;
        port VDD5DRawSupplyVoltage : VDD5DRawSupplyVoltage_Port;
        port ETH_RawSupplyVoltage : ETH_RawSupplyVoltage_Port;
        port WakeupVBATBusComm_RawSupplyVoltage : WakeupVBATBusComm_RawSupplyVoltage_Port;
        // XMI isConjugated=true
        port DigActualECUVoltagesMeas : ~DigActualECUVoltagesMeas_Port;
        // XMI isConjugated=true
        port p9 : ~CAN_Standby_VoltageMeas_Port;
    }

    part def VoltageTemperatureSignalProcessing {
        port Clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Port;
        port Clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Port;
        // XMI isConjugated=true
        port CANFlexray_RawSupplyVoltage : ~CANFlexray_RawSupplyVoltage_Port;
        // XMI isConjugated=true
        port Clamp30UVMeasRawVoltage : ~Clamp30UVMeasRawVoltage_Port;
        // XMI isConjugated=true
        port Clamp30OVMeasRawVoltage : ~Clamp30OVMeasRawVoltage_Port;
        // XMI isConjugated=true
        port InterMicrocontrollers_RawSupplyVoltage : ~InterMicrocontrollers_RawSupplyVoltage_Port;
        // XMI isConjugated=true
        port VDD5DRawSupplyVoltage : ~VDD5DRawSupplyVoltage_Port;
        // XMI isConjugated=true
        port ETH_RawSupplyVoltage : ~ETH_RawSupplyVoltage_Port;
        // XMI isConjugated=true
        port WakeupVBATBusComm_RawSupplyVoltage : ~WakeupVBATBusComm_RawSupplyVoltage_Port;
        port WakeupVBATBusComm_ActualSupplyVoltage : WakeupVBATBusComm_ActualSupplyVoltage_Port;
        port ETH_ActualSupplyVoltage : ETH_ActualSupplyVoltage_Port;
        port VDD5D_ActualSupplyVoltage : VDD5D_ActualSupplyVoltage_Port;
        port InterMicrocontrollers_ActualSupplyVoltage : InterMicrocontrollers_ActualSupplyVoltage_Port;
        port CANFlexray_ActualSupplyVoltage : CANFlexray_ActualSupplyVoltage_Port;
        // XMI isConjugated=true
        port ChipExternalSupplyRailsActualVoltages : ~ChipExternalSupplyRailsActualVoltages_Port;
        // XMI isConjugated=true
        port ChipInternalSupplyRailsActualVoltages : ~ChipInternalSupplyRailsActualVoltages_Port;
    }

    part def OnChipVTSupervisionDriver {
        // XMI isConjugated=true
        port ConfigureChipExternalSupplyVoltageRailsThresholds : ~ConfigureChipExternalSupplyVoltageRailsThresholds_Port;
        // XMI isConjugated=true
        port ConfigureChipInternalSupplyVoltageRailsThresholds : ~ConfigureChipInternalSupplyVoltageRailsThresholds_Port;
        port ChipExternalSupplyRailsActualVoltages : ChipExternalSupplyRailsActualVoltages_Port;
        // XMI isConjugated=true
        port ConfigureDieTemperaturesThresholds : ~ConfigureDieTemperaturesThresholds_Port;
        // XMI isConjugated=true
        port RawDieTemperatures : ~RawDieTemperatures_Port;
        port ChipExternalSupplyVoltageRailsThresholdsConfigHw : ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port;
        port ChipInternalSupplyVoltageRailsThresholdsConfigHW : ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port;
        // XMI isConjugated=true
        port ChipExternalSupplyRailsRawVoltages : ~ChipExternalSupplyRailsRawVoltages_Port;
        // XMI isConjugated=true
        port ChipInternalSupplyRailsRawVoltages : ~ChipInternalSupplyRailsRawVoltages_Port;
        port DieTemperaturesThresholdsConfigHW : DieTemperaturesThresholdsConfigHW_Port;
        port ChipInternalSupplyRailsActualVoltages : ChipInternalSupplyRailsActualVoltages_Port;
        port ActualDieTemperatures : ActualDieTemperatures_Port;
    }

    part def OnChipVTSupervision {
        port RawDieTemperatures : RawDieTemperatures_Port;
        // XMI isConjugated=true
        port ChipExternalSupplyVoltageRailsThresholdsConfigHw : ~ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port;
        // XMI isConjugated=true
        port ChipInternalSupplyVoltageRailsThresholdsConfigHW : ~ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port;
        port ChipExternalSupplyRailsRawVoltages : ChipExternalSupplyRailsRawVoltages_Port;
        port ChipInternalSupplyRailsRawVoltages : ChipInternalSupplyRailsRawVoltages_Port;
        port AlarmSignalInfo : AlarmSignalInfo_Port;
        // XMI isConjugated=true
        port DieTemperaturesThresholdsConfigHW : ~DieTemperaturesThresholdsConfigHW_Port;
        // XMI isConjugated=true
        port p3 : ~OnChipTemperature_Port;
        // XMI isConjugated=true
        port p5 : ~ChipPeripheralSupply_Port;
    }




    // Recovered main classifier-behavior action from the earlier XMI handoff.
    // NOTE: In Functional Architecture Platform(1).xml, I can see the ASIL-D voltage/
    // temperature monitoring activity as an ownedBehavior, but I do not see an
    // ownedBehavior or classifierBehavior named exactly SignalConditioningAndProcessing.
    // This main behavior is therefore reconstructed from the earlier handoff evidence,
    // not from newly resolved pins/object flows in the updated XMI.

    item def MainSignalConditioningActivityItem;

    // XMI/handoff action label: Acquire sensor and supply voltages
    action def AcquireSensorAndSupplyVoltages {
        out item output : MainSignalConditioningActivityItem;
    }

    // XMI/handoff action label: Extract digital values for sensor and supply voltages from ADC hardware
    action def ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware {
        in item input : MainSignalConditioningActivityItem;
        out item output : MainSignalConditioningActivityItem;
    }

    // XMI/handoff action label: Process and qualify sensor and supply voltages
    action def ProcessAndQualifySensorAndSupplyVoltages {
        in item input : MainSignalConditioningActivityItem;
        out item output : MainSignalConditioningActivityItem;
    }

    // XMI/handoff action label: Get enable/disable accelerator pedal supply status from system state machine
    action def GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine {
        out item output : MainSignalConditioningActivityItem;
    }

    // XMI/handoff action label: Command DIO to enable/disable power supply
    action def CommandDIOToEnableDisablePowerSupply {
        in item input : MainSignalConditioningActivityItem;
        out item output : MainSignalConditioningActivityItem;
    }

    // XMI/handoff action label: Enable/Disable power supply
    action def EnableDisablePowerSupply {
        in item input : MainSignalConditioningActivityItem;
        out item output : MainSignalConditioningActivityItem;
    }

    action def SignalConditioningAndProcessingMain {
        action acquireSensorAndSupplyVoltages : AcquireSensorAndSupplyVoltages;
        action extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware
            : ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware;
        action processAndQualifySensorAndSupplyVoltages
            : ProcessAndQualifySensorAndSupplyVoltages;

        action getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine
            : GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine;
        action commandDIOToEnableDisablePowerSupply
            : CommandDIOToEnableDisablePowerSupply;
        action enableDisablePowerSupply : EnableDisablePowerSupply;

        succession acquireSensorToExtractDigitalValues first acquireSensorAndSupplyVoltages
            then extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware;

        succession extractDigitalValuesToProcessAndQualify first extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware
            then processAndQualifySensorAndSupplyVoltages;

        succession getSupplyStatusToCommandDIO first getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine
            then commandDIOToEnableDisablePowerSupply;

        succession commandDIOToEnableDisableSupply first commandDIOToEnableDisablePowerSupply
            then enableDisablePowerSupply;

        flow from acquireSensorAndSupplyVoltages.output
            to extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.input;

        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.output
            to processAndQualifySensorAndSupplyVoltages.input;

        flow from getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine.output
            to commandDIOToEnableDisablePowerSupply.input;

        flow from commandDIOToEnableDisablePowerSupply.output
            to enableDisablePowerSupply.input;
    }

    // Activity behavior extracted from the XMI-owned FunML Activity Diagram:
    // SignalConditioningAndProcessing_ASIL_D_VoltageTemperatureMon
    // Activity id: _2024x_1_8c20228_1746556974334_437385_611
    // Diagram id:  _2024x_1_8c20228_1746556974329_188464_610
    //
    // Extraction summary:
    // - 9 CallBehaviorAction nodes
    // - 15 ControlFlow edges
    // - 34 ObjectFlow edges
    // - 20 ActivityParameterNode nodes
    //
    // The XMI does not expose meaningful names/types for the activity parameter
    // nodes. Their flows are preserved here with generic activity input/output
    // item names, while the action labels, pin names, control successions and
    // object-flow topology are taken from the XMI.

    item def VoltageTemperatureMonitoringActivityItem;

    // XMI action label: Acquire supply voltages
    action def AcquireSupplyVoltages {
        in item input : VoltageTemperatureMonitoringActivityItem;
        in item input1 : VoltageTemperatureMonitoringActivityItem;
        in item input2 : VoltageTemperatureMonitoringActivityItem;
        in item input3 : VoltageTemperatureMonitoringActivityItem;
        in item input4 : VoltageTemperatureMonitoringActivityItem;
        in item input6 : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Extract digital values for supply voltages from ADC hardware
    action def ExtractDigitalValuesForSupplyVoltagesFromADCHardware {
        in item input : VoltageTemperatureMonitoringActivityItem;
        out item output1 : VoltageTemperatureMonitoringActivityItem;
        out item output2 : VoltageTemperatureMonitoringActivityItem;
        out item output3 : VoltageTemperatureMonitoringActivityItem;
        out item output4 : VoltageTemperatureMonitoringActivityItem;
        out item output5 : VoltageTemperatureMonitoringActivityItem;
        out item output6 : VoltageTemperatureMonitoringActivityItem;
        out item output7 : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Configure die temperature sensors
    action def ConfigureDieTemperatureSensors {
        in item input : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Convert die temperatures to degree Celsius
    action def ConvertDieTemperaturesToDegreeCelsius {
        in item input : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Acquire die temperatures from DTS sensors
    action def AcquireDieTemperaturesFromDTSSensors {
        in item input : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Convert raw values to properly scaled values
    action def ConvertRawValuesToProperlyScaledValues {
        in item input1 : VoltageTemperatureMonitoringActivityItem;
        in item input2 : VoltageTemperatureMonitoringActivityItem;
        in item input3 : VoltageTemperatureMonitoringActivityItem;
        in item input4 : VoltageTemperatureMonitoringActivityItem;
        in item input5 : VoltageTemperatureMonitoringActivityItem;
        in item input6 : VoltageTemperatureMonitoringActivityItem;
        in item input11 : VoltageTemperatureMonitoringActivityItem;
        out item output1 : VoltageTemperatureMonitoringActivityItem;
        out item output2 : VoltageTemperatureMonitoringActivityItem;
        out item output3 : VoltageTemperatureMonitoringActivityItem;
        out item output4 : VoltageTemperatureMonitoringActivityItem;
        out item output5 : VoltageTemperatureMonitoringActivityItem;
        out item output6 : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Configure external and internal voltage rails
    action def ConfigureExternalAndInternalVoltageRails {
        in item input : VoltageTemperatureMonitoringActivityItem;
        in item input1 : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
        out item output1 : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Monitoring of Chip external and internal supply voltage rails
    action def MonitoringOfChipExternalAndInternalSupplyVoltageRails {
        in item input : VoltageTemperatureMonitoringActivityItem;
        in item input1 : VoltageTemperatureMonitoringActivityItem;
        in item input2 : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    // XMI action label: Monitoring of die temperatures
    action def MonitoringOfDieTemperatures {
        in item input : VoltageTemperatureMonitoringActivityItem;
        in item input1 : VoltageTemperatureMonitoringActivityItem;
        out item output : VoltageTemperatureMonitoringActivityItem;
    }

    action def SignalConditioningAndProcessing_ASIL_D_VoltageTemperatureMon {
        // Generic activity boundary inputs/outputs corresponding to unnamed
        // UML ActivityParameterNodes in the XMI.
        in item activityInput1 : VoltageTemperatureMonitoringActivityItem;
        in item activityInput2 : VoltageTemperatureMonitoringActivityItem;
        in item activityInput3 : VoltageTemperatureMonitoringActivityItem;
        in item activityInput4 : VoltageTemperatureMonitoringActivityItem;
        in item activityInput5 : VoltageTemperatureMonitoringActivityItem;
        in item activityInput6 : VoltageTemperatureMonitoringActivityItem;
        in item activityInputDieTemperatureThresholdConfig : VoltageTemperatureMonitoringActivityItem;
        in item activityInputChipExternalVoltageRailsThresholdConfig : VoltageTemperatureMonitoringActivityItem;
        in item activityInputChipInternalVoltageRailsThresholdConfig : VoltageTemperatureMonitoringActivityItem;
        in item activityInputDieTemperatureAcquisition : VoltageTemperatureMonitoringActivityItem;
        in item activityInputMonitoringSupplyRailsThresholdConfig : VoltageTemperatureMonitoringActivityItem;

        out item activityOutput1 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutput2 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutput3 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutput4 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutput5 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutput6 : VoltageTemperatureMonitoringActivityItem;
        out item activityOutputConvertedReference : VoltageTemperatureMonitoringActivityItem;
        out item activityOutputConvertedDieTemperature : VoltageTemperatureMonitoringActivityItem;
        out item activityOutputMonitoringResult : VoltageTemperatureMonitoringActivityItem;

        action acquireSupplyVoltages : AcquireSupplyVoltages;
        action extractDigitalValuesForSupplyVoltagesFromADCHardware : ExtractDigitalValuesForSupplyVoltagesFromADCHardware;
        action configureDieTemperatureSensors : ConfigureDieTemperatureSensors;
        action convertDieTemperaturesToDegreeCelsius : ConvertDieTemperaturesToDegreeCelsius;
        action acquireDieTemperaturesFromDTSSensors : AcquireDieTemperaturesFromDTSSensors;
        action convertRawValuesToProperlyScaledValues : ConvertRawValuesToProperlyScaledValues;
        action configureExternalAndInternalVoltageRails : ConfigureExternalAndInternalVoltageRails;
        action monitoringOfChipExternalAndInternalSupplyVoltageRails : MonitoringOfChipExternalAndInternalSupplyVoltageRails;
        action monitoringOfDieTemperatures : MonitoringOfDieTemperatures;

        // Control-flow topology translated from UML ControlFlow edges.
        // The XMI has an InitialNode and two ForkNodes. These are represented
        // here by independent start actions plus explicit action-to-action
        // successions, avoiding non-portable pseudo initial/fork action syntax.
        succession acquireSupplyVoltagesToExtractDigitalValues first acquireSupplyVoltages
            then extractDigitalValuesForSupplyVoltagesFromADCHardware;
        succession extractDigitalValuesToConvertRawValues first extractDigitalValuesForSupplyVoltagesFromADCHardware
            then convertRawValuesToProperlyScaledValues;
        succession extractDigitalValuesToConvertDieTemperatures first extractDigitalValuesForSupplyVoltagesFromADCHardware
            then convertDieTemperaturesToDegreeCelsius;
        succession configureDieTemperatureSensorsToMonitoringOfDieTemperatures first configureDieTemperatureSensors
            then monitoringOfDieTemperatures;
        succession configureVoltageRailsToMonitoringOfSupplyRails first configureExternalAndInternalVoltageRails
            then monitoringOfChipExternalAndInternalSupplyVoltageRails;

        // Object-flow topology translated from UML ObjectFlow edges.
        flow from activityInput1 to acquireSupplyVoltages.input;
        flow from activityInput2 to acquireSupplyVoltages.input1;
        flow from activityInput3 to acquireSupplyVoltages.input2;
        flow from activityInput4 to acquireSupplyVoltages.input3;
        flow from activityInput5 to acquireSupplyVoltages.input4;
        flow from activityInput6 to acquireSupplyVoltages.input6;
        flow from acquireSupplyVoltages.output to extractDigitalValuesForSupplyVoltagesFromADCHardware.input;

        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output1 to convertRawValuesToProperlyScaledValues.input1;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output2 to convertRawValuesToProperlyScaledValues.input2;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output3 to convertRawValuesToProperlyScaledValues.input3;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output4 to convertRawValuesToProperlyScaledValues.input4;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output5 to convertRawValuesToProperlyScaledValues.input5;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output6 to convertRawValuesToProperlyScaledValues.input6;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.output7 to convertRawValuesToProperlyScaledValues.input11;

        flow from convertRawValuesToProperlyScaledValues.output1 to activityOutput1;
        flow from convertRawValuesToProperlyScaledValues.output2 to activityOutput2;
        flow from convertRawValuesToProperlyScaledValues.output3 to activityOutput3;
        flow from convertRawValuesToProperlyScaledValues.output4 to activityOutput4;
        flow from convertRawValuesToProperlyScaledValues.output5 to activityOutput5;
        flow from convertRawValuesToProperlyScaledValues.output6 to activityOutput6;
        flow from convertRawValuesToProperlyScaledValues.output to activityOutputConvertedReference;

        flow from activityInputDieTemperatureThresholdConfig to configureDieTemperatureSensors.input;
        flow from configureDieTemperatureSensors.output to monitoringOfDieTemperatures.input;

        flow from activityInputChipExternalVoltageRailsThresholdConfig to configureExternalAndInternalVoltageRails.input;
        flow from activityInputChipInternalVoltageRailsThresholdConfig to configureExternalAndInternalVoltageRails.input1;
        flow from configureExternalAndInternalVoltageRails.output to monitoringOfChipExternalAndInternalSupplyVoltageRails.input;
        flow from configureExternalAndInternalVoltageRails.output1 to monitoringOfChipExternalAndInternalSupplyVoltageRails.input1;
        flow from activityInputMonitoringSupplyRailsThresholdConfig to monitoringOfChipExternalAndInternalSupplyVoltageRails.input2;

        flow from activityInputDieTemperatureAcquisition to acquireDieTemperaturesFromDTSSensors.input;
        flow from acquireDieTemperaturesFromDTSSensors.output to convertDieTemperaturesToDegreeCelsius.input;
        flow from convertDieTemperaturesToDegreeCelsius.output to activityOutputConvertedDieTemperature;
        flow from activityInputDieTemperatureAcquisition to monitoringOfDieTemperatures.input1;

        flow from monitoringOfChipExternalAndInternalSupplyVoltageRails.output to activityOutputMonitoringResult;
        flow from monitoringOfDieTemperatures.output to activityOutputMonitoringResult;
    }

    part def SignalConditioningAndProcessing {

        // Boundary ports owned by SignalConditioningAndProcessing.
        // XMI port has no explicit name; resolved candidate(s): BatterySupply, BatterySupply_In
        port BatterySupply : BatterySupply_Port;
        // XMI port has no explicit name; resolved candidate(s): CANFlexray_PhysicalSupplyVoltage
        port CANFlexray_PhysicalSupplyVoltage : CANFlexray_PhysicalSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): InterMicrocontrollers_PhysicalSupplyVoltage, VDD3V3PhysicalSupplyVoltage
        port InterMicrocontrollers_PhysicalSupplyVoltage : InterMicrocontrollers_PhysicalSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): VDD5D_PhysicalSupplyVoltage, VDD5DPhysicalSupplyVoltage
        port VDD5D_PhysicalSupplyVoltage : VDD5D_PhysicalSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): ETH_PhysicalSupplyVoltage, EthernetPLCPhysicalSupplyVoltage
        port ETH_PhysicalSupplyVoltage : ETH_PhysicalSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): WakeupVBATBusComm_PhysicalSupplyVoltage
        port WakeupVBATBusComm_PhysicalSupplyVoltage : WakeupVBATBusComm_PhysicalSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): Clamp30OVMeasActualVoltage
        port Clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): CANFlexRay_ActualSupplyVoltage, CANFlexray_ActualSupplyVoltage
        port CANFlexRay_ActualSupplyVoltage : CANFlexRay_ActualSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): InterMicrocontrollersComm _ActualSupplyVoltage, InterMicrocontrollers_ActualSupplyVoltage
        port InterMicrocontrollersComm_ActualSupplyVoltage : InterMicrocontrollersComm_ActualSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): VDD5DActualSupplyVoltage, VDD5D_ActualSupplyVoltage
        port VDD5DActualSupplyVoltage : VDD5DActualSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): ETH_ActualSupplyVoltage
        port ETH_ActualSupplyVoltage : ETH_ActualSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): WakeupVBATComm_ActualSupplyVoltage, WakeupVBATBusComm_ActualSupplyVoltage
        port WakeupVBATComm_ActualSupplyVoltage : WakeupVBATComm_ActualSupplyVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): ActualDieTemperatures
        port ActualDieTemperatures : ActualDieTemperatures_Port;
        // XMI port has no explicit name; resolved candidate(s): ActualReferenceVoltage
        port ActualReferenceVoltage : ActualReferenceVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): DieTemperaturesThresholdConfig, ConfigureDieTemperaturesThresholds
        port DieTemperaturesThresholdConfig : DieTemperaturesThresholdConfig_Port;
        // XMI port has no explicit name; resolved candidate(s): ChipExternalVoltageRailsThresholdsConfig, ConfigureChipExternalSupplyVoltageRailsThresholds
        port ChipExternalVoltageRailsThresholdsConfig : ChipExternalVoltageRailsThresholdsConfig_Port;
        // XMI port has no explicit name; resolved candidate(s): ChipInternalVoltageRailsThresholdsConfig, ConfigureChipInternalSupplyVoltageRailsThresholds
        port ChipInternalVoltageRailsThresholdsConfig : ChipInternalVoltageRailsThresholdsConfig_Port;
        // XMI port has no explicit name; resolved candidate(s): Clamp30UVMeasActualVoltage
        port Clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Port;
        // XMI port has no explicit name; resolved candidate(s): ChipExternalSupplyRailsActualVoltages
        port ChipExternalSupplyRailsActualVoltages : ChipExternalSupplyRailsActualVoltages_Port;
        // XMI port has no explicit name; resolved candidate(s): ChipInternalSupplyRailsActualVoltages
        port ChipInternalSupplyRailsActualVoltages : ChipInternalSupplyRailsActualVoltages_Port;
        // XMI port has no explicit name; resolved candidate(s): ErrorAlarmSignal, AlarmSignalInfo
        port ErrorAlarmSignal : ErrorAlarmSignal_Port;
        // XMI port name: p22; resolved candidate(s): Trcvs_Standby_RawVoltage
        port p22 : Trcvs_Standby_RawVoltage_Port;
        // XMI port name: p23; resolved candidate(s): PortEmergencyStop_PinLevels
        port p23 : PortEmergencyStop_PinLevels_Port;
        // XMI port name: p24; resolved candidate(s): Bandgap_voltage_value
        port p24 : Bandgap_voltage_value_Port;
        // XMI port name: p25; resolved candidate(s): PDD_Result
        port p25 : PDD_Result_Port;
        // XMI port name: p26; resolved candidate(s): Pulldown_Control
        port p26 : Pulldown_Control_Port;
        // XMI port name: p30; resolved candidate(s): OnChipTemperature
        port p30 : OnChipTemperature_Port;
        // XMI port name: p31; resolved candidate(s): PeripheralSupply, ChipPeripheralSupply
        port p31 : PeripheralSupply_Port;
        // XMI port name: p32; resolved candidate(s): InterMicrocontrollers_PhysicalSupplyVoltage
        port p32 : InterMicrocontrollers_PhysicalSupplyVoltage_Port;
        // XMI port name: p33; resolved candidate(s): ETH_PhysicalSupplyVoltage
        port p33 : ETH_PhysicalSupplyVoltage_Port;

        // Internal logical-function parts owned by the cluster in this XMI.
        part signalConversion : SignalConversion;
        part inputOutputDriver : InputOutputDriver;
        part voltageTemperatureSignalProcessing : VoltageTemperatureSignalProcessing;
        part onChipVTSupervisionDriver : OnChipVTSupervisionDriver;
        part onChipVTSupervision : OnChipVTSupervision;

        perform action mainBehavior : SignalConditioningAndProcessingMain;
        perform action voltageTemperatureMonitoring : SignalConditioningAndProcessing_ASIL_D_VoltageTemperatureMon;


        // Swimlane/responsibility allocations for the action-view renderer.
        // MagicDraw swimlanes are represented semantically as SysML v2 allocations
        // from nested action usages to the responsible internal logical-function part.
        // For this ASIL-D activity export, the UML ActivityPartition elements exist,
        // but the exported partitions do not carry usable represents/node membership;
        // these allocations are therefore inferred from the action labels and the
        // existing logical-function decomposition.
        allocate voltageTemperatureMonitoring.acquireSupplyVoltages
            to signalConversion;
        allocate voltageTemperatureMonitoring.extractDigitalValuesForSupplyVoltagesFromADCHardware
            to inputOutputDriver;
        allocate voltageTemperatureMonitoring.convertRawValuesToProperlyScaledValues
            to voltageTemperatureSignalProcessing;
        allocate voltageTemperatureMonitoring.monitoringOfChipExternalAndInternalSupplyVoltageRails
            to voltageTemperatureSignalProcessing;
        allocate voltageTemperatureMonitoring.configureDieTemperatureSensors
            to onChipVTSupervisionDriver;
        allocate voltageTemperatureMonitoring.configureExternalAndInternalVoltageRails
            to onChipVTSupervisionDriver;
        allocate voltageTemperatureMonitoring.acquireDieTemperaturesFromDTSSensors
            to onChipVTSupervisionDriver;
        allocate voltageTemperatureMonitoring.convertDieTemperaturesToDegreeCelsius
            to onChipVTSupervisionDriver;
        allocate voltageTemperatureMonitoring.monitoringOfDieTemperatures
            to voltageTemperatureSignalProcessing;

        // Internal and delegation connectors resolved from UML ownedConnector elements.
        interface batterySupply_to_BatterySupply_In_connection connect
            BatterySupply
                to signalConversion.BatterySupply_In;

        interface cANFlexray_PhysicalSupplyVoltage_to_CANFlexray_PhysicalSupplyVoltage_connection connect
            CANFlexray_PhysicalSupplyVoltage
                to signalConversion.CANFlexray_PhysicalSupplyVoltage;

        interface interMicrocontrollers_PhysicalSupplyVoltage_to_VDD3V3PhysicalSupplyVoltage_connection connect
            InterMicrocontrollers_PhysicalSupplyVoltage
                to signalConversion.VDD3V3PhysicalSupplyVoltage;

        interface vDD5D_PhysicalSupplyVoltage_to_VDD5DPhysicalSupplyVoltage_connection connect
            VDD5D_PhysicalSupplyVoltage
                to signalConversion.VDD5DPhysicalSupplyVoltage;

        interface eTH_PhysicalSupplyVoltage_to_EthernetPLCPhysicalSupplyVoltage_connection connect
            ETH_PhysicalSupplyVoltage
                to signalConversion.EthernetPLCPhysicalSupplyVoltage;

        interface wakeupVBATBusComm_PhysicalSupplyVoltage_to_WakeupVBATBusComm_PhysicalSupplyVoltage_connection connect
            WakeupVBATBusComm_PhysicalSupplyVoltage
                to signalConversion.WakeupVBATBusComm_PhysicalSupplyVoltage;

        interface clamp30OVMeasActualVoltage_to_Clamp30OVMeasActualVoltage_connection connect
            voltageTemperatureSignalProcessing.Clamp30OVMeasActualVoltage
                to Clamp30OVMeasActualVoltage;

        interface chipExternalVoltageRailsThresholdsConfig_to_ConfigureChipExternalSupplyVoltageRailsThresholds_connection connect
            ChipExternalVoltageRailsThresholdsConfig
                to onChipVTSupervisionDriver.ConfigureChipExternalSupplyVoltageRailsThresholds;

        interface chipInternalVoltageRailsThresholdsConfig_to_ConfigureChipInternalSupplyVoltageRailsThresholds_connection connect
            ChipInternalVoltageRailsThresholdsConfig
                to onChipVTSupervisionDriver.ConfigureChipInternalSupplyVoltageRailsThresholds;

        interface clamp30UVMeasActualVoltage_to_Clamp30UVMeasActualVoltage_connection connect
            voltageTemperatureSignalProcessing.Clamp30UVMeasActualVoltage
                to Clamp30UVMeasActualVoltage;

        interface chipExternalSupplyRailsActualVoltages_to_ChipExternalSupplyRailsActualVoltages_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages
                to ChipExternalSupplyRailsActualVoltages;

        interface dieTemperaturesThresholdConfig_to_ConfigureDieTemperaturesThresholds_connection connect
            DieTemperaturesThresholdConfig
                to onChipVTSupervisionDriver.ConfigureDieTemperaturesThresholds;

        interface cANFlexray_RawSupplyVoltage_to_CANFlexray_RawSupplyVoltage_connection connect
            inputOutputDriver.CANFlexray_RawSupplyVoltage
                to voltageTemperatureSignalProcessing.CANFlexray_RawSupplyVoltage;

        interface clamp30UVMeasRawVoltage_to_Clamp30UVMeasRawVoltage_connection connect
            inputOutputDriver.Clamp30UVMeasRawVoltage
                to voltageTemperatureSignalProcessing.Clamp30UVMeasRawVoltage;

        interface clamp30OVMeasRawVoltage_to_Clamp30OVMeasRawVoltage_connection connect
            inputOutputDriver.Clamp30OVMeasRawVoltage
                to voltageTemperatureSignalProcessing.Clamp30OVMeasRawVoltage;

        interface interMicrocontrollers_RawSupplyVoltage_to_InterMicrocontrollers_RawSupplyVoltage_connection connect
            inputOutputDriver.InterMicrocontrollers_RawSupplyVoltage
                to voltageTemperatureSignalProcessing.InterMicrocontrollers_RawSupplyVoltage;

        interface vDD5DRawSupplyVoltage_to_VDD5DRawSupplyVoltage_connection connect
            inputOutputDriver.VDD5DRawSupplyVoltage
                to voltageTemperatureSignalProcessing.VDD5DRawSupplyVoltage;

        interface eTH_RawSupplyVoltage_to_ETH_RawSupplyVoltage_connection connect
            inputOutputDriver.ETH_RawSupplyVoltage
                to voltageTemperatureSignalProcessing.ETH_RawSupplyVoltage;

        interface wakeupVBATBusComm_RawSupplyVoltage_to_WakeupVBATBusComm_RawSupplyVoltage_connection connect
            inputOutputDriver.WakeupVBATBusComm_RawSupplyVoltage
                to voltageTemperatureSignalProcessing.WakeupVBATBusComm_RawSupplyVoltage;

        interface wakeupVBATBusComm_ActualSupplyVoltage_to_WakeupVBATComm_ActualSupplyVoltage_connection connect
            voltageTemperatureSignalProcessing.WakeupVBATBusComm_ActualSupplyVoltage
                to WakeupVBATComm_ActualSupplyVoltage;

        interface eTH_ActualSupplyVoltage_to_ETH_ActualSupplyVoltage_connection connect
            voltageTemperatureSignalProcessing.ETH_ActualSupplyVoltage
                to ETH_ActualSupplyVoltage;

        interface vDD5D_ActualSupplyVoltage_to_VDD5DActualSupplyVoltage_connection connect
            voltageTemperatureSignalProcessing.VDD5D_ActualSupplyVoltage
                to VDD5DActualSupplyVoltage;

        interface interMicrocontrollers_ActualSupplyVoltage_to_InterMicrocontrollersComm_ActualSupplyVoltage_connection connect
            voltageTemperatureSignalProcessing.InterMicrocontrollers_ActualSupplyVoltage
                to InterMicrocontrollersComm_ActualSupplyVoltage;

        interface cANFlexray_ActualSupplyVoltage_to_CANFlexRay_ActualSupplyVoltage_connection connect
            voltageTemperatureSignalProcessing.CANFlexray_ActualSupplyVoltage
                to CANFlexRay_ActualSupplyVoltage;

        interface digActualECUVoltagesMeas_to_DigActualECUVoltagesMeas_connection connect
            signalConversion.DigActualECUVoltagesMeas
                to inputOutputDriver.DigActualECUVoltagesMeas;

        interface rawDieTemperatures_to_RawDieTemperatures_connection connect
            onChipVTSupervision.RawDieTemperatures
                to onChipVTSupervisionDriver.RawDieTemperatures;

        interface chipExternalSupplyVoltageRailsThresholdsConfigHw_to_ChipExternalSupplyVoltageRailsThresholdsConfigHw_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyVoltageRailsThresholdsConfigHw
                to onChipVTSupervision.ChipExternalSupplyVoltageRailsThresholdsConfigHw;

        interface chipInternalSupplyVoltageRailsThresholdsConfigHW_to_ChipInternalSupplyVoltageRailsThresholdsConfigHW_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyVoltageRailsThresholdsConfigHW
                to onChipVTSupervision.ChipInternalSupplyVoltageRailsThresholdsConfigHW;

        interface chipExternalSupplyRailsRawVoltages_to_ChipExternalSupplyRailsRawVoltages_connection connect
            onChipVTSupervision.ChipExternalSupplyRailsRawVoltages
                to onChipVTSupervisionDriver.ChipExternalSupplyRailsRawVoltages;

        interface chipInternalSupplyRailsRawVoltages_to_ChipInternalSupplyRailsRawVoltages_connection connect
            onChipVTSupervision.ChipInternalSupplyRailsRawVoltages
                to onChipVTSupervisionDriver.ChipInternalSupplyRailsRawVoltages;

        interface alarmSignalInfo_to_ErrorAlarmSignal_connection connect
            onChipVTSupervision.AlarmSignalInfo
                to ErrorAlarmSignal;

        interface dieTemperaturesThresholdsConfigHW_to_DieTemperaturesThresholdsConfigHW_connection connect
            onChipVTSupervisionDriver.DieTemperaturesThresholdsConfigHW
                to onChipVTSupervision.DieTemperaturesThresholdsConfigHW;

        interface chipInternalSupplyRailsActualVoltages_to_ChipInternalSupplyRailsActualVoltages_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages
                to ChipInternalSupplyRailsActualVoltages;

        interface actualDieTemperatures_to_ActualDieTemperatures_connection connect
            onChipVTSupervisionDriver.ActualDieTemperatures
                to ActualDieTemperatures;

        interface chipExternalSupplyRailsActualVoltages_to_ChipExternalSupplyRailsActualVoltages_connection_2 connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages
                to voltageTemperatureSignalProcessing.ChipExternalSupplyRailsActualVoltages;

        interface chipInternalSupplyRailsActualVoltages_to_ChipInternalSupplyRailsActualVoltages_connection_2 connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages
                to voltageTemperatureSignalProcessing.ChipInternalSupplyRailsActualVoltages;

        // XMI InformationFlow conveyed: CAN_Standby_MeasuredVoltage
        interface p9_to_p9_connection connect
            signalConversion.p9
                to inputOutputDriver.p9;

        interface p30_to_p3_connection connect
            p30
                to onChipVTSupervision.p3;

        interface p31_to_p5_connection connect
            p31
                to onChipVTSupervision.p5;

    }

}

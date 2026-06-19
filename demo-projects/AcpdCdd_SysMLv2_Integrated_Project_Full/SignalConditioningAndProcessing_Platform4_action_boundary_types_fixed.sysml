package SignalConditioningAndProcessing_XmiResolved {

    /*
     * XMI-resolved reconstruction of the Accelerator Pedal Interface logical cluster
     * SignalConditioningAndProcessing.
     *
     * Source: Functional Architecture Platform_4.xml, MagicDraw UML 2024x v6 export.
     * Target class id: _2024x_1_86c020f_1739133149275_721475_275.
     *
     * Modeling choices kept from the previous pass:
     * - Single SysML v2 file; no multi-file split.
     * - UML logical-interface classes become port definitions.
     * - UML logical-information signals / referenced signal names become item definitions.
     * - Conjugated UML ports are represented as SysML v2 ~PortDef usages.
     * - UML connectors become interface connect usages.
     * - The action view uses native SysML v2 start/fork/join/done control notation.
     * - Activity boundary items are modeled directly, not by synthetic activity input/output actions.
     * - Swimlanes/activity partitions are represented by action-to-performed-action allocations.
     */

    // Logical information item definitions.
    item def AcceleratorPedalDioCtrl_Item;
    item def AcceleratorPedalHwCtrl_Item;
    item def AcceleratorPedalPowerSupplyCtrl_Item;
    item def AcceleratorPedalPowerSupplyState_Item;
    item def ActualDieTemperatures_Item;
    item def ActualReferenceVoltage_Item;
    item def ActualStatusSupplyVoltageAcceleratorPedalSensor1_Item;
    item def ActualStatusSupplyVoltageAcceleratorPedalSensor2_Item;
    item def ActualStatusVoltageAcceleratorPedalSensor1_Item;
    item def ActualStatusVoltageAcceleratorPedalSensor2_Item;
    item def ActualSupplyVoltageAcceleratorPedalSensor1_Item;
    item def ActualSupplyVoltageAcceleratorPedalSensor2_Item;
    item def ActualSupplyVoltageAcceleratorPedal_Item;
    item def ActualVoltageAcceleratorPedalSensor1_Item;
    item def ActualVoltageAcceleratorPedalSensor2_Item;
    item def ActualVoltageAcceleratorPedal_Item;
    item def Bandgap_voltage_value_Item;
    item def BatterySupply_Item;
    item def CANFlexRay_ActualSupplyVoltage_Item;
    item def CANFlexray_PhysicalSupplyVoltage_Item;
    item def CANFlexray_RawSupplyVoltage_Item;
    item def CAN_Standby_MeasuredVoltage_Item;
    item def ChipExternalSupplyRailsActualVoltages_Item;
    item def ChipExternalSupplyVoltageRails_Item;
    item def ChipExternalVoltageRailsThresholdsConfigHW_Item;
    item def ChipExternalVoltageRailsThresholdsConfig_Item;
    item def ChipInternalSupplyRailsActualVoltages_Item;
    item def ChipInternalSupplyVoltageRails_Item;
    item def ChipInternalVoltageRailsThresholdsConfigHW_Item;
    item def ChipInternalVoltageRailsThresholdsConfig_Item;
    item def Clamp30OVMeasActualVoltage_Item;
    item def Clamp30OVMeasRawVoltage_Item;
    item def Clamp30UVMeasActualVoltage_Item;
    item def Clamp30UVMeasRawVoltage_Item;
    item def DieTemperaturesThresholdConfigHW_Item;
    item def DieTemperaturesThresholdConfig_Item;
    item def DigActualMeasAcceleratorPedalSensor_Item;
    item def DigActualMeasAcceleratorPedal_Item;
    item def DigActualVoltagesMeas_Item;
    item def ETH_ActualSupplyVoltage_Item;
    item def ETH_PhysicalSupplyVoltage_Item;
    item def ETH_RawSupplyVoltage_Item;
    item def ErrorAlarmSignal_Item;
    item def InterMicrocontrollersComm_ActualSupplyVoltage_Item;
    item def InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    item def InterMicrocontrollers_RawSupplyVoltage_Item;
    item def OnChipTemperature_Item;
    item def PDD_Result_Item;
    item def PeripheralSupply_Item;
    item def PhysActualVoltageAcceleratorPedalSensor_Item;
    item def PhysSupplyVoltageAcceleratorPedalSensorChannel1_Item;
    item def PortEmergencyStop_PinLevels_Item;
    item def Pulldown_Control_Item;
    item def RawDieTemperatures_Item;
    item def RawSupplyVoltageAcceleratorPedalSensor1_Item;
    item def RawSupplyVoltageAcceleratorPedalSensor2_Item;
    item def RawSupplyVoltageAcceleratorPedalSensor_Item;
    item def RawVoltageAcceleratorPedalSensor1_Item;
    item def RawVoltageAcceleratorPedalSensor2_Item;
    item def RawVoltageAcceleratorPedalSensorRedundant1_Item;
    item def RawVoltageAcceleratorPedalSensorRedundant2_Item;
    item def RawVoltageAcceleratorSensor_Item;
    item def Trcvs_Standby_RawVoltage_Item;
    item def Trcvs_Standby_VoltageValue_Item;
    item def VDD5DActualSupplyVoltage_Item;
    item def VDD5D_PhysicalSupplyVoltage_Item;
    item def VDD5D_RawSupplyVoltage_Item;
    item def WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
    item def WakeupVBATBusComm_RawSupplyVoltage_Item;
    item def WakeupVBATComm_ActualSupplyVoltage_Item;
    item def p29_Item;

    // Logical interface port definitions.
    port def AcceleratorPedalDioCtrl_Port {
        out item payload : AcceleratorPedalDioCtrl_Item;
    }

    port def AcceleratorPedalHwCtrl_Port {
        out item payload : AcceleratorPedalHwCtrl_Item;
    }

    port def AcceleratorPedalPowerSupplyCtrl_Port {
        out item payload : AcceleratorPedalPowerSupplyCtrl_Item;
    }

    port def AcceleratorPedalPowerSupplyState_Port {
        out item payload : AcceleratorPedalPowerSupplyState_Item;
    }

    port def ActualDieTemperatures_Port {
        out item payload : ActualDieTemperatures_Item;
    }

    port def ActualReferenceVoltage_Port {
        out item payload : ActualReferenceVoltage_Item;
    }

    port def ActualSupplyVoltageAcceleratorPedal_Port {
        out item payload : ActualSupplyVoltageAcceleratorPedal_Item;
    }

    port def ActualVoltageAcceleratorPedal_Port {
        out item payload : ActualVoltageAcceleratorPedal_Item;
    }

    port def AlarmSignalInfo_Port {
        out item payload : ErrorAlarmSignal_Item;
    }

    port def Bandgap_voltage_value_Port {
        out item payload : Bandgap_voltage_value_Item;
    }

    port def BatterySupply_In_Port {
        out item payload : BatterySupply_Item;
    }

    port def CANFlexray_ActualSupplyVoltage_Port {
        out item payload : CANFlexRay_ActualSupplyVoltage_Item;
    }

    port def CANFlexray_PhysicalSupplyVoltage_Port {
        out item payload : CANFlexray_PhysicalSupplyVoltage_Item;
    }

    port def CANFlexray_RawSupplyVoltage_Port {
        out item payload : CANFlexray_RawSupplyVoltage_Item;
    }

    port def CAN_Standby_PhysicalVoltage_Port {
        out item payload : Trcvs_Standby_VoltageValue_Item;
    }

    port def CAN_Standby_VoltageMeas_Port {
        out item payload : CAN_Standby_MeasuredVoltage_Item;
    }

    port def ChipExternalSupplyRailsActualVoltages_Port {
        out item payload : ChipExternalSupplyRailsActualVoltages_Item;
    }

    port def ChipExternalSupplyRailsRawVoltages_Port {
        out item payload : ChipExternalSupplyVoltageRails_Item;
    }

    port def ChipExternalSupplyVoltageRailsThresholdsConfigHw_Port {
        out item payload : ChipExternalVoltageRailsThresholdsConfigHW_Item;
    }

    port def ChipInternalSupplyRailsActualVoltages_Port {
        out item payload : ChipInternalSupplyRailsActualVoltages_Item;
    }

    port def ChipInternalSupplyRailsRawVoltages_Port {
        out item payload : ChipInternalSupplyVoltageRails_Item;
    }

    port def ChipInternalSupplyVoltageRailsThresholdsConfigHW_Port {
        out item payload : ChipInternalVoltageRailsThresholdsConfigHW_Item;
    }

    port def ChipPeripheralSupply_Port {
        out item payload : PeripheralSupply_Item;
    }

    port def Clamp30OVMeasActualVoltage_Port {
        out item payload : Clamp30OVMeasActualVoltage_Item;
    }

    port def Clamp30OVMeasRawVoltage_Port {
        out item payload : Clamp30OVMeasRawVoltage_Item;
    }

    port def Clamp30UVMeasActualVoltage_Port {
        out item payload : Clamp30UVMeasActualVoltage_Item;
    }

    port def Clamp30UVMeasRawVoltage_Port {
        out item payload : Clamp30UVMeasRawVoltage_Item;
    }

    port def ConfigureChipExternalSupplyVoltageRailsThresholds_Port {
        out item payload : ChipExternalVoltageRailsThresholdsConfig_Item;
    }

    port def ConfigureChipInternalSupplyVoltageRailsThresholds_Port {
        out item payload : ChipInternalVoltageRailsThresholdsConfig_Item;
    }

    port def ConfigureDieTemperaturesThresholds_Port {
        out item payload : DieTemperaturesThresholdConfig_Item;
    }

    port def DieTemperaturesThresholdsConfigHW_Port {
        out item payload : DieTemperaturesThresholdConfigHW_Item;
    }

    port def DigActualECUVoltagesMeas_Port {
        out item payload : DigActualVoltagesMeas_Item;
    }

    port def DigActualMeasAcceleratorPedal_Port {
        out item payload : DigActualMeasAcceleratorPedal_Item;
    }

    port def ETH_ActualSupplyVoltage_Port {
        out item payload : ETH_ActualSupplyVoltage_Item;
    }

    port def ETH_PhysicalSupplyVoltage_Port {
        out item payload : ETH_PhysicalSupplyVoltage_Item;
    }

    port def ETH_RawSupplyVoltage_Port {
        out item payload : ETH_RawSupplyVoltage_Item;
    }

    port def EthernetPLCPhysicalSupplyVoltage_Port {
        out item payload : ETH_PhysicalSupplyVoltage_Item;
    }

    port def InterMicrocontrollers_ActualSupplyVoltage_Port {
        out item payload : InterMicrocontrollersComm_ActualSupplyVoltage_Item;
    }

    port def InterMicrocontrollers_PhysicalSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    }

    port def InterMicrocontrollers_RawSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_RawSupplyVoltage_Item;
    }

    port def OnChipTemperature_Port {
        out item payload : OnChipTemperature_Item;
    }

    port def PDD_Result_Port {
        out item payload : PDD_Result_Item;
    }

    port def PhysActualVoltageAcceleratorPedalSensor_Port {
        out item payload : PhysActualVoltageAcceleratorPedalSensor_Item;
    }

    port def PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port {
        out item payload : PhysSupplyVoltageAcceleratorPedalSensorChannel1_Item;
    }

    port def PortEmergencyStop_PinLevels_Port {
        out item payload : PortEmergencyStop_PinLevels_Item;
    }

    port def Pulldown_Control_Port {
        out item payload : Pulldown_Control_Item;
    }

    port def RawDieTemperatures_Port {
        out item payload : RawDieTemperatures_Item;
    }

    port def RawSupplyVoltageAcceleratorPedalSensor_Port {
        out item payload : RawSupplyVoltageAcceleratorPedalSensor_Item;
    }

    port def RawVoltageAcceleratorSensor_Port {
        out item payload : RawVoltageAcceleratorSensor_Item;
    }

    port def Trcvs_StandbyPins_RawVoltage_Port {
        out item payload : Trcvs_Standby_RawVoltage_Item;
    }

    port def VDD3V3PhysicalSupplyVoltage_Port {
        out item payload : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
    }

    port def VDD5DPhysicalSupplyVoltage_Port {
        out item payload : VDD5D_PhysicalSupplyVoltage_Item;
    }

    port def VDD5DRawSupplyVoltage_Port {
        out item payload : VDD5D_RawSupplyVoltage_Item;
    }

    port def VDD5D_ActualSupplyVoltage_Port {
        out item payload : VDD5DActualSupplyVoltage_Item;
    }

    port def WakeupVBATBusComm_ActualSupplyVoltage_Port {
        out item payload : WakeupVBATComm_ActualSupplyVoltage_Item;
    }

    port def WakeupVBATBusComm_PhysicalSupplyVoltage_Port {
        out item payload : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
    }

    port def WakeupVBATBusComm_RawSupplyVoltage_Port {
        out item payload : WakeupVBATBusComm_RawSupplyVoltage_Item;
    }

    port def p29_Port {
        inout item payload : p29_Item;
    }

    // Internal logical-function definitions.
    part def AcpdSignalProcessing {
        port AcceleratorPedalPowerSupplyState : ~AcceleratorPedalPowerSupplyState_Port;
        port ActualSupplyVoltageAcceleratorPedal : ActualSupplyVoltageAcceleratorPedal_Port;
        port ActualVoltageAcceleratorPedal : ActualVoltageAcceleratorPedal_Port;
        port RawSupplyVoltageAcceleratorPedalSensor : ~RawSupplyVoltageAcceleratorPedalSensor_Port;
        port RawVoltageAcceleratorSensor : ~RawVoltageAcceleratorSensor_Port;
        port p1 : AcceleratorPedalDioCtrl_Port;

        perform action getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachinePerformed : GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine;
        perform action processAndQualifySensorAndSupplyVoltagesPerformed : ProcessAndQualifySensorAndSupplyVoltages;
    }

    part def InputOutputDriver {
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

    // Primitive action definitions extracted from the XMI activity.
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

    // Main activity translated from XMI-owned FunML Activity Diagram: SignalConditioningAndProcessing_acpd_act.
    // Boundary action parameter types are resolved from XMI referenceExtension::referentPath where available.
    // For the six anonymous AcquireSensorAndSupplyVoltage inputs, the XMI has no direct pin/APN type,
    // so the types are taken from the corresponding XMI-derived structural boundary ports connected to SignalConversion.
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

        action acquireSensorAndSupplyVoltage : AcquireSensorAndSupplyVoltage;
        action extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware : ExtractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware;
        action processAndQualifySensorAndSupplyVoltages : ProcessAndQualifySensorAndSupplyVoltages;
        action enableDisableThePowerSupply : EnableDisableThePowerSupply;
        action commandDIOToEnableDisablePowerSupply : CommandDIOToEnableDisablePowerSupply;
        action getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine : GetEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine;

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

        flow from acquireSensorAndSupplyVoltage.digActualMeasAcceleratorPedalSensor to extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.digActualMeasAcceleratorPedalSensor;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensor1 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensor1;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensorRedundant1 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensorRedundant1;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensor2 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensor2;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawVoltageAcceleratorPedalSensorRedundant2 to processAndQualifySensorAndSupplyVoltages.rawVoltageAcceleratorPedalSensorRedundant2;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawSupplyVoltageAcceleratorPedalSensor1 to processAndQualifySensorAndSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor1;
        flow from extractDigitalValuesForSensorAndSupplyVoltagesFromADCHardware.rawSupplyVoltageAcceleratorPedalSensor2 to processAndQualifySensorAndSupplyVoltages.rawSupplyVoltageAcceleratorPedalSensor2;
        flow from processAndQualifySensorAndSupplyVoltages.actualVoltageAcceleratorPedalSensor1 to actualVoltageAcceleratorPedalSensor1;
        flow from processAndQualifySensorAndSupplyVoltages.actualVoltageAcceleratorPedalSensor2 to actualVoltageAcceleratorPedalSensor2;
        flow from processAndQualifySensorAndSupplyVoltages.actualStatusVoltageAcceleratorPedalSensor1 to actualStatusVoltageAcceleratorPedalSensor1;
        flow from processAndQualifySensorAndSupplyVoltages.actualStatusVoltageAcceleratorPedalSensor2 to actualStatusVoltageAcceleratorPedalSensor2;
        flow from processAndQualifySensorAndSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor1 to actualSupplyVoltageAcceleratorPedalSensor1;
        flow from processAndQualifySensorAndSupplyVoltages.actualSupplyVoltageAcceleratorPedalSensor2 to actualSupplyVoltageAcceleratorPedalSensor2;
        flow from processAndQualifySensorAndSupplyVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor1 to actualStatusSupplyVoltageAcceleratorPedalSensor1;
        flow from processAndQualifySensorAndSupplyVoltages.actualStatusSupplyVoltageAcceleratorPedalSensor2 to actualStatusSupplyVoltageAcceleratorPedalSensor2;
        flow from batterySupply to acquireSensorAndSupplyVoltage.batterySupply;
        flow from canFlexrayPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.canFlexrayPhysicalSupplyVoltage;
        flow from vdd3v3PhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.vdd3v3PhysicalSupplyVoltage;
        flow from vdd5dPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.vdd5dPhysicalSupplyVoltage;
        flow from ethernetPLCPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.ethernetPLCPhysicalSupplyVoltage;
        flow from wakeupVBATBusCommPhysicalSupplyVoltage to acquireSensorAndSupplyVoltage.wakeupVBATBusCommPhysicalSupplyVoltage;
        flow from acceleratorPedalPowerSupplyState to getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine.acceleratorPedalPowerSupplyState;
        flow from getEnableDisableAcceleratorPedalSupplyStatusFromSystemStateMachine.acceleratorPedalDioCtrl to commandDIOToEnableDisablePowerSupply.acceleratorPedalDioCtrl;
        flow from commandDIOToEnableDisablePowerSupply.acceleratorPedalHwCtrl to enableDisableThePowerSupply.acceleratorPedalHwCtrl;
        flow from enableDisableThePowerSupply.acceleratorPedalPowerSupplyCtrl to acceleratorPedalPowerSupplyCtrl;
    }

    // Main logical cluster.
    // Sequence diagram translated from XMI-owned FunML Sequence Diagram: SignalConditioningAndProcessing_acpd_seq.
    // Action-definition form with native SysML v2 control actions:
    // - the whole interaction is an action definition, so if/else and loop are valid action nodes,
    // - lifelines are reference participants with event occurrences,
    // - boundary lifelines reuse the exact XMI-derived boundary/external port usages and PortDef types,
    // - each real XMI message is represented exactly once as message ... from event to event,
    // - no artificial messages are generated.
    action def SignalConditioningAndProcessing_acpd_seq {

        // Guard extracted from the UML alt operand: "activation status is enable".
        attribute activationStatusIsEnable : ScalarValues::Boolean;

        // Internal logical-function lifelines. These correspond to the same internal parts used by the cluster assembly.
        ref part acpdSignalProcessing : AcpdSignalProcessing {
            event occurrence send_m01_Compute_mean_values_for_both_sensor_and_supply_voltages;
            event occurrence receive_m01_Compute_mean_values_for_both_sensor_and_supply_voltages;
            event occurrence send_m02_Perform_redundancy_and_reference_checks;
            event occurrence receive_m02_Perform_redundancy_and_reference_checks;
            event occurrence send_m03_Get_accelerator_pedal_supply_activation_status;
            event occurrence receive_m04_Activation_status;
            event occurrence send_m05_Read_raw_voltages;
            event occurrence receive_m08_reply_8;
            event occurrence send_m09_Enable_HW_trigger_for_ADCs;
            event occurrence send_m18_Write_value_and_status_for_sensor_voltage_1;
            event occurrence send_m19_Write_value_and_status_for_sensor_voltage_2;
            event occurrence send_m20_Write_value_and_status_for_supply_voltage_1;
            event occurrence send_m21_Write_value_and_status_for_supply_voltage_2;
            event occurrence send_m22_command_DIO_to_enable_supply_power;
            event occurrence send_m24_command_DIO_to_disable_supply_power;
        }

        ref part inputOutputDriver : InputOutputDriver {
            event occurrence receive_m05_Read_raw_voltages;
            event occurrence send_m06_Extract_digital_voltages_from_ADC_registers;
            event occurrence receive_m07_reply_7;
            event occurrence send_m08_reply_8;
            event occurrence receive_m09_Enable_HW_trigger_for_ADCs;
            event occurrence receive_m22_command_DIO_to_enable_supply_power;
            event occurrence receive_m24_command_DIO_to_disable_supply_power;
            event occurrence send_m26_Configure_HW_to_start_ADC_conversion;
            event occurrence send_m27_Command_HW_to_enable_power_supply;
            event occurrence send_m28_Command_HW_to_disable_power_supply;
        }

        ref part signalConversion : SignalConversion {
            event occurrence receive_m06_Extract_digital_voltages_from_ADC_registers;
            event occurrence send_m07_reply_7;
            event occurrence send_m10_Acquire_physical_supply_voltage_1;
            event occurrence receive_m11_Physical_supply_voltage_1;
            event occurrence send_m12_Acquire_sensor1_voltage;
            event occurrence receive_m13_Sensor1_voltage;
            event occurrence send_m14_Acquire_sensor2_voltage;
            event occurrence receive_m15_Sensor2_voltage;
            event occurrence send_m16_Acquire_redundantly_sensor_voltage_1;
            event occurrence receive_m16_Acquire_redundantly_sensor_voltage_1;
            event occurrence send_m17_Acquire_redundantly_sensor_voltage_2;
            event occurrence receive_m17_Acquire_redundantly_sensor_voltage_2;
            event occurrence send_m23_Send_command_to_enable_power_supply;
            event occurrence send_m25_Send_command_to_disable_power_supply;
            event occurrence receive_m26_Configure_HW_to_start_ADC_conversion;
            event occurrence receive_m27_Command_HW_to_enable_power_supply;
            event occurrence receive_m28_Command_HW_to_disable_power_supply;
            event occurrence send_m29_Acquire_physical_supply_voltage_1;
            event occurrence receive_m30_Physical_supply_voltage_2;
        }

        // Boundary/external lifelines. These reuse the exact boundary/external port names and XMI-derived PortDef types
        // from part def SignalConditioningAndProcessing, instead of inventing local sequence port names.
        ref port External_PhysActualVoltageAcceleratorPedalSensor : PhysActualVoltageAcceleratorPedalSensor_Port {
            event occurrence receive_m12_Acquire_sensor1_voltage;
            event occurrence send_m13_Sensor1_voltage;
            event occurrence receive_m14_Acquire_sensor2_voltage;
            event occurrence send_m15_Sensor2_voltage;
        }

        ref port External_PhysSupplyVoltageAcceleratorPedalSensorChannel1 : PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port {
            event occurrence receive_m10_Acquire_physical_supply_voltage_1;
            event occurrence send_m11_Physical_supply_voltage_1;
            event occurrence receive_m29_Acquire_physical_supply_voltage_1;
            event occurrence send_m30_Physical_supply_voltage_2;
        }

        ref port External_AcceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Port {
            event occurrence receive_m03_Get_accelerator_pedal_supply_activation_status;
            event occurrence send_m04_Activation_status;
        }

        ref port External_ActualSupplyVoltageAcceleratorPedal : ActualSupplyVoltageAcceleratorPedal_Port {
            event occurrence receive_m20_Write_value_and_status_for_supply_voltage_1;
            event occurrence receive_m21_Write_value_and_status_for_supply_voltage_2;
        }

        ref port External_ActualVoltageAcceleratorPedal : ActualVoltageAcceleratorPedal_Port {
            event occurrence receive_m18_Write_value_and_status_for_sensor_voltage_1;
            event occurrence receive_m19_Write_value_and_status_for_sensor_voltage_2;
        }

        ref port External_AcceleratorPedalPowerSupplyCtrl : AcceleratorPedalPowerSupplyCtrl_Port {
            event occurrence receive_m23_Send_command_to_enable_power_supply;
            event occurrence receive_m25_Send_command_to_disable_power_supply;
            event occurrence send_m31_Enable_supply_for_accelerator_pedal;
            event occurrence receive_m31_Enable_supply_for_accelerator_pedal;
            event occurrence send_m32_Disable_supply_for_accelerator_pedal;
            event occurrence receive_m32_Disable_supply_for_accelerator_pedal;
        }

        // Messages before the supply-control alternative.
        // XMI name: "Get accelerator pedal supply activation status".
        message m03_Get_accelerator_pedal_supply_activation_status
            from acpdSignalProcessing.send_m03_Get_accelerator_pedal_supply_activation_status
            to External_AcceleratorPedalPowerSupplyState.receive_m03_Get_accelerator_pedal_supply_activation_status;

        // UML messageSort: reply; XMI name: "Activation status".
        message m04_Activation_status
            from External_AcceleratorPedalPowerSupplyState.send_m04_Activation_status
            to acpdSignalProcessing.receive_m04_Activation_status;

        // XMI CombinedFragment interactionOperator='alt'.
        // Enable operand guard: "activation status is enable".
        // Else operand: all other activation states.
        action supplyPowerDecision if activationStatusIsEnable {
            // UML messageSort: asynchSignal; XMI name: "command DIO to enable supply power".
            message m22_command_DIO_to_enable_supply_power
                from acpdSignalProcessing.send_m22_command_DIO_to_enable_supply_power
                to inputOutputDriver.receive_m22_command_DIO_to_enable_supply_power;

            // UML messageSort: asynchSignal; XMI name: "Command HW to enable power supply".
            message m27_Command_HW_to_enable_power_supply
                from inputOutputDriver.send_m27_Command_HW_to_enable_power_supply
                to signalConversion.receive_m27_Command_HW_to_enable_power_supply;

            // UML messageSort: asynchCall; XMI name: "Send command to enable power supply".
            message m23_Send_command_to_enable_power_supply
                from signalConversion.send_m23_Send_command_to_enable_power_supply
                to External_AcceleratorPedalPowerSupplyCtrl.receive_m23_Send_command_to_enable_power_supply;

            // XMI name: "Enable supply for accelerator pedal".
            message m31_Enable_supply_for_accelerator_pedal
                from External_AcceleratorPedalPowerSupplyCtrl.send_m31_Enable_supply_for_accelerator_pedal
                to External_AcceleratorPedalPowerSupplyCtrl.receive_m31_Enable_supply_for_accelerator_pedal;

        } else {
            // UML messageSort: asynchSignal; XMI name: "command DIO to disable supply power".
            message m24_command_DIO_to_disable_supply_power
                from acpdSignalProcessing.send_m24_command_DIO_to_disable_supply_power
                to inputOutputDriver.receive_m24_command_DIO_to_disable_supply_power;

            // UML messageSort: asynchCall; XMI name: "Send command to disable power supply".
            message m25_Send_command_to_disable_power_supply
                from signalConversion.send_m25_Send_command_to_disable_power_supply
                to External_AcceleratorPedalPowerSupplyCtrl.receive_m25_Send_command_to_disable_power_supply;

            // UML messageSort: asynchSignal; XMI name: "Command HW to disable power supply".
            message m28_Command_HW_to_disable_power_supply
                from inputOutputDriver.send_m28_Command_HW_to_disable_power_supply
                to signalConversion.receive_m28_Command_HW_to_disable_power_supply;

            // XMI name: "Disable supply for accelerator pedal".
            message m32_Disable_supply_for_accelerator_pedal
                from External_AcceleratorPedalPowerSupplyCtrl.send_m32_Disable_supply_for_accelerator_pedal
                to External_AcceleratorPedalPowerSupplyCtrl.receive_m32_Disable_supply_for_accelerator_pedal;
        }

        // XMI name: "Enable HW trigger for ADCs".
        message m09_Enable_HW_trigger_for_ADCs
            from acpdSignalProcessing.send_m09_Enable_HW_trigger_for_ADCs
            to inputOutputDriver.receive_m09_Enable_HW_trigger_for_ADCs;

        // UML messageSort: asynchSignal; XMI name: "Configure HW to start ADC conversion".
        message m26_Configure_HW_to_start_ADC_conversion
            from inputOutputDriver.send_m26_Configure_HW_to_start_ADC_conversion
            to signalConversion.receive_m26_Configure_HW_to_start_ADC_conversion;

        // XMI CombinedFragment interactionOperator='loop', guard="every 1 ms".
        // The XMI also contains a nested par CombinedFragment here, but it has no exported
        // operand-owned messages; no fork/join branches or artificial messages are generated.
        action every1msLoop loop {
            // UML messageSort: asynchSignal; XMI name: "Acquire physical supply voltage 1".
            message m10_Acquire_physical_supply_voltage_1
                from signalConversion.send_m10_Acquire_physical_supply_voltage_1
                to External_PhysSupplyVoltageAcceleratorPedalSensorChannel1.receive_m10_Acquire_physical_supply_voltage_1;

            // UML messageSort: reply; XMI name: "Physical supply voltage 1".
            message m11_Physical_supply_voltage_1
                from External_PhysSupplyVoltageAcceleratorPedalSensorChannel1.send_m11_Physical_supply_voltage_1
                to signalConversion.receive_m11_Physical_supply_voltage_1;

            // UML messageSort: asynchSignal; XMI name: "Acquire physical supply voltage 1".
            message m29_Acquire_physical_supply_voltage_1
                from signalConversion.send_m29_Acquire_physical_supply_voltage_1
                to External_PhysSupplyVoltageAcceleratorPedalSensorChannel1.receive_m29_Acquire_physical_supply_voltage_1;

            // UML messageSort: reply; XMI name: "Physical supply voltage 2".
            message m30_Physical_supply_voltage_2
                from External_PhysSupplyVoltageAcceleratorPedalSensorChannel1.send_m30_Physical_supply_voltage_2
                to signalConversion.receive_m30_Physical_supply_voltage_2;

            // UML messageSort: asynchSignal; XMI name: "Acquire sensor1 voltage".
            message m12_Acquire_sensor1_voltage
                from signalConversion.send_m12_Acquire_sensor1_voltage
                to External_PhysActualVoltageAcceleratorPedalSensor.receive_m12_Acquire_sensor1_voltage;

            // UML messageSort: reply; XMI name: "Sensor1 voltage".
            message m13_Sensor1_voltage
                from External_PhysActualVoltageAcceleratorPedalSensor.send_m13_Sensor1_voltage
                to signalConversion.receive_m13_Sensor1_voltage;

            // UML messageSort: asynchCall; XMI name: "Acquire redundantly sensor voltage 1".
            message m16_Acquire_redundantly_sensor_voltage_1
                from signalConversion.send_m16_Acquire_redundantly_sensor_voltage_1
                to signalConversion.receive_m16_Acquire_redundantly_sensor_voltage_1;

            // UML messageSort: asynchSignal; XMI name: "Acquire sensor2 voltage".
            message m14_Acquire_sensor2_voltage
                from signalConversion.send_m14_Acquire_sensor2_voltage
                to External_PhysActualVoltageAcceleratorPedalSensor.receive_m14_Acquire_sensor2_voltage;

            // UML messageSort: reply; XMI name: "Sensor2 voltage".
            message m15_Sensor2_voltage
                from External_PhysActualVoltageAcceleratorPedalSensor.send_m15_Sensor2_voltage
                to signalConversion.receive_m15_Sensor2_voltage;

            // UML messageSort: asynchCall; XMI name: "Acquire redundantly sensor voltage 2".
            message m17_Acquire_redundantly_sensor_voltage_2
                from signalConversion.send_m17_Acquire_redundantly_sensor_voltage_2
                to signalConversion.receive_m17_Acquire_redundantly_sensor_voltage_2;
        }

        // XMI CombinedFragment interactionOperator='loop', guard="every 10 ms".
        action every10msLoop loop {
            // XMI name: "Read raw voltages".
            message m05_Read_raw_voltages
                from acpdSignalProcessing.send_m05_Read_raw_voltages
                to inputOutputDriver.receive_m05_Read_raw_voltages;

            // XMI name: "Extract digital voltages from ADC registers".
            message m06_Extract_digital_voltages_from_ADC_registers
                from inputOutputDriver.send_m06_Extract_digital_voltages_from_ADC_registers
                to signalConversion.receive_m06_Extract_digital_voltages_from_ADC_registers;

            // UML messageSort: reply; XMI name: "reply_7".
            message m07_reply_7
                from signalConversion.send_m07_reply_7
                to inputOutputDriver.receive_m07_reply_7;

            // UML messageSort: reply; XMI name: "reply_8".
            message m08_reply_8
                from inputOutputDriver.send_m08_reply_8
                to acpdSignalProcessing.receive_m08_reply_8;

            // XMI name: "Compute mean values for both sensor and supply voltages".
            message m01_Compute_mean_values_for_both_sensor_and_supply_voltages
                from acpdSignalProcessing.send_m01_Compute_mean_values_for_both_sensor_and_supply_voltages
                to acpdSignalProcessing.receive_m01_Compute_mean_values_for_both_sensor_and_supply_voltages;

            // XMI name: "Perform redundancy and reference checks".
            message m02_Perform_redundancy_and_reference_checks
                from acpdSignalProcessing.send_m02_Perform_redundancy_and_reference_checks
                to acpdSignalProcessing.receive_m02_Perform_redundancy_and_reference_checks;

            // UML messageSort: asynchSignal; XMI name: "Write value and status for sensor voltage 1".
            message m18_Write_value_and_status_for_sensor_voltage_1
                from acpdSignalProcessing.send_m18_Write_value_and_status_for_sensor_voltage_1
                to External_ActualVoltageAcceleratorPedal.receive_m18_Write_value_and_status_for_sensor_voltage_1;

            // UML messageSort: asynchSignal; XMI name: "Write value and status for sensor voltage 2".
            message m19_Write_value_and_status_for_sensor_voltage_2
                from acpdSignalProcessing.send_m19_Write_value_and_status_for_sensor_voltage_2
                to External_ActualVoltageAcceleratorPedal.receive_m19_Write_value_and_status_for_sensor_voltage_2;

            // XMI name: "Write value and status for supply voltage 1".
            message m20_Write_value_and_status_for_supply_voltage_1
                from acpdSignalProcessing.send_m20_Write_value_and_status_for_supply_voltage_1
                to External_ActualSupplyVoltageAcceleratorPedal.receive_m20_Write_value_and_status_for_supply_voltage_1;

            // XMI name: "Write value and status for supply voltage 2".
            message m21_Write_value_and_status_for_supply_voltage_2
                from acpdSignalProcessing.send_m21_Write_value_and_status_for_supply_voltage_2
                to External_ActualSupplyVoltageAcceleratorPedal.receive_m21_Write_value_and_status_for_supply_voltage_2;
        }
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
        port External_ActualVoltageAcceleratorPedal : ActualVoltageAcceleratorPedal_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2021x_1_68c018f_1670824481035_265353_1329
        port External_ActualSupplyVoltageAcceleratorPedal : ActualSupplyVoltageAcceleratorPedal_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2021x_1_68c018f_1670824077896_684229_1147
        port External_PhysActualVoltageAcceleratorPedalSensor : PhysActualVoltageAcceleratorPedalSensor_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739450243970_930410_395
        port External_PhysSupplyVoltageAcceleratorPedalSensorChannel1 : PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739803183384_79946_420
        port External_AcceleratorPedalPowerSupplyState : AcceleratorPedalPowerSupplyState_Port;
        // External/referenced connector endpoint not locally exported in XMI: _2024x_1_86c020f_1739790423963_642330_319
        port External_AcceleratorPedalPowerSupplyCtrl : AcceleratorPedalPowerSupplyCtrl_Port;

        // Internal logical-function parts.
        part acpdSignalProcessing : AcpdSignalProcessing;
        part signalConversion : SignalConversion;
        part inputOutputDriver : InputOutputDriver;
        part voltageTemperatureSignalProcessing : VoltageTemperatureSignalProcessing;
        part onChipVTSupervisionDriver : OnChipVTSupervisionDriver;
        part onChipVTSupervision : OnChipVTSupervision;

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
        interface BatterySupply_InTosignalConversion_BatterySupply_In connect
            BatterySupply_In to signalConversion.BatterySupply_In;
        interface CANFlexray_PhysicalSupplyVoltageTosignalConversion_CANFlexray_PhysicalSupplyVoltage connect
            CANFlexray_PhysicalSupplyVoltage to signalConversion.CANFlexray_PhysicalSupplyVoltage;
        interface VDD3V3PhysicalSupplyVoltageTosignalConversion_VDD3V3PhysicalSupplyVoltage connect
            VDD3V3PhysicalSupplyVoltage to signalConversion.VDD3V3PhysicalSupplyVoltage;
        interface VDD5DPhysicalSupplyVoltageTosignalConversion_VDD5DPhysicalSupplyVoltage connect
            VDD5DPhysicalSupplyVoltage to signalConversion.VDD5DPhysicalSupplyVoltage;
        interface EthernetPLCPhysicalSupplyVoltageTosignalConversion_EthernetPLCPhysicalSupplyVoltage connect
            EthernetPLCPhysicalSupplyVoltage to signalConversion.EthernetPLCPhysicalSupplyVoltage;
        interface WakeupVBATBusComm_PhysicalSupplyVoltageTosignalConversion_WakeupVBATBusComm_PhysicalSupplyVoltage connect
            WakeupVBATBusComm_PhysicalSupplyVoltage to signalConversion.WakeupVBATBusComm_PhysicalSupplyVoltage;
        interface voltageTemperatureSignalProcessing_Clamp30OVMeasActualVoltageToClamp30OVMeasActualVoltage connect
            voltageTemperatureSignalProcessing.Clamp30OVMeasActualVoltage to Clamp30OVMeasActualVoltage;
        interface c19_connection connect
            ConfigureChipExternalSupplyVoltageRailsThresholds to onChipVTSupervisionDriver.ConfigureChipExternalSupplyVoltageRailsThresholds;
        interface c20_connection connect
            ConfigureChipInternalSupplyVoltageRailsThresholds to onChipVTSupervisionDriver.ConfigureChipInternalSupplyVoltageRailsThresholds;
        interface voltageTemperatureSignalProcessing_Clamp30UVMeasActualVoltageToClamp30UVMeasActualVoltage connect
            voltageTemperatureSignalProcessing.Clamp30UVMeasActualVoltage to Clamp30UVMeasActualVoltage;
        interface c22_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages to ChipExternalSupplyRailsActualVoltages;
        interface ConfigureDieTemperaturesThresholdsToonChipVTSupervisionDriver_ConfigureDieTemperaturesThresholds connect
            ConfigureDieTemperaturesThresholds to onChipVTSupervisionDriver.ConfigureDieTemperaturesThresholds;
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
        interface c31_connection connect
            voltageTemperatureSignalProcessing.WakeupVBATBusComm_ActualSupplyVoltage to WakeupVBATBusComm_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_ETH_ActualSupplyVoltageToETH_ActualSupplyVoltage connect
            voltageTemperatureSignalProcessing.ETH_ActualSupplyVoltage to ETH_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_VDD5D_ActualSupplyVoltageToVDD5D_ActualSupplyVoltage connect
            voltageTemperatureSignalProcessing.VDD5D_ActualSupplyVoltage to VDD5D_ActualSupplyVoltage;
        interface c34_connection connect
            voltageTemperatureSignalProcessing.InterMicrocontrollers_ActualSupplyVoltage to InterMicrocontrollers_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_CANFlexray_ActualSupplyVoltageToCANFlexray_ActualSupplyVoltage connect
            voltageTemperatureSignalProcessing.CANFlexray_ActualSupplyVoltage to CANFlexray_ActualSupplyVoltage;
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
        interface onChipVTSupervision_AlarmSignalInfoToAlarmSignalInfo connect
            onChipVTSupervision.AlarmSignalInfo to AlarmSignalInfo;
        interface c43_connection connect
            onChipVTSupervisionDriver.DieTemperaturesThresholdsConfigHW to onChipVTSupervision.DieTemperaturesThresholdsConfigHW;
        interface c44_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages to voltageTemperatureSignalProcessing.ChipExternalSupplyRailsActualVoltages;
        interface c45_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages to ChipInternalSupplyRailsActualVoltages;
        interface onChipVTSupervisionDriver_ActualDieTemperaturesToActualDieTemperatures connect
            onChipVTSupervisionDriver.ActualDieTemperatures to ActualDieTemperatures;
        interface c47_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages to voltageTemperatureSignalProcessing.ChipInternalSupplyRailsActualVoltages;
        interface signalConversion_DigActualECUVoltagesMeasToinputOutputDriver_DigActualECUVoltagesMeas_2 connect
            signalConversion.DigActualECUVoltagesMeas to inputOutputDriver.DigActualECUVoltagesMeas;
        interface c49_connection connect
            inputOutputDriver.Clamp30OVMeasRawVoltage to voltageTemperatureSignalProcessing.Clamp30OVMeasRawVoltage;
        interface c50_connection connect
            inputOutputDriver.CANFlexray_RawSupplyVoltage to voltageTemperatureSignalProcessing.CANFlexray_RawSupplyVoltage;
        interface c51_connection connect
            inputOutputDriver.InterMicrocontrollers_RawSupplyVoltage to voltageTemperatureSignalProcessing.InterMicrocontrollers_RawSupplyVoltage;
        interface inputOutputDriver_VDD5DRawSupplyVoltageTovoltageTemperatureSignalProcessing_VDD5DRawSupplyVoltage_2 connect
            inputOutputDriver.VDD5DRawSupplyVoltage to voltageTemperatureSignalProcessing.VDD5DRawSupplyVoltage;
        interface inputOutputDriver_ETH_RawSupplyVoltageTovoltageTemperatureSignalProcessing_ETH_RawSupplyVoltage_2 connect
            inputOutputDriver.ETH_RawSupplyVoltage to voltageTemperatureSignalProcessing.ETH_RawSupplyVoltage;
        interface c54_connection connect
            inputOutputDriver.WakeupVBATBusComm_RawSupplyVoltage to voltageTemperatureSignalProcessing.WakeupVBATBusComm_RawSupplyVoltage;
        interface c55_connection connect
            inputOutputDriver.Clamp30UVMeasRawVoltage to voltageTemperatureSignalProcessing.Clamp30UVMeasRawVoltage;
        interface voltageTemperatureSignalProcessing_CANFlexray_ActualSupplyVoltageToCANFlexray_ActualSupplyVoltage_2 connect
            voltageTemperatureSignalProcessing.CANFlexray_ActualSupplyVoltage to CANFlexray_ActualSupplyVoltage;
        interface c57_connection connect
            voltageTemperatureSignalProcessing.InterMicrocontrollers_ActualSupplyVoltage to InterMicrocontrollers_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_VDD5D_ActualSupplyVoltageToVDD5D_ActualSupplyVoltage_2 connect
            voltageTemperatureSignalProcessing.VDD5D_ActualSupplyVoltage to VDD5D_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_ETH_ActualSupplyVoltageToETH_ActualSupplyVoltage_2 connect
            voltageTemperatureSignalProcessing.ETH_ActualSupplyVoltage to ETH_ActualSupplyVoltage;
        interface c60_connection connect
            voltageTemperatureSignalProcessing.WakeupVBATBusComm_ActualSupplyVoltage to WakeupVBATBusComm_ActualSupplyVoltage;
        interface voltageTemperatureSignalProcessing_ActualReferenceVoltageToActualReferenceVoltage connect
            voltageTemperatureSignalProcessing.ActualReferenceVoltage to ActualReferenceVoltage;
        interface c62_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsActualVoltages to voltageTemperatureSignalProcessing.ChipExternalSupplyRailsActualVoltages;
        interface c63_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages to voltageTemperatureSignalProcessing.ChipInternalSupplyRailsActualVoltages;
        interface c64_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyVoltageRailsThresholdsConfigHw to onChipVTSupervision.ChipExternalSupplyVoltageRailsThresholdsConfigHw;
        interface c65_connection connect
            onChipVTSupervisionDriver.ChipExternalSupplyRailsRawVoltages to onChipVTSupervision.ChipExternalSupplyRailsRawVoltages;
        interface c66_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsRawVoltages to onChipVTSupervision.ChipInternalSupplyRailsRawVoltages;
        interface onChipVTSupervision_AlarmSignalInfoToAlarmSignalInfo_2 connect
            onChipVTSupervision.AlarmSignalInfo to AlarmSignalInfo;
        interface c68_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyVoltageRailsThresholdsConfigHW to onChipVTSupervision.ChipInternalSupplyVoltageRailsThresholdsConfigHW;
        interface c69_connection connect
            onChipVTSupervisionDriver.DieTemperaturesThresholdsConfigHW to onChipVTSupervision.DieTemperaturesThresholdsConfigHW;
        interface onChipVTSupervision_RawDieTemperaturesToonChipVTSupervisionDriver_RawDieTemperatures_2 connect
            onChipVTSupervision.RawDieTemperatures to onChipVTSupervisionDriver.RawDieTemperatures;
        interface onChipVTSupervisionDriver_ActualDieTemperaturesToActualDieTemperatures_2 connect
            onChipVTSupervisionDriver.ActualDieTemperatures to ActualDieTemperatures;
        interface c72_connection connect
            onChipVTSupervisionDriver.ChipInternalSupplyRailsActualVoltages to ChipInternalSupplyRailsActualVoltages;
        interface ConfigureDieTemperaturesThresholdsToonChipVTSupervisionDriver_ConfigureDieTemperaturesThresholds_2 connect
            ConfigureDieTemperaturesThresholds to onChipVTSupervisionDriver.ConfigureDieTemperaturesThresholds;
        interface signalConversion_p8Top21 connect
            signalConversion.p8 to p21;
        interface signalConversion_p9ToinputOutputDriver_p9 connect
            signalConversion.p9 to inputOutputDriver.p9;
        interface inputOutputDriver_p10Top22 connect
            inputOutputDriver.p10 to p22;
        interface inputOutputDriver_p11Top23 connect
            inputOutputDriver.p11 to p23;
        interface inputOutputDriver_p12Top24 connect
            inputOutputDriver.p12 to p24;
        interface p30ToonChipVTSupervision_p3 connect
            p30 to onChipVTSupervision.p3;
        interface p31ToonChipVTSupervision_p5 connect
            p31 to onChipVTSupervision.p5;
    }

}

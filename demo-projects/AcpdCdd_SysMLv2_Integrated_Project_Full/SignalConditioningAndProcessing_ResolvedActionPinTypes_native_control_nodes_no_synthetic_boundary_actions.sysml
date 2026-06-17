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


    // Additional logical information items resolved from external Logical Interfaces
    // through MagicDraw type href/referenceExtension referentPath entries.
    item def PhysActualVoltageAcceleratorPedalSensor_Item;
    item def DigActualMeasAcceleratorPedal_Item;
    item def PhysSupplyVoltageAcceleratorPedalSensorChannel1_Item;
    item def AcceleratorPedalHwCtrl_Item;
    item def AcceleratorPedalPowerSupplyCtrl_Item;
    item def RawVoltageAcceleratorSensor_Item;
    item def RawSupplyVoltageAcceleratorPedalSensor_Item;
    item def AcceleratorPedalDioCtrl_Item;
    item def CAN_Standby_PhysicalVoltage_Item;

    // Inferred aggregate items used only where the XMI activity pin itself has no direct type
    // and the activity uses an aggregate/merged flow rather than a single structural port type.
    item def AcquiredSupplyVoltages_Item;
    item def ChipSupplyRailsActualVoltages_Item;

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


    // External accelerator-pedal logical interfaces resolved via type href/referenceExtension.
    // Example XMI: InputOutputDriver::p3 is typed by
    // Solution::Driving::Logical Interfaces::DrivingCoordinator::DigActualMeasAcceleratorPedal.
    port def PhysActualVoltageAcceleratorPedalSensor_Port {
        out item payload : PhysActualVoltageAcceleratorPedalSensor_Item;
    }

    port def DigActualMeasAcceleratorPedal_Port {
        out item payload : DigActualMeasAcceleratorPedal_Item;
    }

    port def PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port {
        out item payload : PhysSupplyVoltageAcceleratorPedalSensorChannel1_Item;
    }

    port def AcceleratorPedalHwCtrl_Port {
        out item payload : AcceleratorPedalHwCtrl_Item;
    }

    port def AcceleratorPedalPowerSupplyCtrl_Port {
        out item payload : AcceleratorPedalPowerSupplyCtrl_Item;
    }

    port def RawVoltageAcceleratorSensor_Port {
        out item payload : RawVoltageAcceleratorSensor_Item;
    }

    port def RawSupplyVoltageAcceleratorPedalSensor_Port {
        out item payload : RawSupplyVoltageAcceleratorPedalSensor_Item;
    }

    port def AcceleratorPedalDioCtrl_Port {
        out item payload : AcceleratorPedalDioCtrl_Item;
    }

    port def CAN_Standby_PhysicalVoltage_Port {
        out item payload : CAN_Standby_PhysicalVoltage_Item;
    }

    part def SignalConversion {
        // Performed action usage used as allocation target for action-view swimlane rendering.
        perform action acquireSupplyVoltagesPerformed : AcquireSupplyVoltages;


        // Accelerator-pedal ports resolved from XMI structural port type references.
        // p3 type: PhysActualVoltageAcceleratorPedalSensor, isConjugated=true.
        port p3 : ~PhysActualVoltageAcceleratorPedalSensor_Port;
        // p4 type: DigActualMeasAcceleratorPedal.
        port p4 : DigActualMeasAcceleratorPedal_Port;
        // p5 type: PhysSupplyVoltageAcceleratorPedalSensorChannel1, isConjugated=true.
        port p5 : ~PhysSupplyVoltageAcceleratorPedalSensorChannel1_Port;
        // p6 type: AcceleratorPedalHwCtrl, isConjugated=true.
        port p6 : ~AcceleratorPedalHwCtrl_Port;
        // p7 type: AcceleratorPedalPowerSupplyCtrl.
        port p7 : AcceleratorPedalPowerSupplyCtrl_Port;
        // p8 type: CAN_Standby_PhysicalVoltage, isConjugated=true.
        port p8 : ~CAN_Standby_PhysicalVoltage_Port;

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
        // Performed action usage used as allocation target for action-view swimlane rendering.
        perform action extractDigitalValuesForSupplyVoltagesFromADCHardwarePerformed
            : ExtractDigitalValuesForSupplyVoltagesFromADCHardware;


        // Accelerator-pedal ports resolved from XMI structural port type references.
        // p2 type: RawVoltageAcceleratorSensor.
        port p2 : RawVoltageAcceleratorSensor_Port;
        // p3 type: DigActualMeasAcceleratorPedal, isConjugated=true.
        port p3 : ~DigActualMeasAcceleratorPedal_Port;
        // p5 type: RawSupplyVoltageAcceleratorPedalSensor.
        port p5 : RawSupplyVoltageAcceleratorPedalSensor_Port;
        // p7 type: AcceleratorPedalDioCtrl, isConjugated=true.
        port p7 : ~AcceleratorPedalDioCtrl_Port;
        // p8 type: AcceleratorPedalHwCtrl.
        port p8 : AcceleratorPedalHwCtrl_Port;

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
        // Performed action usages used as allocation targets for action-view swimlane rendering.
        perform action convertRawValuesToProperlyScaledValuesPerformed
            : ConvertRawValuesToProperlyScaledValues;
        perform action monitoringOfChipExternalAndInternalSupplyVoltageRailsPerformed
            : MonitoringOfChipExternalAndInternalSupplyVoltageRails;
        perform action monitoringOfDieTemperaturesPerformed
            : MonitoringOfDieTemperatures;

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
        // Performed action usages used as allocation targets for action-view swimlane rendering.
        perform action configureDieTemperatureSensorsPerformed : ConfigureDieTemperatureSensors;
        perform action configureExternalAndInternalVoltageRailsPerformed
            : ConfigureExternalAndInternalVoltageRails;
        perform action acquireDieTemperaturesFromDTSSensorsPerformed
            : AcquireDieTemperaturesFromDTSSensors;
        perform action convertDieTemperaturesToDegreeCelsiusPerformed
            : ConvertDieTemperaturesToDegreeCelsius;

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
    // Updated pin typing pass:
    // - The CallBehaviorAction pins themselves do not carry direct type="..." attributes in the XMI.
    // - Their generic names input/input1/output... were replaced with semantic pin names.
    // - Types are resolved indirectly from the object-flow topology plus the structural port types
    //   visible on SignalConversion, InputOutputDriver, VoltageTemperatureSignalProcessing,
    //   OnChipVTSupervisionDriver and OnChipVTSupervision.
    // - For structural ports whose type is external to the export, the MagicDraw
    //   referenceExtension/referentPath is used, e.g. InputOutputDriver::p3 ->
    //   Solution::Driving::Logical Interfaces::DrivingCoordinator::DigActualMeasAcceleratorPedal.
    // - Two aggregate items are still inferred because the XMI activity contains aggregate flows
    //   without a single direct UML pin type: AcquiredSupplyVoltages_Item and
    //   ChipSupplyRailsActualVoltages_Item.

    // XMI action label: Acquire supply voltages
    action def AcquireSupplyVoltages {
        in item batterySupply : BatterySupply_Item;
        in item canFlexrayPhysicalSupplyVoltage : CANFlexray_PhysicalSupplyVoltage_Item;
        in item vdd3v3PhysicalSupplyVoltage : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
        in item vdd5dPhysicalSupplyVoltage : VDD5D_PhysicalSupplyVoltage_Item;
        in item ethPhysicalSupplyVoltage : ETH_PhysicalSupplyVoltage_Item;
        in item wakeupVBATBusCommPhysicalSupplyVoltage : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;
        out item acquiredSupplyVoltages : AcquiredSupplyVoltages_Item;
    }

    // XMI action label: Extract digital values for supply voltages from ADC hardware
    action def ExtractDigitalValuesForSupplyVoltagesFromADCHardware {
        in item acquiredSupplyVoltages : AcquiredSupplyVoltages_Item;
        out item canFlexrayRawSupplyVoltage : CANFlexray_RawSupplyVoltage_Item;
        out item clamp30UVMeasRawVoltage : Clamp30UVMeasRawVoltage_Item;
        out item clamp30OVMeasRawVoltage : Clamp30OVMeasRawVoltage_Item;
        out item interMicrocontrollersRawSupplyVoltage : InterMicrocontrollers_RawSupplyVoltage_Item;
        out item vdd5dRawSupplyVoltage : VDD5D_RawSupplyVoltage_Item;
        out item ethRawSupplyVoltage : ETH_RawSupplyVoltage_Item;
        out item wakeupVBATBusCommRawSupplyVoltage : WakeupVBATBusComm_RawSupplyVoltage_Item;
    }

    // XMI action label: Convert raw values to properly scaled values
    action def ConvertRawValuesToProperlyScaledValues {
        in item canFlexrayRawSupplyVoltage : CANFlexray_RawSupplyVoltage_Item;
        in item clamp30UVMeasRawVoltage : Clamp30UVMeasRawVoltage_Item;
        in item clamp30OVMeasRawVoltage : Clamp30OVMeasRawVoltage_Item;
        in item interMicrocontrollersRawSupplyVoltage : InterMicrocontrollers_RawSupplyVoltage_Item;
        in item vdd5dRawSupplyVoltage : VDD5D_RawSupplyVoltage_Item;
        in item ethRawSupplyVoltage : ETH_RawSupplyVoltage_Item;
        in item wakeupVBATBusCommRawSupplyVoltage : WakeupVBATBusComm_RawSupplyVoltage_Item;
        out item canFlexrayActualSupplyVoltage : CANFlexRay_ActualSupplyVoltage_Item;
        out item clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Item;
        out item clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Item;
        out item interMicrocontrollersActualSupplyVoltage : InterMicrocontrollersComm_ActualSupplyVoltage_Item;
        out item vdd5dActualSupplyVoltage : VDD5DActualSupplyVoltage_Item;
        out item ethActualSupplyVoltage : ETH_ActualSupplyVoltage_Item;
        out item wakeupVBATBusCommActualSupplyVoltage : WakeupVBATComm_ActualSupplyVoltage_Item;
    }

    // XMI action label: Configure die temperature sensors
    action def ConfigureDieTemperatureSensors {
        in item dieTemperaturesThresholdConfig : DieTemperaturesThresholdConfig_Item;
        out item dieTemperaturesThresholdConfigHw : DieTemperaturesThresholdConfigHW_Item;
    }

    // XMI action label: Acquire die temperatures from DTS sensors
    action def AcquireDieTemperaturesFromDTSSensors {
        in item rawDieTemperatures : RawDieTemperatures_Item;
        out item rawDieTemperaturesOut : RawDieTemperatures_Item;
    }

    // XMI action label: Convert die temperatures to degree Celsius
    action def ConvertDieTemperaturesToDegreeCelsius {
        in item rawDieTemperatures : RawDieTemperatures_Item;
        out item actualDieTemperatures : ActualDieTemperatures_Item;
    }

    // XMI action label: Configure external and internal voltage rails
    action def ConfigureExternalAndInternalVoltageRails {
        in item chipExternalVoltageRailsThresholdsConfig : ChipExternalVoltageRailsThresholdsConfig_Item;
        in item chipInternalVoltageRailsThresholdsConfig : ChipInternalVoltageRailsThresholdsConfig_Item;
        out item chipExternalSupplyVoltageRailsThresholdsConfigHw : ChipExternalVoltageRailsThresholdsConfigHW_Item;
        out item chipInternalSupplyVoltageRailsThresholdsConfigHw : ChipInternalVoltageRailsThresholdsConfigHW_Item;
    }

    // XMI action label: Monitoring of Chip external and internal supply voltage rails
    action def MonitoringOfChipExternalAndInternalSupplyVoltageRails {
        in item chipExternalSupplyVoltageRailsThresholdsConfigHw : ChipExternalVoltageRailsThresholdsConfigHW_Item;
        in item chipInternalSupplyVoltageRailsThresholdsConfigHw : ChipInternalVoltageRailsThresholdsConfigHW_Item;
        in item chipSupplyRailsActualVoltages : ChipSupplyRailsActualVoltages_Item;
        out item alarmSignalInfo : ErrorAlarmSignal_Item;
    }

    // XMI action label: Monitoring of die temperatures
    action def MonitoringOfDieTemperatures {
        in item dieTemperaturesThresholdConfigHw : DieTemperaturesThresholdConfigHW_Item;
        in item rawDieTemperatures : RawDieTemperatures_Item;
        out item alarmSignalInfo : ErrorAlarmSignal_Item;
    }

    action def SignalConditioningAndProcessing_ASIL_D_VoltageTemperatureMon {
        in item batterySupply : BatterySupply_Item;
        in item canFlexrayPhysicalSupplyVoltage : CANFlexray_PhysicalSupplyVoltage_Item;
        in item vdd3v3PhysicalSupplyVoltage : InterMicrocontrollers_PhysicalSupplyVoltage_Item;
        in item vdd5dPhysicalSupplyVoltage : VDD5D_PhysicalSupplyVoltage_Item;
        in item ethPhysicalSupplyVoltage : ETH_PhysicalSupplyVoltage_Item;
        in item wakeupVBATBusCommPhysicalSupplyVoltage : WakeupVBATBusComm_PhysicalSupplyVoltage_Item;

        in item dieTemperaturesThresholdConfig : DieTemperaturesThresholdConfig_Item;
        in item chipExternalVoltageRailsThresholdsConfig : ChipExternalVoltageRailsThresholdsConfig_Item;
        in item chipInternalVoltageRailsThresholdsConfig : ChipInternalVoltageRailsThresholdsConfig_Item;
        in item rawDieTemperatures : RawDieTemperatures_Item;
        in item chipSupplyRailsActualVoltages : ChipSupplyRailsActualVoltages_Item;

        out item canFlexrayActualSupplyVoltage : CANFlexRay_ActualSupplyVoltage_Item;
        out item clamp30UVMeasActualVoltage : Clamp30UVMeasActualVoltage_Item;
        out item clamp30OVMeasActualVoltage : Clamp30OVMeasActualVoltage_Item;
        out item interMicrocontrollersActualSupplyVoltage : InterMicrocontrollersComm_ActualSupplyVoltage_Item;
        out item vdd5dActualSupplyVoltage : VDD5DActualSupplyVoltage_Item;
        out item ethActualSupplyVoltage : ETH_ActualSupplyVoltage_Item;
        out item wakeupVBATBusCommActualSupplyVoltage : WakeupVBATComm_ActualSupplyVoltage_Item;
        out item actualDieTemperatures : ActualDieTemperatures_Item;
        out item alarmSignalInfo : ErrorAlarmSignal_Item;

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
        // Uses native SysML v2 control nodes instead of synthetic start/final/fork actions.
        // XMI pattern: InitialNode -> ForkNode; two UML ForkNodes; one ActivityFinalNode; three FlowFinalNodes.
        fork initialFork;
        fork afterExtractFork;

        succession startToInitialFork first start then initialFork;

        succession initialForkToAcquireSupplyVoltages first initialFork
            then acquireSupplyVoltages;
        succession initialForkToConfigureDieTemperatureSensors first initialFork
            then configureDieTemperatureSensors;
        succession initialForkToConfigureExternalAndInternalVoltageRails first initialFork
            then configureExternalAndInternalVoltageRails;
        succession initialForkToAcquireDieTemperatures first initialFork
            then acquireDieTemperaturesFromDTSSensors;

        succession acquireSupplyVoltagesToExtractDigitalValues first acquireSupplyVoltages
            then extractDigitalValuesForSupplyVoltagesFromADCHardware;
        succession extractDigitalValuesToAfterExtractFork first extractDigitalValuesForSupplyVoltagesFromADCHardware
            then afterExtractFork;
        succession afterExtractForkToConvertRawValues first afterExtractFork
            then convertRawValuesToProperlyScaledValues;
        succession afterExtractForkToConvertDieTemperatures first afterExtractFork
            then convertDieTemperaturesToDegreeCelsius;

        succession configureDieTemperatureSensorsToMonitoringOfDieTemperatures first configureDieTemperatureSensors
            then monitoringOfDieTemperatures;
        succession configureVoltageRailsToMonitoringOfSupplyRails first configureExternalAndInternalVoltageRails
            then monitoringOfChipExternalAndInternalSupplyVoltageRails;

        // Terminal control flows translated to native SysML v2 done.
        // One UML ActivityFinalNode and three UML FlowFinalNodes were present in the XMI;
        // SysML v2 textual action notation uses done as the terminal control point.
        succession convertRawValuesToDone first convertRawValuesToProperlyScaledValues
            then done;
        succession monitoringSupplyRailsToDone first monitoringOfChipExternalAndInternalSupplyVoltageRails
            then done;
        succession acquireDieTemperaturesToDone first acquireDieTemperaturesFromDTSSensors
            then done;
        succession monitoringDieTemperaturesToDone first monitoringOfDieTemperatures
            then done;

        // Object-flow topology translated from UML ObjectFlow edges, with semantic pin names
        // and item types resolved from structural port type references wherever possible.
        // Activity boundary flows use the in/out items of this action directly, matching
        // the earlier item-based activity boundary style.
        flow from batterySupply to acquireSupplyVoltages.batterySupply;
        flow from canFlexrayPhysicalSupplyVoltage to acquireSupplyVoltages.canFlexrayPhysicalSupplyVoltage;
        flow from vdd3v3PhysicalSupplyVoltage to acquireSupplyVoltages.vdd3v3PhysicalSupplyVoltage;
        flow from vdd5dPhysicalSupplyVoltage to acquireSupplyVoltages.vdd5dPhysicalSupplyVoltage;
        flow from ethPhysicalSupplyVoltage to acquireSupplyVoltages.ethPhysicalSupplyVoltage;
        flow from wakeupVBATBusCommPhysicalSupplyVoltage to acquireSupplyVoltages.wakeupVBATBusCommPhysicalSupplyVoltage;
        flow from acquireSupplyVoltages.acquiredSupplyVoltages
            to extractDigitalValuesForSupplyVoltagesFromADCHardware.acquiredSupplyVoltages;

        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.canFlexrayRawSupplyVoltage
            to convertRawValuesToProperlyScaledValues.canFlexrayRawSupplyVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.clamp30UVMeasRawVoltage
            to convertRawValuesToProperlyScaledValues.clamp30UVMeasRawVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.clamp30OVMeasRawVoltage
            to convertRawValuesToProperlyScaledValues.clamp30OVMeasRawVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.interMicrocontrollersRawSupplyVoltage
            to convertRawValuesToProperlyScaledValues.interMicrocontrollersRawSupplyVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.vdd5dRawSupplyVoltage
            to convertRawValuesToProperlyScaledValues.vdd5dRawSupplyVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.ethRawSupplyVoltage
            to convertRawValuesToProperlyScaledValues.ethRawSupplyVoltage;
        flow from extractDigitalValuesForSupplyVoltagesFromADCHardware.wakeupVBATBusCommRawSupplyVoltage
            to convertRawValuesToProperlyScaledValues.wakeupVBATBusCommRawSupplyVoltage;

        flow from convertRawValuesToProperlyScaledValues.canFlexrayActualSupplyVoltage
            to canFlexrayActualSupplyVoltage;
        flow from convertRawValuesToProperlyScaledValues.clamp30UVMeasActualVoltage
            to clamp30UVMeasActualVoltage;
        flow from convertRawValuesToProperlyScaledValues.clamp30OVMeasActualVoltage
            to clamp30OVMeasActualVoltage;
        flow from convertRawValuesToProperlyScaledValues.interMicrocontrollersActualSupplyVoltage
            to interMicrocontrollersActualSupplyVoltage;
        flow from convertRawValuesToProperlyScaledValues.vdd5dActualSupplyVoltage
            to vdd5dActualSupplyVoltage;
        flow from convertRawValuesToProperlyScaledValues.ethActualSupplyVoltage
            to ethActualSupplyVoltage;
        flow from convertRawValuesToProperlyScaledValues.wakeupVBATBusCommActualSupplyVoltage
            to wakeupVBATBusCommActualSupplyVoltage;

        flow from dieTemperaturesThresholdConfig
            to configureDieTemperatureSensors.dieTemperaturesThresholdConfig;
        flow from configureDieTemperatureSensors.dieTemperaturesThresholdConfigHw
            to monitoringOfDieTemperatures.dieTemperaturesThresholdConfigHw;

        flow from chipExternalVoltageRailsThresholdsConfig
            to configureExternalAndInternalVoltageRails.chipExternalVoltageRailsThresholdsConfig;
        flow from chipInternalVoltageRailsThresholdsConfig
            to configureExternalAndInternalVoltageRails.chipInternalVoltageRailsThresholdsConfig;
        flow from configureExternalAndInternalVoltageRails.chipExternalSupplyVoltageRailsThresholdsConfigHw
            to monitoringOfChipExternalAndInternalSupplyVoltageRails.chipExternalSupplyVoltageRailsThresholdsConfigHw;
        flow from configureExternalAndInternalVoltageRails.chipInternalSupplyVoltageRailsThresholdsConfigHw
            to monitoringOfChipExternalAndInternalSupplyVoltageRails.chipInternalSupplyVoltageRailsThresholdsConfigHw;
        flow from chipSupplyRailsActualVoltages
            to monitoringOfChipExternalAndInternalSupplyVoltageRails.chipSupplyRailsActualVoltages;

        flow from rawDieTemperatures to acquireDieTemperaturesFromDTSSensors.rawDieTemperatures;
        flow from acquireDieTemperaturesFromDTSSensors.rawDieTemperaturesOut
            to convertDieTemperaturesToDegreeCelsius.rawDieTemperatures;
        flow from convertDieTemperaturesToDegreeCelsius.actualDieTemperatures
            to actualDieTemperatures;
        flow from rawDieTemperatures to monitoringOfDieTemperatures.rawDieTemperatures;

        flow from monitoringOfChipExternalAndInternalSupplyVoltageRails.alarmSignalInfo
            to alarmSignalInfo;
        flow from monitoringOfDieTemperatures.alarmSignalInfo
            to alarmSignalInfo;
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
        // from nested action usages in the composed activity to performed action usages
        // owned by the responsible internal logical-function parts.
        // This is stricter than allocating directly to the part usages and is closer
        // to the action-to-action allocation pattern used by the SysML v2 examples.
        // For this ASIL-D activity export, the UML ActivityPartition elements exist,
        // but the exported partitions do not carry usable represents/node membership;
        // these allocations are therefore inferred from the action labels and the
        // existing logical-function decomposition.
        allocate voltageTemperatureMonitoring.acquireSupplyVoltages
            to signalConversion.acquireSupplyVoltagesPerformed;
        allocate voltageTemperatureMonitoring.extractDigitalValuesForSupplyVoltagesFromADCHardware
            to inputOutputDriver.extractDigitalValuesForSupplyVoltagesFromADCHardwarePerformed;
        allocate voltageTemperatureMonitoring.convertRawValuesToProperlyScaledValues
            to voltageTemperatureSignalProcessing.convertRawValuesToProperlyScaledValuesPerformed;
        allocate voltageTemperatureMonitoring.monitoringOfChipExternalAndInternalSupplyVoltageRails
            to voltageTemperatureSignalProcessing.monitoringOfChipExternalAndInternalSupplyVoltageRailsPerformed;
        allocate voltageTemperatureMonitoring.configureDieTemperatureSensors
            to onChipVTSupervisionDriver.configureDieTemperatureSensorsPerformed;
        allocate voltageTemperatureMonitoring.configureExternalAndInternalVoltageRails
            to onChipVTSupervisionDriver.configureExternalAndInternalVoltageRailsPerformed;
        allocate voltageTemperatureMonitoring.acquireDieTemperaturesFromDTSSensors
            to onChipVTSupervisionDriver.acquireDieTemperaturesFromDTSSensorsPerformed;
        allocate voltageTemperatureMonitoring.convertDieTemperaturesToDegreeCelsius
            to onChipVTSupervisionDriver.convertDieTemperaturesToDegreeCelsiusPerformed;
        allocate voltageTemperatureMonitoring.monitoringOfDieTemperatures
            to voltageTemperatureSignalProcessing.monitoringOfDieTemperaturesPerformed;

        // Internal and delegation connectors resolved from UML ownedConnector elements.


        // Additional connector semantics from the earlier logical function diagram/XMI handoff,
        // now with structural port types resolved from href/referenceExtension paths.
        interface digActualMeasAcceleratorPedalConnection connect
            signalConversion.p4
                to inputOutputDriver.p3;

        interface acceleratorPedalHwCtrlConnection connect
            inputOutputDriver.p8
                to signalConversion.p6;
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

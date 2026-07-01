package SCP_Foundation {

    // Shared item definitions, ASIL metadata, and realization metadata.
    // Cross-package references are resolved through the private imports below.

    // Shared logical-information items and the ASIL metadata definition.
    // Owned by the logical-information / safety-modeling team.

    enum def ASILLevel { QM; ASIL_A; ASIL_B; ASIL_C; ASIL_D; }

    metadata def ASIL {
        attribute level : ASILLevel;
    }

    enum def RealizationKind { HW; SW; }

    metadata def Realization {
        attribute kind : RealizationKind;
    }

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

    item def ADC_ISR_Item;

    item def ISRErrorState_Item;

    item def MeanValueActualVoltageSensor1_Item;

    item def MeanValueActualVoltageSensor1Redundant_Item;

    item def MeanValueActualVoltageSensor2_Item;

    item def MeanValueActualVoltageSensor2Redundant_Item;

    item def ScaledSupplyVoltage1_Item;

    item def ScaledSupplyVoltage2_Item;

}

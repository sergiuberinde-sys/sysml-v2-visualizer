package SCP_Interfaces {

    // Reusable logical-interface port definitions.
    // Cross-package references are resolved through the private imports below.

    // Reusable logical-interface port definitions.
    // Owned by the interface architecture team.
    private import SCP_Foundation::*;

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

}

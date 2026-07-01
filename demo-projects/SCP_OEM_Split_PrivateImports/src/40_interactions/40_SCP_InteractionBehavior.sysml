package SCP_Interactions {

    // Interaction behavior translated from SignalConditioningAndProcessing_acpd_seq.
    // Cross-package references are resolved through the private imports below.

    // Interaction behavior translated from SignalConditioningAndProcessing_acpd_seq.
    // Retains the current event-occurrence endpoints, real XMI messages, and control-fragment representation unchanged.
    private import SCP_LogicalFunctions::*;

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

}


package DynamicInteractionSequences {

    part def AcpdCdd_Runtime_Sequence_AdcParticipant {
        event occurrence AcpdCdd_AdcNotificationGroup0_1_Supply_source;
    }

    part def AcpdCdd_Runtime_Sequence_AdcBistParticipant {
        event occurrence AdcBist_GetVaref1ErrorStatus_target;
        event occurrence returnVARef1ErrorFlag_source;
        event occurrence AdcBist_GetVaref2ErrorStatus_target;
        event occurrence returnVARef2ErrorFlag_source;
    }

    part def AcpdCdd_Runtime_Sequence_RteParticipant {
        event occurrence Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_target;
        event occurrence returnActivationStatus_source;
        event occurrence Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_target;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddParticipant {
        event occurrence AcpdCdd_Activation_source;
        event occurrence returnFromPowermanagement_target;
        event occurrence AcpdCdd_CollectInputData_source;
        event occurrence returnInputData_target;
        event occurrence AcpdCdd_Process_source;
        event occurrence returnProcessedData_target;
        event occurrence AcpdCdd_PowermanagementCalcStatus_source;
        event occurrence returnPowerState_target;
        event occurrence AdcBist_GetVaref1ErrorStatus_source;
        event occurrence returnVARef1ErrorFlag_target;
        event occurrence AdcBist_GetVaref2ErrorStatus_source;
        event occurrence returnVARef2ErrorFlag_target;
        event occurrence AcpdCdd_Monitoring_source;
        event occurrence returnAcceleratorData_target;
        event occurrence AcpdCdd_Output_source;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddInputParticipant {
        event occurrence AcpdCdd_CollectInputData_target;
        event occurrence AcpdCdd_AdcNotificationGroup0_1_Supply_target;
        event occurrence returnInputData_source;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddProcessParticipant {
        event occurrence AcpdCdd_Process_target;
        event occurrence returnProcessedData_source;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddPowermanagementParticipant {
        event occurrence AcpdCdd_Activation_target;
        event occurrence Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_source;
        event occurrence returnActivationStatus_target;
        event occurrence returnFromPowermanagement_source;
        event occurrence AcpdCdd_PowermanagementCalcStatus_target;
        event occurrence returnPowerState_source;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddMonitoringParticipant {
        event occurrence AcpdCdd_Monitoring_target;
        event occurrence returnAcceleratorData_source;
    }

    part def AcpdCdd_Runtime_Sequence_AcpdCddOutputParticipant {
        event occurrence AcpdCdd_Output_target;
        event occurrence Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_source;
    }

    part def AcpdCdd_Runtime_Sequence {

        part adc[1] : AcpdCdd_Runtime_Sequence_AdcParticipant;
        part adcBist[1] : AcpdCdd_Runtime_Sequence_AdcBistParticipant;
        part rte[1] : AcpdCdd_Runtime_Sequence_RteParticipant;
        part acpdCdd[1] : AcpdCdd_Runtime_Sequence_AcpdCddParticipant;
        part acpdCddInput[1] : AcpdCdd_Runtime_Sequence_AcpdCddInputParticipant;
        part acpdCddProcess[1] : AcpdCdd_Runtime_Sequence_AcpdCddProcessParticipant;
        part acpdCddPowermanagement[1] : AcpdCdd_Runtime_Sequence_AcpdCddPowermanagementParticipant;
        part acpdCddMonitoring[1] : AcpdCdd_Runtime_Sequence_AcpdCddMonitoringParticipant;
        part acpdCddOutput[1] : AcpdCdd_Runtime_Sequence_AcpdCddOutputParticipant;

        // 1. Original: AcpdCdd_Activation()
        // Purpose: Enable/disable accelerator pedal module
        message AcpdCdd_Activation
            from acpdCdd.AcpdCdd_Activation_source
            to acpdCddPowermanagement.AcpdCdd_Activation_target;

        // 2. Original: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
        // Purpose: Read activation status from RTE
        message Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            from acpdCddPowermanagement.Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_source
            to rte.Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_target;

        // 3. Original: return activation status
        // Purpose: Provide ACTIVATE/DEACTIVATE information
        message returnActivationStatus
            from rte.returnActivationStatus_source
            to acpdCddPowermanagement.returnActivationStatus_target;

        // 4. Original: return
        // Purpose: Power management step complete
        message returnFromPowermanagement
            from acpdCddPowermanagement.returnFromPowermanagement_source
            to acpdCdd.returnFromPowermanagement_target;

        // 5. Original: AcpdCdd_CollectInputData()
        // Purpose: Fetch buffered sensor and supply data
        message AcpdCdd_CollectInputData
            from acpdCdd.AcpdCdd_CollectInputData_source
            to acpdCddInput.AcpdCdd_CollectInputData_target;

        // 6. Original: interrupt notifications (AcpdCdd_AdcNotificationGroup0/1/Supply) // asynchronous
        // Purpose: Provide raw ADC samples and timestamps into buffers
        message AcpdCdd_AdcNotificationGroup0_1_Supply
            from adc.AcpdCdd_AdcNotificationGroup0_1_Supply_source
            to acpdCddInput.AcpdCdd_AdcNotificationGroup0_1_Supply_target;

        // 7. Original: return InputData
        // Purpose: Return buffered and grouped data for Sensor1/Sensor2
        message returnInputData
            from acpdCddInput.returnInputData_source
            to acpdCdd.returnInputData_target;

        // 8. Original: AcpdCdd_Process()
        // Purpose: Calculate averages and preliminary qualifiers
        message AcpdCdd_Process
            from acpdCdd.AcpdCdd_Process_source
            to acpdCddProcess.AcpdCdd_Process_target;

        // 9. Original: return ProcessedData
        // Purpose: Return ChannelMeansType / processed voltages
        message returnProcessedData
            from acpdCddProcess.returnProcessedData_source
            to acpdCdd.returnProcessedData_target;

        // 10. Original: AcpdCdd_PowermanagementCalcStatus()
        // Purpose: Determine current power state and transitions
        message AcpdCdd_PowermanagementCalcStatus
            from acpdCdd.AcpdCdd_PowermanagementCalcStatus_source
            to acpdCddPowermanagement.AcpdCdd_PowermanagementCalcStatus_target;

        // 11. Original: return PowerState
        // Purpose: Provide current power status for monitoring
        message returnPowerState
            from acpdCddPowermanagement.returnPowerState_source
            to acpdCdd.returnPowerState_target;

        // 12. Original: AdcBist_GetVaref1ErrorStatus()
        // Purpose: Check VARef1 error flag
        message AdcBist_GetVaref1ErrorStatus
            from acpdCdd.AdcBist_GetVaref1ErrorStatus_source
            to adcBist.AdcBist_GetVaref1ErrorStatus_target;

        // 13. Original: return VARef1ErrorFlag
        // Purpose: Provide VARef1 error status
        message returnVARef1ErrorFlag
            from adcBist.returnVARef1ErrorFlag_source
            to acpdCdd.returnVARef1ErrorFlag_target;

        // 14. Original: AdcBist_GetVaref2ErrorStatus()
        // Purpose: Check VARef2 error flag
        message AdcBist_GetVaref2ErrorStatus
            from acpdCdd.AdcBist_GetVaref2ErrorStatus_source
            to adcBist.AdcBist_GetVaref2ErrorStatus_target;

        // 15. Original: return VARef2ErrorFlag
        // Purpose: Provide VARef2 error status
        message returnVARef2ErrorFlag
            from adcBist.returnVARef2ErrorFlag_source
            to acpdCdd.returnVARef2ErrorFlag_target;

        // 16. Original: AcpdCdd_Monitoring(InputData, ProcessedData, PowerState, VARef1ErrorFlag, VARef2ErrorFlag)
        // Purpose: Compute final qualifiers and adjusted values
        message AcpdCdd_Monitoring
            from acpdCdd.AcpdCdd_Monitoring_source
            to acpdCddMonitoring.AcpdCdd_Monitoring_target;

        // 17. Original: return AcceleratorData
        // Purpose: Return data with qualifiers
        message returnAcceleratorData
            from acpdCddMonitoring.returnAcceleratorData_source
            to acpdCdd.returnAcceleratorData_target;

        // 18. Original: AcpdCdd_Output(AcceleratorData)
        // Purpose: Write to RTE
        message AcpdCdd_Output
            from acpdCdd.AcpdCdd_Output_source
            to acpdCddOutput.AcpdCdd_Output_target;

        // 19. Original: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        // Purpose: Provide consistent accelerator pedal signals to RTE
        message Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            from acpdCddOutput.Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_source
            to rte.Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_target;

    }

    part acpdCddRuntimeSequence : AcpdCdd_Runtime_Sequence;
}

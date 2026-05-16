
package RuntimeInteractionContracts {

    private import Types::*;

    // SysML v2-readable runtime interaction contract model.
    // The JSON contract remains the current machine-checkable enforcement artifact.

    item def RuntimeInteractionContract {
        attribute SequenceIndex : ScalarValues::Integer;
    }

    part def AcpdCdd_RuntimeInteractionContractSet {

        // interaction-contract: AcpdCdd_Activation
        // sequence-index: 1
        // from: AcpdCdd
        // to: AcpdCdd_Powermanagement
        // caller-port: to_powermanagement_AcpdCdd_Activation
        // callee-port: from_acpdCdd_AcpdCdd_Activation
        // operation: AcpdCdd_Activation
        // operation-owner: AcpdCdd_Powermanagement
        // payload-type: ActivationRequestPayloadType
        item AcpdCdd_Activation_contract : RuntimeInteractionContract {
            item Payload : ActivationRequestPayloadType;
        }

        // interaction-contract: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
        // sequence-index: 2
        // from: AcpdCdd_Powermanagement
        // to: RTE
        // caller-port: to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
        // callee-port: from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
        // operation: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
        // operation-owner: RTE
        // payload-type: ActivationRequestPayloadType
        item Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_contract : RuntimeInteractionContract {
            item Payload : ActivationRequestPayloadType;
        }

        // interaction-contract: returnActivationStatus
        // sequence-index: 3
        // from: RTE
        // to: AcpdCdd_Powermanagement
        // caller-port: to_powermanagement_returnActivationStatus
        // callee-port: from_rte_returnActivationStatus
        // operation: returnActivationStatus
        // operation-owner: RTE
        // payload-type: ActivationStatusPayloadType
        item returnActivationStatus_contract : RuntimeInteractionContract {
            item Payload : ActivationStatusPayloadType;
        }

        // interaction-contract: returnFromPowermanagement
        // sequence-index: 4
        // from: AcpdCdd_Powermanagement
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnFromPowermanagement
        // callee-port: from_powermanagement_returnFromPowermanagement
        // operation: returnFromPowermanagement
        // operation-owner: AcpdCdd_Powermanagement
        // payload-type: NoPayloadType
        item returnFromPowermanagement_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: AcpdCdd_CollectInputData
        // sequence-index: 5
        // from: AcpdCdd
        // to: AcpdCdd_Input
        // caller-port: to_input_AcpdCdd_CollectInputData
        // callee-port: from_acpdCdd_AcpdCdd_CollectInputData
        // operation: AcpdCdd_CollectInputData
        // operation-owner: AcpdCdd_Input
        // payload-type: NoPayloadType
        item AcpdCdd_CollectInputData_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: AcpdCdd_AdcNotificationGroup0_1_Supply
        // sequence-index: 6
        // from: ADC
        // to: AcpdCdd_Input
        // caller-port: to_input_AcpdCdd_AdcNotificationGroup0_1_Supply
        // callee-port: from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply
        // operation: AcpdCdd_AdcNotificationGroup0_1_Supply
        // operation-owner: AcpdCdd_Input
        // payload-type: NoPayloadType
        item AcpdCdd_AdcNotificationGroup0_1_Supply_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: returnInputData
        // sequence-index: 7
        // from: AcpdCdd_Input
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnInputData
        // callee-port: from_input_returnInputData
        // operation: returnInputData
        // operation-owner: AcpdCdd_Input
        // payload-type: InputDataType
        item returnInputData_contract : RuntimeInteractionContract {
            item Payload : InputDataType;
        }

        // interaction-contract: AcpdCdd_Process
        // sequence-index: 8
        // from: AcpdCdd
        // to: AcpdCdd_Process
        // caller-port: to_process_AcpdCdd_Process
        // callee-port: from_acpdCdd_AcpdCdd_Process
        // operation: AcpdCdd_Process
        // operation-owner: AcpdCdd_Process
        // payload-type: InputDataType
        item AcpdCdd_Process_contract : RuntimeInteractionContract {
            item Payload : InputDataType;
        }

        // interaction-contract: returnProcessedData
        // sequence-index: 9
        // from: AcpdCdd_Process
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnProcessedData
        // callee-port: from_process_returnProcessedData
        // operation: returnProcessedData
        // operation-owner: AcpdCdd_Process
        // payload-type: ChannelMeansType
        item returnProcessedData_contract : RuntimeInteractionContract {
            item Payload : ChannelMeansType;
        }

        // interaction-contract: AcpdCdd_PowermanagementCalcStatus
        // sequence-index: 10
        // from: AcpdCdd
        // to: AcpdCdd_Powermanagement
        // caller-port: to_powermanagement_AcpdCdd_PowermanagementCalcStatus
        // callee-port: from_acpdCdd_AcpdCdd_PowermanagementCalcStatus
        // operation: AcpdCdd_PowermanagementCalcStatus
        // operation-owner: AcpdCdd_Powermanagement
        // payload-type: NoPayloadType
        item AcpdCdd_PowermanagementCalcStatus_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: returnPowerState
        // sequence-index: 11
        // from: AcpdCdd_Powermanagement
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnPowerState
        // callee-port: from_powermanagement_returnPowerState
        // operation: returnPowerState
        // operation-owner: AcpdCdd_Powermanagement
        // payload-type: NoPayloadType
        item returnPowerState_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: AdcBist_GetVaref1ErrorStatus
        // sequence-index: 12
        // from: AcpdCdd
        // to: AdcBist
        // caller-port: to_adcBist_AdcBist_GetVaref1ErrorStatus
        // callee-port: from_acpdCdd_AdcBist_GetVaref1ErrorStatus
        // operation: AdcBist_GetVaref1ErrorStatus
        // operation-owner: AdcBist
        // payload-type: NoPayloadType
        item AdcBist_GetVaref1ErrorStatus_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: returnVARef1ErrorFlag
        // sequence-index: 13
        // from: AdcBist
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnVARef1ErrorFlag
        // callee-port: from_adcBist_returnVARef1ErrorFlag
        // operation: returnVARef1ErrorFlag
        // operation-owner: AdcBist
        // payload-type: AdcBistStatusPayloadType
        item returnVARef1ErrorFlag_contract : RuntimeInteractionContract {
            item Payload : AdcBistStatusPayloadType;
        }

        // interaction-contract: AdcBist_GetVaref2ErrorStatus
        // sequence-index: 14
        // from: AcpdCdd
        // to: AdcBist
        // caller-port: to_adcBist_AdcBist_GetVaref2ErrorStatus
        // callee-port: from_acpdCdd_AdcBist_GetVaref2ErrorStatus
        // operation: AdcBist_GetVaref2ErrorStatus
        // operation-owner: AdcBist
        // payload-type: NoPayloadType
        item AdcBist_GetVaref2ErrorStatus_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: returnVARef2ErrorFlag
        // sequence-index: 15
        // from: AdcBist
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnVARef2ErrorFlag
        // callee-port: from_adcBist_returnVARef2ErrorFlag
        // operation: returnVARef2ErrorFlag
        // operation-owner: AdcBist
        // payload-type: AdcBistStatusPayloadType
        item returnVARef2ErrorFlag_contract : RuntimeInteractionContract {
            item Payload : AdcBistStatusPayloadType;
        }

        // interaction-contract: AcpdCdd_Monitoring
        // sequence-index: 16
        // from: AcpdCdd
        // to: AcpdCdd_Monitoring
        // caller-port: to_monitoring_AcpdCdd_Monitoring
        // callee-port: from_acpdCdd_AcpdCdd_Monitoring
        // operation: AcpdCdd_Monitoring
        // operation-owner: AcpdCdd_Monitoring
        // payload-type: ChannelMeansType
        item AcpdCdd_Monitoring_contract : RuntimeInteractionContract {
            item Payload : ChannelMeansType;
        }

        // interaction-contract: returnAcceleratorData
        // sequence-index: 17
        // from: AcpdCdd_Monitoring
        // to: AcpdCdd
        // caller-port: to_acpdCdd_returnAcceleratorData
        // callee-port: from_monitoring_returnAcceleratorData
        // operation: returnAcceleratorData
        // operation-owner: AcpdCdd_Monitoring
        // payload-type: NoPayloadType
        item returnAcceleratorData_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: AcpdCdd_Output
        // sequence-index: 18
        // from: AcpdCdd
        // to: AcpdCdd_Output
        // caller-port: to_output_AcpdCdd_Output
        // callee-port: from_acpdCdd_AcpdCdd_Output
        // operation: AcpdCdd_Output
        // operation-owner: AcpdCdd_Output
        // payload-type: NoPayloadType
        item AcpdCdd_Output_contract : RuntimeInteractionContract {
            item Payload : NoPayloadType;
        }

        // interaction-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        // sequence-index: 19
        // from: AcpdCdd_Output
        // to: RTE
        // caller-port: to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        // callee-port: from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        // operation: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        // operation-owner: RTE
        // payload-type: ProcessedSensorOutputPayloadType
        item Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_contract : RuntimeInteractionContract {
            item Payload : ProcessedSensorOutputPayloadType;
        }

    }
}

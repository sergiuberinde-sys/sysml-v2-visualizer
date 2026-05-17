package AcpdCdd_SysMLv2 {

    package InterfaceContracts {

        private import AcpdCdd_SysMLv2::Types::*;

        // This file is a SysML v2 readable contract view.
        // The machine-checkable source of truth is:
        // contracts/runtime_interaction_contracts.json


        item def RuntimeContractPayload;

        port def RuntimeCallerPort {
            out item payload : RuntimeContractPayload;
        }

        port def RuntimeCalleePort {
            in item payload : RuntimeContractPayload;
        }

        // Runtime payload contract catalogue.
        // The JSON runtime contract checker validates that each message maps to one of these payload types.
        // payload-contract: AcpdCdd_AdcNotificationGroup0 payload=AdcNotificationPayloadType
        // payload-contract: AcpdCdd_AdcNotificationGroup1 payload=AdcNotificationPayloadType
        // payload-contract: AcpdCdd_AdcNotificationSupply payload=AdcNotificationPayloadType
        // payload-contract: returnInputData payload=InputDataType
        // payload-contract: AcpdCdd_Process payload=InputDataType
        // payload-contract: returnProcessedData payload=ChannelMeansType
        // payload-contract: AcpdCdd_Monitoring payload=ChannelMeansType
        // payload-contract: returnMonitoringStatus payload=MonitoringStatusPayloadType
        // payload-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc payload=ProcessedSensorOutputPayloadType

        part def AdcService {
            // port-contract: to_input_AcpdCdd_AdcNotificationGroup0_1_Supply role=caller message=AcpdCdd_AdcNotificationGroup0_1_Supply
            port to_input_AcpdCdd_AdcNotificationGroup0_1_Supply : RuntimeCallerPort;
        }
        part def AdcBistService {
            // provides-operation: AdcBist_GetVaref1ErrorStatus
            // provides-operation: returnVARef1ErrorFlag
            // provides-operation: AdcBist_GetVaref2ErrorStatus
            // provides-operation: returnVARef2ErrorFlag
            // port-contract: from_acpdCdd_AdcBist_GetVaref1ErrorStatus role=callee message=AdcBist_GetVaref1ErrorStatus
            port from_acpdCdd_AdcBist_GetVaref1ErrorStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnVARef1ErrorFlag role=caller message=returnVARef1ErrorFlag
            port to_acpdCdd_returnVARef1ErrorFlag : RuntimeCallerPort;
            // port-contract: from_acpdCdd_AdcBist_GetVaref2ErrorStatus role=callee message=AdcBist_GetVaref2ErrorStatus
            port from_acpdCdd_AdcBist_GetVaref2ErrorStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnVARef2ErrorFlag role=caller message=returnVARef2ErrorFlag
            port to_acpdCdd_returnVARef2ErrorFlag : RuntimeCallerPort;
        }
        part def RteService {
            // provides-operation: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // provides-operation: returnActivationStatus
            // provides-operation: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // port-contract: from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation role=callee message=Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            port from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation : RuntimeCalleePort;
            // port-contract: to_powermanagement_returnActivationStatus role=caller message=returnActivationStatus
            port to_powermanagement_returnActivationStatus : RuntimeCallerPort;
            // port-contract: from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc role=callee message=Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            port from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc : RuntimeCalleePort;
        }
        part def AcpdCddCoordinator {
            // port-contract: to_powermanagement_AcpdCdd_Activation role=caller message=AcpdCdd_Activation
            port to_powermanagement_AcpdCdd_Activation : RuntimeCallerPort;
            // port-contract: from_powermanagement_returnFromPowermanagement role=callee message=returnFromPowermanagement
            port from_powermanagement_returnFromPowermanagement : RuntimeCalleePort;
            // port-contract: to_input_AcpdCdd_CollectInputData role=caller message=AcpdCdd_CollectInputData
            port to_input_AcpdCdd_CollectInputData : RuntimeCallerPort;
            // port-contract: from_input_returnInputData role=callee message=returnInputData
            port from_input_returnInputData : RuntimeCalleePort;
            // port-contract: to_process_AcpdCdd_Process role=caller message=AcpdCdd_Process
            port to_process_AcpdCdd_Process : RuntimeCallerPort;
            // port-contract: from_process_returnProcessedData role=callee message=returnProcessedData
            port from_process_returnProcessedData : RuntimeCalleePort;
            // port-contract: to_powermanagement_AcpdCdd_PowermanagementCalcStatus role=caller message=AcpdCdd_PowermanagementCalcStatus
            port to_powermanagement_AcpdCdd_PowermanagementCalcStatus : RuntimeCallerPort;
            // port-contract: from_powermanagement_returnPowerState role=callee message=returnPowerState
            port from_powermanagement_returnPowerState : RuntimeCalleePort;
            // port-contract: to_adcBist_AdcBist_GetVaref1ErrorStatus role=caller message=AdcBist_GetVaref1ErrorStatus
            port to_adcBist_AdcBist_GetVaref1ErrorStatus : RuntimeCallerPort;
            // port-contract: from_adcBist_returnVARef1ErrorFlag role=callee message=returnVARef1ErrorFlag
            port from_adcBist_returnVARef1ErrorFlag : RuntimeCalleePort;
            // port-contract: to_adcBist_AdcBist_GetVaref2ErrorStatus role=caller message=AdcBist_GetVaref2ErrorStatus
            port to_adcBist_AdcBist_GetVaref2ErrorStatus : RuntimeCallerPort;
            // port-contract: from_adcBist_returnVARef2ErrorFlag role=callee message=returnVARef2ErrorFlag
            port from_adcBist_returnVARef2ErrorFlag : RuntimeCalleePort;
            // port-contract: to_monitoring_AcpdCdd_Monitoring role=caller message=AcpdCdd_Monitoring
            port to_monitoring_AcpdCdd_Monitoring : RuntimeCallerPort;
            // port-contract: from_monitoring_returnAcceleratorData role=callee message=returnAcceleratorData
            port from_monitoring_returnAcceleratorData : RuntimeCalleePort;
            // port-contract: to_output_AcpdCdd_Output role=caller message=AcpdCdd_Output
            port to_output_AcpdCdd_Output : RuntimeCallerPort;
        }
        part def AcpdCddInput {
            // provides-operation: AcpdCdd_CollectInputData
            // provides-operation: AcpdCdd_AdcNotificationGroup0_1_Supply
            // provides-operation: returnInputData
            // port-contract: from_acpdCdd_AcpdCdd_CollectInputData role=callee message=AcpdCdd_CollectInputData
            port from_acpdCdd_AcpdCdd_CollectInputData : RuntimeCalleePort;
            // port-contract: from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply role=callee message=AcpdCdd_AdcNotificationGroup0_1_Supply
            port from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnInputData role=caller message=returnInputData
            port to_acpdCdd_returnInputData : RuntimeCallerPort;
        }
        part def AcpdCddProcess {
            // provides-operation: AcpdCdd_Process
            // provides-operation: returnProcessedData
            // port-contract: from_acpdCdd_AcpdCdd_Process role=callee message=AcpdCdd_Process
            port from_acpdCdd_AcpdCdd_Process : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnProcessedData role=caller message=returnProcessedData
            port to_acpdCdd_returnProcessedData : RuntimeCallerPort;
        }
        part def AcpdCddPowermanagement {
            // provides-operation: AcpdCdd_Activation
            // provides-operation: returnFromPowermanagement
            // provides-operation: AcpdCdd_PowermanagementCalcStatus
            // provides-operation: returnPowerState
            // port-contract: from_acpdCdd_AcpdCdd_Activation role=callee message=AcpdCdd_Activation
            port from_acpdCdd_AcpdCdd_Activation : RuntimeCalleePort;
            // port-contract: to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation role=caller message=Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            port to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation : RuntimeCallerPort;
            // port-contract: from_rte_returnActivationStatus role=callee message=returnActivationStatus
            port from_rte_returnActivationStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnFromPowermanagement role=caller message=returnFromPowermanagement
            port to_acpdCdd_returnFromPowermanagement : RuntimeCallerPort;
            // port-contract: from_acpdCdd_AcpdCdd_PowermanagementCalcStatus role=callee message=AcpdCdd_PowermanagementCalcStatus
            port from_acpdCdd_AcpdCdd_PowermanagementCalcStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnPowerState role=caller message=returnPowerState
            port to_acpdCdd_returnPowerState : RuntimeCallerPort;
        }
        part def AcpdCddMonitoring {
            // provides-operation: AcpdCdd_Monitoring
            // provides-operation: returnAcceleratorData
            // port-contract: from_acpdCdd_AcpdCdd_Monitoring role=callee message=AcpdCdd_Monitoring
            port from_acpdCdd_AcpdCdd_Monitoring : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnAcceleratorData role=caller message=returnAcceleratorData
            port to_acpdCdd_returnAcceleratorData : RuntimeCallerPort;
        }
        part def AcpdCddOutput {
            // provides-operation: AcpdCdd_Output
            // port-contract: from_acpdCdd_AcpdCdd_Output role=callee message=AcpdCdd_Output
            port from_acpdCdd_AcpdCdd_Output : RuntimeCalleePort;
            // port-contract: to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc role=caller message=Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            port to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc : RuntimeCallerPort;
        }

        part def AcpdCdd_Runtime_InterfaceContractContext {
            part adc : AdcService;
            part adcBist : AdcBistService;
            part rte : RteService;
            part acpdCdd : AcpdCddCoordinator;
            part input : AcpdCddInput;
            part process : AcpdCddProcess;
            part powermanagement : AcpdCddPowermanagement;
            part monitoring : AcpdCddMonitoring;
            part output : AcpdCddOutput;

            // connection-contract: AcpdCdd_Activation AcpdCdd.to_powermanagement_AcpdCdd_Activation -> AcpdCdd_Powermanagement.from_acpdCdd_AcpdCdd_Activation
            // connection-contract: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation AcpdCdd_Powermanagement.to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation -> RTE.from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // connection-contract: returnActivationStatus RTE.to_powermanagement_returnActivationStatus -> AcpdCdd_Powermanagement.from_rte_returnActivationStatus
            // connection-contract: returnFromPowermanagement AcpdCdd_Powermanagement.to_acpdCdd_returnFromPowermanagement -> AcpdCdd.from_powermanagement_returnFromPowermanagement
            // connection-contract: AcpdCdd_CollectInputData AcpdCdd.to_input_AcpdCdd_CollectInputData -> AcpdCdd_Input.from_acpdCdd_AcpdCdd_CollectInputData
            // connection-contract: AcpdCdd_AdcNotificationGroup0_1_Supply ADC.to_input_AcpdCdd_AdcNotificationGroup0_1_Supply -> AcpdCdd_Input.from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply
            // connection-contract: returnInputData AcpdCdd_Input.to_acpdCdd_returnInputData -> AcpdCdd.from_input_returnInputData
            // connection-contract: AcpdCdd_Process AcpdCdd.to_process_AcpdCdd_Process -> AcpdCdd_Process.from_acpdCdd_AcpdCdd_Process
            // connection-contract: returnProcessedData AcpdCdd_Process.to_acpdCdd_returnProcessedData -> AcpdCdd.from_process_returnProcessedData
            // connection-contract: AcpdCdd_PowermanagementCalcStatus AcpdCdd.to_powermanagement_AcpdCdd_PowermanagementCalcStatus -> AcpdCdd_Powermanagement.from_acpdCdd_AcpdCdd_PowermanagementCalcStatus
            // connection-contract: returnPowerState AcpdCdd_Powermanagement.to_acpdCdd_returnPowerState -> AcpdCdd.from_powermanagement_returnPowerState
            // connection-contract: AdcBist_GetVaref1ErrorStatus AcpdCdd.to_adcBist_AdcBist_GetVaref1ErrorStatus -> AdcBist.from_acpdCdd_AdcBist_GetVaref1ErrorStatus
            // connection-contract: returnVARef1ErrorFlag AdcBist.to_acpdCdd_returnVARef1ErrorFlag -> AcpdCdd.from_adcBist_returnVARef1ErrorFlag
            // connection-contract: AdcBist_GetVaref2ErrorStatus AcpdCdd.to_adcBist_AdcBist_GetVaref2ErrorStatus -> AdcBist.from_acpdCdd_AdcBist_GetVaref2ErrorStatus
            // connection-contract: returnVARef2ErrorFlag AdcBist.to_acpdCdd_returnVARef2ErrorFlag -> AcpdCdd.from_adcBist_returnVARef2ErrorFlag
            // connection-contract: AcpdCdd_Monitoring AcpdCdd.to_monitoring_AcpdCdd_Monitoring -> AcpdCdd_Monitoring.from_acpdCdd_AcpdCdd_Monitoring
            // connection-contract: returnAcceleratorData AcpdCdd_Monitoring.to_acpdCdd_returnAcceleratorData -> AcpdCdd.from_monitoring_returnAcceleratorData
            // connection-contract: AcpdCdd_Output AcpdCdd.to_output_AcpdCdd_Output -> AcpdCdd_Output.from_acpdCdd_AcpdCdd_Output
            // connection-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc AcpdCdd_Output.to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc -> RTE.from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        }

        part runtimeInterfaceContractContext : AcpdCdd_Runtime_InterfaceContractContext;
    }
}

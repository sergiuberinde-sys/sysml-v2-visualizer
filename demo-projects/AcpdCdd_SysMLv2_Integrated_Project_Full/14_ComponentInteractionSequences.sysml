package AcpdCdd_SysMLv2 {

    package ComponentInteractionSequences {

        part def AcpdCdd_Input_Sequence_AcpdCddParticipant {
            event occurrence callCollectInputData;
            event occurrence receiveInputData;
        }

        part def AcpdCdd_Input_Sequence_AcpdCddInputParticipant {
            event occurrence receiveCollectInputDataCall;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcGroup0Notification;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcGroup1Notification;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcSupplyNotification;
            event occurrence returnInputData;
        }

        part def AcpdCdd_Input_Sequence_AdcParticipant {
            event occurrence notifyGroup0;
            event occurrence notifyGroup1;
            event occurrence notifySupply;
        }

        part def AcpdCdd_Input_Sequence {

            part acpdCdd[1] : AcpdCdd_Input_Sequence_AcpdCddParticipant;

            part acpdCddInput[1] : AcpdCdd_Input_Sequence_AcpdCddInputParticipant;

            part adc[1] : AcpdCdd_Input_Sequence_AdcParticipant;

            message AcpdCdd_CollectInputData
                from acpdCdd.callCollectInputData
                to acpdCddInput.receiveCollectInputDataCall;
            message AcpdCdd_AdcNotificationGroup0
                from adc.notifyGroup0
                to acpdCddInput.receiveAdcGroup0Notification;
            message AcpdCdd_AdcNotificationGroup1
                from adc.notifyGroup1
                to acpdCddInput.receiveAdcGroup1Notification;
            message AcpdCdd_AdcNotificationSupply
                from adc.notifySupply
                to acpdCddInput.receiveAdcSupplyNotification;

            message returnInputData
                from acpdCddInput.returnInputData
                to acpdCdd.receiveInputData;
        }

        part def AcpdCdd_Process_Sequence_AcpdCddParticipant {
            event occurrence callProcess;
            event occurrence receiveProcessedData;
        }

        part def AcpdCdd_Process_Sequence_AcpdCddProcessParticipant {
            event occurrence receiveProcessCall;
            event occurrence returnProcessedData;
        }

        part def AcpdCdd_Process_Sequence {

            part acpdCdd[1] : AcpdCdd_Process_Sequence_AcpdCddParticipant;

            part acpdCddProcess[1] : AcpdCdd_Process_Sequence_AcpdCddProcessParticipant;

            message AcpdCdd_Process
                from acpdCdd.callProcess
                to acpdCddProcess.receiveProcessCall;

            message returnProcessedData
                from acpdCddProcess.returnProcessedData
                to acpdCdd.receiveProcessedData;
        }

        part def AcpdCdd_Powermanagement_Sequence_AcpdCddParticipant {
            event occurrence callActivation;
            event occurrence receiveActivationReturn;
            event occurrence callPowermanagementCalcStatus;
            event occurrence receivePowerState;
        }

        part def AcpdCdd_Powermanagement_Sequence_AcpdCddPowermanagementParticipant {
            event occurrence receiveActivationCall;
            event occurrence requestActivationStatus;
            event occurrence receiveActivationStatus;
            event occurrence returnActivationComplete;
            event occurrence receivePowermanagementCalcStatusCall;
            event occurrence requestDioPowerChannelUpdate;
            event occurrence returnPowerState;
        }

        part def AcpdCdd_Powermanagement_Sequence_RteParticipant {
            event occurrence receiveActivationReadRequest;
            event occurrence returnActivationStatus;
        }

        part def AcpdCdd_Powermanagement_Sequence_DioParticipant {
            event occurrence receivePowerChannelUpdate;
        }

        part def AcpdCdd_Powermanagement_Sequence {

            part acpdCdd[1] : AcpdCdd_Powermanagement_Sequence_AcpdCddParticipant;

            part acpdCddPowermanagement[1] : AcpdCdd_Powermanagement_Sequence_AcpdCddPowermanagementParticipant;

            part rte[1] : AcpdCdd_Powermanagement_Sequence_RteParticipant;

            part dio[1] : AcpdCdd_Powermanagement_Sequence_DioParticipant;

            message AcpdCdd_Activation
                from acpdCdd.callActivation
                to acpdCddPowermanagement.receiveActivationCall;

            message Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
                from acpdCddPowermanagement.requestActivationStatus
                to rte.receiveActivationReadRequest;

            message returnActivationStatus
                from rte.returnActivationStatus
                to acpdCddPowermanagement.receiveActivationStatus;

            message returnFromPowermanagement
                from acpdCddPowermanagement.returnActivationComplete
                to acpdCdd.receiveActivationReturn;

            message AcpdCdd_PowermanagementCalcStatus
                from acpdCdd.callPowermanagementCalcStatus
                to acpdCddPowermanagement.receivePowermanagementCalcStatusCall;

            message Dio_WriteChannel
                from acpdCddPowermanagement.requestDioPowerChannelUpdate
                to dio.receivePowerChannelUpdate;

            message returnPowerState
                from acpdCddPowermanagement.returnPowerState
                to acpdCdd.receivePowerState;
        }

        part def AcpdCdd_Monitoring_Sequence_AcpdCddParticipant {
            event occurrence callAdcBistVaref1;
            event occurrence receiveVaref1ErrorFlag;
            event occurrence callAdcBistVaref2;
            event occurrence receiveVaref2ErrorFlag;
            event occurrence callMonitoring;
            event occurrence receiveAcceleratorData;
        }

        part def AcpdCdd_Monitoring_Sequence_AdcBistParticipant {
            event occurrence receiveVaref1StatusRequest;
            event occurrence returnVaref1ErrorFlag;
            event occurrence receiveVaref2StatusRequest;
            event occurrence returnVaref2ErrorFlag;
        }

        part def AcpdCdd_Monitoring_Sequence_AcpdCddMonitoringParticipant {
            event occurrence receiveMonitoringCall;
            event occurrence reportDiagnosticEvent;
            event occurrence returnAcceleratorData;
        }

        part def AcpdCdd_Monitoring_Sequence_DemParticipant {
            event occurrence receiveDiagnosticEventReport;
        }

        part def AcpdCdd_Monitoring_Sequence {

            part acpdCdd[1] : AcpdCdd_Monitoring_Sequence_AcpdCddParticipant;

            part adcBist[1] : AcpdCdd_Monitoring_Sequence_AdcBistParticipant;

            part acpdCddMonitoring[1] : AcpdCdd_Monitoring_Sequence_AcpdCddMonitoringParticipant;

            part dem[1] : AcpdCdd_Monitoring_Sequence_DemParticipant;

            message AdcBist_GetVaref1ErrorStatus
                from acpdCdd.callAdcBistVaref1
                to adcBist.receiveVaref1StatusRequest;

            message returnVARef1ErrorFlag
                from adcBist.returnVaref1ErrorFlag
                to acpdCdd.receiveVaref1ErrorFlag;

            message AdcBist_GetVaref2ErrorStatus
                from acpdCdd.callAdcBistVaref2
                to adcBist.receiveVaref2StatusRequest;

            message returnVARef2ErrorFlag
                from adcBist.returnVaref2ErrorFlag
                to acpdCdd.receiveVaref2ErrorFlag;

            message AcpdCdd_Monitoring
                from acpdCdd.callMonitoring
                to acpdCddMonitoring.receiveMonitoringCall;

            message Dem_ReportErrorStatus
                from acpdCddMonitoring.reportDiagnosticEvent
                to dem.receiveDiagnosticEventReport;

            message returnAcceleratorData
                from acpdCddMonitoring.returnAcceleratorData
                to acpdCdd.receiveAcceleratorData;
        }

        part def AcpdCdd_Output_Sequence_AcpdCddParticipant {
            event occurrence callOutput;
        }

        part def AcpdCdd_Output_Sequence_AcpdCddOutputParticipant {
            event occurrence receiveOutputCall;
            event occurrence requestRteWrite;
        }

        part def AcpdCdd_Output_Sequence_RteParticipant {
            event occurrence receiveRteWrite;
        }

        part def AcpdCdd_Output_Sequence {

            part acpdCdd[1] : AcpdCdd_Output_Sequence_AcpdCddParticipant;

            part acpdCddOutput[1] : AcpdCdd_Output_Sequence_AcpdCddOutputParticipant;

            part rte[1] : AcpdCdd_Output_Sequence_RteParticipant;

            message AcpdCdd_Output
                from acpdCdd.callOutput
                to acpdCddOutput.receiveOutputCall;

            message Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
                from acpdCddOutput.requestRteWrite
                to rte.receiveRteWrite;
        }

        part acpdCddInputSequence : AcpdCdd_Input_Sequence;
        part acpdCddProcessSequence : AcpdCdd_Process_Sequence;
        part acpdCddPowermanagementSequence : AcpdCdd_Powermanagement_Sequence;
        part acpdCddMonitoringSequence : AcpdCdd_Monitoring_Sequence;
        part acpdCddOutputSequence : AcpdCdd_Output_Sequence;
    }
}

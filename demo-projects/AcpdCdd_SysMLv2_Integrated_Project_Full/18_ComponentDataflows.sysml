package ComponentDataflows {

    private import Types::*;

    // Component-level dataflow/interconnection view.
    // This file is intentionally data-oriented, not sequence-oriented.
    //
    // Purpose:
    // - show which runtime participants exchange which typed payloads
    // - support the interconnection view
    // - keep sequence ordering in 14_ComponentInteractionSequences.sysml
    // - keep runtime contract checking in 17_RuntimeInteractionContracts.sysml


    port def AdcNotificationOutPort {
        out item payload : AdcNotificationPayloadType;
    }

    port def AdcNotificationInPort {
        in item payload : AdcNotificationPayloadType;
    }

    port def InputDataOutPort {
        out item payload : InputDataType;
    }

    port def InputDataInPort {
        in item payload : InputDataType;
    }

    port def ProcessedDataOutPort {
        out item payload : ChannelMeansType;
    }

    port def ProcessedDataInPort {
        in item payload : ChannelMeansType;
    }

    port def MonitoringStatusOutPort {
        out item payload : MonitoringStatusPayloadType;
    }

    port def MonitoringStatusInPort {
        in item payload : MonitoringStatusPayloadType;
    }

    port def ActivationStatusOutPort {
        out item payload : ActivationStatusPayloadType;
    }

    port def ActivationStatusInPort {
        in item payload : ActivationStatusPayloadType;
    }

    port def SensorOutputOutPort {
        out item payload : ProcessedSensorOutputPayloadType;
    }

    port def SensorOutputInPort {
        in item payload : ProcessedSensorOutputPayloadType;
    }

    port def DioCommandOutPort {
        out item payload : DioCommandPayloadType;
    }

    port def DioCommandInPort {
        in item payload : DioCommandPayloadType;
    }

    port def AdcBistStatusOutPort {
        out item payload : AdcBistStatusPayloadType;
    }

    port def AdcBistStatusInPort {
        in item payload : AdcBistStatusPayloadType;
    }

    part def AdcDataflowNode {
        port adcNotificationOut : AdcNotificationOutPort;
    }

    part def AdcBistDataflowNode {
        port adcBistStatusOut : AdcBistStatusOutPort;
    }

    part def RteDataflowNode {
        port activationStatusOut : ActivationStatusOutPort;
        port sensorOutputIn : SensorOutputInPort;
    }

    part def DioDataflowNode {
        port powerCommandIn : DioCommandInPort;
    }

    part def AcpdCddCoordinatorDataflowNode {
        port activationRequestOut : ActivationStatusOutPort;
        port activationStatusIn : ActivationStatusInPort;
        port inputDataIn : InputDataInPort;
        port processedDataIn : ProcessedDataInPort;
        port monitoringStatusIn : MonitoringStatusInPort;
        port sensorOutputOut : SensorOutputOutPort;
    }

    part def AcpdCddInputDataflowNode {
        port adcNotificationIn : AdcNotificationInPort;
        port inputDataOut : InputDataOutPort;
    }

    part def AcpdCddProcessDataflowNode {
        port inputDataIn : InputDataInPort;
        port processedDataOut : ProcessedDataOutPort;
    }

    part def AcpdCddPowermanagementDataflowNode {
        port activationRequestIn : ActivationStatusInPort;
        port activationStatusOut : ActivationStatusOutPort;
        port powerCommandOut : DioCommandOutPort;
    }

    part def AcpdCddMonitoringDataflowNode {
        port processedDataIn : ProcessedDataInPort;
        port adcBistStatusIn : AdcBistStatusInPort;
        port monitoringStatusOut : MonitoringStatusOutPort;
    }

    part def AcpdCddOutputDataflowNode {
        port processedDataIn : ProcessedDataInPort;
        port monitoringStatusIn : MonitoringStatusInPort;
        port sensorOutputOut : SensorOutputOutPort;
    }

    part def AcpdCdd_DataflowInterconnection {

        part adc[1] : AdcDataflowNode;

        part adcBist[1] : AdcBistDataflowNode;

        part rte[1] : RteDataflowNode;

        part dio[1] : DioDataflowNode;

        part acpdCdd[1] : AcpdCddCoordinatorDataflowNode;

        part acpdCddInput[1] : AcpdCddInputDataflowNode;

        part acpdCddProcess[1] : AcpdCddProcessDataflowNode;

        part acpdCddPowermanagement[1] : AcpdCddPowermanagementDataflowNode;

        part acpdCddMonitoring[1] : AcpdCddMonitoringDataflowNode;

        part acpdCddOutput[1] : AcpdCddOutputDataflowNode;

        // ADC notification payloads entering AcpdCdd input handling.
        // payload-type: AdcNotificationPayloadType
        flow adcNotificationData : AdcNotificationPayloadType
            from adc.adcNotificationOut
            to acpdCddInput.adcNotificationIn;

        // Input data produced by input handling and consumed by process.
        // payload-type: InputDataType
        flow inputDataToCoordinator : InputDataType
            from acpdCddInput.inputDataOut
            to acpdCdd.inputDataIn;

        // Input data consumed by processing.
        // payload-type: InputDataType
        flow inputDataToProcess : InputDataType
            from acpdCdd.inputDataIn
            to acpdCddProcess.inputDataIn;

        // Processed sensor values produced by process.
        // payload-type: ChannelMeansType
        flow processedDataToCoordinator : ChannelMeansType
            from acpdCddProcess.processedDataOut
            to acpdCdd.processedDataIn;

        // Processed data consumed by monitoring.
        // payload-type: ChannelMeansType
        flow processedDataToMonitoring : ChannelMeansType
            from acpdCdd.processedDataIn
            to acpdCddMonitoring.processedDataIn;

        // Processed data consumed by output.
        // payload-type: ChannelMeansType
        flow processedDataToOutput : ChannelMeansType
            from acpdCdd.processedDataIn
            to acpdCddOutput.processedDataIn;

        // ADCBIST reference-voltage status consumed by monitoring.
        // payload-type: AdcBistStatusPayloadType
        flow adcBistStatusToMonitoring : AdcBistStatusPayloadType
            from adcBist.adcBistStatusOut
            to acpdCddMonitoring.adcBistStatusIn;

        // Monitoring status consumed by output for qualifier/error reaction.
        // payload-type: MonitoringStatusPayloadType
        flow monitoringStatusToCoordinator : MonitoringStatusPayloadType
            from acpdCddMonitoring.monitoringStatusOut
            to acpdCdd.monitoringStatusIn;

        // Monitoring status consumed by output.
        // payload-type: MonitoringStatusPayloadType
        flow monitoringStatusToOutput : MonitoringStatusPayloadType
            from acpdCdd.monitoringStatusIn
            to acpdCddOutput.monitoringStatusIn;

        // RTE activation status consumed by powermanagement.
        // payload-type: ActivationStatusPayloadType
        flow activationStatusToPowermanagement : ActivationStatusPayloadType
            from rte.activationStatusOut
            to acpdCddPowermanagement.activationStatusOut;

        // Power command from powermanagement to DIO.
        // payload-type: DioCommandPayloadType
        flow powerCommandToDio : DioCommandPayloadType
            from acpdCddPowermanagement.powerCommandOut
            to dio.powerCommandIn;

        // Final processed/qualified signal output to RTE.
        // payload-type: ProcessedSensorOutputPayloadType
        flow sensorOutputToRte : ProcessedSensorOutputPayloadType
            from acpdCddOutput.sensorOutputOut
            to rte.sensorOutputIn;
    }
}

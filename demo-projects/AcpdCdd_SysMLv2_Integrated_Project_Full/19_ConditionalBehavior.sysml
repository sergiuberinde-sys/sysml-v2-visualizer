
package ConditionalBehaviorViews {

    private import Types::*;

    // Conditional behavior view.
    // Use this file to visualize decision/merge-style behavior in Eclipse.
    // Sequence ordering remains in 14_ComponentInteractionSequences.sysml.
    // Typed data movement remains in 18_ComponentDataflows.sysml.

    action def AcpdCdd_InputNotificationHandling_Conditional {

        in item notificationPayload : AdcNotificationPayloadType;
        out item inputData : InputDataType;

        action receiveAdcNotification;

        if notificationArrived {
            action updateAdcInputBuffer;
            action updateNotificationTimestamp;
            action clearMissingNotificationCounter;
        }
        else {
            action incrementMissingNotificationCounter;
            action keepPreviousInputBuffer;
        }

        action publishInputData;

        first receiveAdcNotification then notificationArrived;
        first notificationArrived then publishInputData;
    }

    action def AcpdCdd_TimestampSupervision_Conditional {

        in item inputData : InputDataType;
        out item monitoringStatus : MonitoringStatusPayloadType;

        action readNotificationTimestamps;

        if timestampWithinTolerance {
            action markNotificationFresh;
            action keepQualifierCandidateOk;
        }
        else {
            // trlc-satisfies: 28711565
            // trlc-satisfies: 28711591
            action markNotificationStale;
            action requestQualifierErrorReaction;
        }

        action publishMonitoringStatus;

        first readNotificationTimestamps then timestampWithinTolerance;
        first timestampWithinTolerance then publishMonitoringStatus;
    }

    action def AcpdCdd_DeviationCheck_Conditional {

        in item processedData : ChannelMeansType;
        out item monitoringStatus : MonitoringStatusPayloadType;

        action readSensorPairMeans;

        if sensorDeviationWithinLimit {
            action acceptSensorPairPlausible;
            action keepSensorQualifierOk;
        }
        else {
            // trlc-satisfies: 25090543
            action detectSensorPairImplausible;
            action requestSensorQualifierError;
        }

        action publishDeviationCheckResult;

        first readSensorPairMeans then sensorDeviationWithinLimit;
        first sensorDeviationWithinLimit then publishDeviationCheckResult;
    }

    action def AcpdCdd_OutputQualifier_Conditional {

        in item processedData : ChannelMeansType;
        in item monitoringStatus : MonitoringStatusPayloadType;
        out item rteOutput : ProcessedSensorOutputPayloadType;

        action readProcessedDataAndMonitoringStatus;

        if monitoringStatusOk {
            action writeQualifiedSensorValuesToRte;
        }
        else {
            // trlc-satisfies: 28711397
            action forceErrorQualifier;
            action writeErrorQualifiedValuesToRte;
        }

        action publishRteOutput;

        first readProcessedDataAndMonitoringStatus then monitoringStatusOk;
        first monitoringStatusOk then publishRteOutput;
    }

    action def AcpdCdd_Powermanagement_Conditional {

        in item activationStatus : ActivationStatusPayloadType;
        out item dioCommand : DioCommandPayloadType;

        action readActivationStatus;

        if activationRequested {
            action commandPowerOn;
        }
        else {
            action commandPowerOff;
        }

        action publishDioCommand;

        first readActivationStatus then activationRequested;
        first activationRequested then publishDioCommand;
    }

    action def AcpdCdd_Main10ms_ConditionalOverview {

        action collectInputData;
        action checkInputFreshness;
        action computeProcessedSensorValues;
        action checkSensorPlausibility;
        action updateOutputQualifier;
        action writeRteOutput;

        first collectInputData then checkInputFreshness;

        if inputDataFresh {
            action continueWithProcessing;
            first continueWithProcessing then computeProcessedSensorValues;
        }
        else {
            action requestErrorQualifierDueToStaleInput;
            first requestErrorQualifierDueToStaleInput then updateOutputQualifier;
        }

        first computeProcessedSensorValues then checkSensorPlausibility;

        if sensorPairPlausible {
            action keepQualifierOk;
        }
        else {
            action requestErrorQualifierDueToImplausibility;
        }

        first sensorPairPlausible then updateOutputQualifier;
        first updateOutputQualifier then writeRteOutput;
    }
}

package AcpdCdd_SysMLv2 {

    package ConditionalBehaviorViews {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

        // Conditional behavior views.
        // Official SysML v2 action/control semantics are modeled textually.
        // A visualizer may render action usages with these names as:
        // - Decision_* : decision diamond
        // - Merge_*    : merge diamond
        // - Fork_*     : fork bar
        // - Join_*     : join bar
        // The model remains parser-safe: these are normal action usages, not pseudo-SysML syntax.

        action def AcpdCdd_Input_Main10ms_Branching {

            in item notificationPayload : AdcNotificationPayloadType;
            out item inputData : InputDataType;

            // Guard values are typed Boolean features of the action outputs.
            // The guarded successions below follow the official pattern:
            // first <source> if <Boolean expression> then <target>;
            // A behavior visualizer can render these as dotted guarded arrows.

            action ReceiveAdcNotification {
                out item notification : AdcNotificationPayloadType;
            }

            action DecodeAdcGroups {
                in item notification : AdcNotificationPayloadType;
                out item decodedInputData : InputDataType;
            }

            action IncrementMissingNotificationCounter;
            action KeepPreviousInputBuffer {
                out item fallbackInputData : InputDataType;
            }
            action SetMissingNotificationQualifier {
                in item fallbackInputData : InputDataType;
                out item qualifiedFallbackInputData : InputDataType;
            }

            action ValidateTimestamp {
                in item decodedInputData : InputDataType;
                out item timestampCheckedInputData : InputDataType;
            }
            action MarkNotificationStale {
                in item decodedInputData : InputDataType;
                out item staleInputData : InputDataType;
            }

            action Fork_IndependentInputChecks;
            action ValidateGroup0Sample {
                in item inputData : InputDataType;
                out item group0CheckedInputData : InputDataType;
            }
            action ValidateGroup1Sample {
                in item inputData : InputDataType;
                out item group1CheckedInputData : InputDataType;
            }
            action ValidateSupplySample {
                in item inputData : InputDataType;
                out item supplyCheckedInputData : InputDataType;
            }
            action Join_IndependentInputChecks;

            action SetGroup0InvalidQualifier;
            action SetGroup1InvalidQualifier;
            action SetSupplyInvalidQualifier;

            action ValidateSensorPairPlausibility {
                in item inputData : InputDataType;
                out item plausibilityCheckedInputData : InputDataType;
            }
            action SetSensorPairImplausibleQualifier;

            action ComposeValidInputData {
                out item composedInputData : InputDataType;
            }
            action ComposeFallbackInputData {
                out item composedInputData : InputDataType;
            }
            action PublishInputData {
                in item inputData : InputDataType;
            }

            // Decision: ADC notification available?
            first ReceiveAdcNotification
                if ReceiveAdcNotification.notification.notificationArrived
                then DecodeAdcGroups;

            first ReceiveAdcNotification
                if not ReceiveAdcNotification.notification.notificationArrived
                then IncrementMissingNotificationCounter;

            first IncrementMissingNotificationCounter then KeepPreviousInputBuffer;
            first KeepPreviousInputBuffer then SetMissingNotificationQualifier;

            flow from ReceiveAdcNotification.notification to DecodeAdcGroups.notification;
            flow from KeepPreviousInputBuffer.fallbackInputData to SetMissingNotificationQualifier.fallbackInputData;

            // Decision: timestamp fresh?
            first DecodeAdcGroups
                if DecodeAdcGroups.decodedInputData.timestampFresh
                then ValidateTimestamp;

            first DecodeAdcGroups
                if not DecodeAdcGroups.decodedInputData.timestampFresh
                then MarkNotificationStale;

            flow from DecodeAdcGroups.decodedInputData to ValidateTimestamp.decodedInputData;
            flow from DecodeAdcGroups.decodedInputData to MarkNotificationStale.decodedInputData;

            // Fork/fan-out of independent checks.
            first ValidateTimestamp then Fork_IndependentInputChecks;
            first Fork_IndependentInputChecks then ValidateGroup0Sample;
            first Fork_IndependentInputChecks then ValidateGroup1Sample;
            first Fork_IndependentInputChecks then ValidateSupplySample;

            flow from ValidateTimestamp.timestampCheckedInputData to ValidateGroup0Sample.inputData;
            flow from ValidateTimestamp.timestampCheckedInputData to ValidateGroup1Sample.inputData;
            flow from ValidateTimestamp.timestampCheckedInputData to ValidateSupplySample.inputData;

            // Guarded outputs from each check. A visualizer may render the false branch as a dotted guarded edge.
            first ValidateGroup0Sample
                if not ValidateGroup0Sample.group0CheckedInputData.group0SampleValid
                then SetGroup0InvalidQualifier;

            first ValidateGroup1Sample
                if not ValidateGroup1Sample.group1CheckedInputData.group1SampleValid
                then SetGroup1InvalidQualifier;

            first ValidateSupplySample
                if not ValidateSupplySample.supplyCheckedInputData.supplySampleValid
                then SetSupplyInvalidQualifier;

            // Join/convergence before plausibility evaluation.
            first ValidateGroup0Sample then Join_IndependentInputChecks;
            first ValidateGroup1Sample then Join_IndependentInputChecks;
            first ValidateSupplySample then Join_IndependentInputChecks;
            first Join_IndependentInputChecks then ValidateSensorPairPlausibility;

            flow from ValidateGroup0Sample.group0CheckedInputData to ValidateSensorPairPlausibility.inputData;
            flow from ValidateGroup1Sample.group1CheckedInputData to ValidateSensorPairPlausibility.inputData;
            flow from ValidateSupplySample.supplyCheckedInputData to ValidateSensorPairPlausibility.inputData;

            // Decision: sensor pair plausible?
            first ValidateSensorPairPlausibility
                if ValidateSensorPairPlausibility.plausibilityCheckedInputData.sensorPairPlausible
                then ComposeValidInputData;

            first ValidateSensorPairPlausibility
                if not ValidateSensorPairPlausibility.plausibilityCheckedInputData.sensorPairPlausible
                then SetSensorPairImplausibleQualifier;

            first SetSensorPairImplausibleQualifier then ComposeFallbackInputData;
            first MarkNotificationStale then ComposeFallbackInputData;
            first SetMissingNotificationQualifier then ComposeFallbackInputData;

            first ComposeValidInputData then PublishInputData;
            first ComposeFallbackInputData then PublishInputData;

            flow from ComposeValidInputData.composedInputData to PublishInputData.inputData;
            flow from ComposeFallbackInputData.composedInputData to PublishInputData.inputData;
        }

        action def AcpdCdd_InputNotificationHandling_Conditional {

            in item notificationPayload : AdcNotificationPayloadType;
            out item inputData : InputDataType;

            attribute notificationArrived : boolean;

            action receiveAdcNotification;
            action Decision_NotificationAvailable;
            action updateAdcInputBuffer;
            action updateNotificationTimestamp;
            action clearMissingNotificationCounter;
            action incrementMissingNotificationCounter;
            action keepPreviousInputBuffer;
            action Merge_NotificationHandling;
            action publishInputData;

            first receiveAdcNotification then Decision_NotificationAvailable;

            if notificationArrived {
                action updateAdcInputBufferPath;
                action updateNotificationTimestampPath;
                action clearMissingNotificationCounterPath;

                first updateAdcInputBufferPath then updateNotificationTimestampPath;
                first updateNotificationTimestampPath then clearMissingNotificationCounterPath;
            }
            else {
                action incrementMissingNotificationCounterPath;
                action keepPreviousInputBufferPath;

                first incrementMissingNotificationCounterPath then keepPreviousInputBufferPath;
            }

            first Decision_NotificationAvailable then Merge_NotificationHandling;
            first Merge_NotificationHandling then publishInputData;
        }

        action def AcpdCdd_TimestampSupervision_Conditional {

            in item inputData : InputDataType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            attribute timestampWithinTolerance : boolean;

            action readNotificationTimestamps;
            action Decision_TimestampWithinTolerance;
            action markNotificationFresh;
            action keepQualifierCandidateOk;
            action markNotificationStale;
            action requestQualifierErrorReaction;
            action Merge_TimestampSupervision;
            action publishMonitoringStatus;

            first readNotificationTimestamps then Decision_TimestampWithinTolerance;

            if timestampWithinTolerance {
                action markNotificationFreshPath;
                action keepQualifierCandidateOkPath;

                first markNotificationFreshPath then keepQualifierCandidateOkPath;
            }
            else {
                // trlc-satisfies: 28711565
                // trlc-satisfies: 28711591
                action markNotificationStalePath;
                action requestQualifierErrorReactionPath;

                first markNotificationStalePath then requestQualifierErrorReactionPath;
            }

            first Decision_TimestampWithinTolerance then Merge_TimestampSupervision;
            first Merge_TimestampSupervision then publishMonitoringStatus;
        }

        action def AcpdCdd_DeviationCheck_Conditional {

            in item processedData : ChannelMeansType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            attribute sensorDeviationWithinLimit : boolean;

            action readSensorPairMeans;
            action Decision_SensorDeviationWithinLimit;
            action acceptSensorPairPlausible;
            action keepSensorQualifierOk;
            action detectSensorPairImplausible;
            action requestSensorQualifierError;
            action Merge_DeviationCheck;
            action publishDeviationCheckResult;

            first readSensorPairMeans then Decision_SensorDeviationWithinLimit;

            if sensorDeviationWithinLimit {
                action acceptSensorPairPlausiblePath;
                action keepSensorQualifierOkPath;

                first acceptSensorPairPlausiblePath then keepSensorQualifierOkPath;
            }
            else {
                // trlc-satisfies: 25090543
                action detectSensorPairImplausiblePath;
                action requestSensorQualifierErrorPath;

                first detectSensorPairImplausiblePath then requestSensorQualifierErrorPath;
            }

            first Decision_SensorDeviationWithinLimit then Merge_DeviationCheck;
            first Merge_DeviationCheck then publishDeviationCheckResult;
        }

        action def AcpdCdd_OutputQualifier_Conditional {

            in item processedData : ChannelMeansType;
            in item monitoringStatus : MonitoringStatusPayloadType;
            out item rteOutput : ProcessedSensorOutputPayloadType;

            attribute monitoringStatusOk : boolean;

            action readProcessedDataAndMonitoringStatus;
            action Decision_MonitoringStatusOk;
            action writeQualifiedSensorValuesToRte;
            action forceErrorQualifier;
            action writeErrorQualifiedValuesToRte;
            action Merge_OutputQualifier;
            action publishRteOutput;

            first readProcessedDataAndMonitoringStatus then Decision_MonitoringStatusOk;

            if monitoringStatusOk {
                action writeQualifiedSensorValuesToRtePath;
            }
            else {
                // trlc-satisfies: 28711397
                action forceErrorQualifierPath;
                action writeErrorQualifiedValuesToRtePath;

                first forceErrorQualifierPath then writeErrorQualifiedValuesToRtePath;
            }

            first Decision_MonitoringStatusOk then Merge_OutputQualifier;
            first Merge_OutputQualifier then publishRteOutput;
        }

        action def AcpdCdd_Powermanagement_Conditional {

            in item activationStatus : ActivationStatusPayloadType;
            out item dioCommand : DioCommandPayloadType;

            attribute activationRequested : boolean;

            action readActivationStatus;
            action Decision_ActivationRequested;
            action commandPowerOn;
            action commandPowerOff;
            action Merge_PowermanagementCommand;
            action publishDioCommand;

            first readActivationStatus then Decision_ActivationRequested;

            if activationRequested {
                action commandPowerOnPath;
            }
            else {
                action commandPowerOffPath;
            }

            first Decision_ActivationRequested then Merge_PowermanagementCommand;
            first Merge_PowermanagementCommand then publishDioCommand;
        }

        action def AcpdCdd_Main10ms_ConditionalOverview {

            attribute inputDataFresh : boolean;
            attribute sensorPairPlausible : boolean;

            action collectInputData;
            action Decision_InputDataFresh;
            action checkInputFreshness;
            action computeProcessedSensorValues;
            action requestErrorQualifierDueToStaleInput;
            action Merge_InputFreshness;
            action checkSensorPlausibility;
            action Decision_SensorPairPlausible;
            action keepQualifierOk;
            action requestErrorQualifierDueToImplausibility;
            action Merge_SensorPlausibility;
            action updateOutputQualifier;
            action writeRteOutput;

            first collectInputData then checkInputFreshness;
            first checkInputFreshness then Decision_InputDataFresh;

            if inputDataFresh {
                action continueWithProcessing;
                first continueWithProcessing then computeProcessedSensorValues;
            }
            else {
                action requestErrorQualifierDueToStaleInputPath;
            }

            first Decision_InputDataFresh then Merge_InputFreshness;
            first Merge_InputFreshness then checkSensorPlausibility;
            first checkSensorPlausibility then Decision_SensorPairPlausible;

            if sensorPairPlausible {
                action keepQualifierOkPath;
            }
            else {
                action requestErrorQualifierDueToImplausibilityPath;
            }

            first Decision_SensorPairPlausible then Merge_SensorPlausibility;
            first Merge_SensorPlausibility then updateOutputQualifier;
            first updateOutputQualifier then writeRteOutput;
        }
    }
}

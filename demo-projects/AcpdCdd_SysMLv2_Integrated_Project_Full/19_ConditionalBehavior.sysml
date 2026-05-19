package AcpdCdd_SysMLv2 {

    package ConditionalBehaviorViews {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;
	private import ScalarValues::Boolean;
        private import AcpdCdd_SysMLv2::AUTOSAR_CDD_FunctionKinds::*;
        // Boolean guards used by explicit conditional branching.
        attribute AdcNotification_hasArrived : Boolean;
        attribute DecodedAdcTimestamp_isFresh : Boolean;
        attribute Group0Sample_isInvalid : Boolean;
        attribute Group1Sample_isInvalid : Boolean;
        attribute SupplySample_isInvalid : Boolean;
        attribute SensorPair_isPlausible : Boolean;



        // Conditional behavior views.
        // Official SysML v2 action/control semantics are modeled textually.
        // A visualizer may render action usages with these names as:
        // - Decision_* : decision diamond
        // - Merge_*    : merge diamond
        // - Fork_*     : fork bar
        // - Join_*     : join bar
        // The model remains parser-safe: these are normal action usages, not pseudo-SysML syntax.

        action AcpdCdd_Input_Main10ms_Branching {

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
                first ReceiveAdcNotification if AdcNotification_hasArrived then DecodeAdcGroups;
                first ReceiveAdcNotification if not AdcNotification_hasArrived then IncrementMissingNotificationCounter;
first IncrementMissingNotificationCounter then KeepPreviousInputBuffer;
            first KeepPreviousInputBuffer then SetMissingNotificationQualifier;

            flow from ReceiveAdcNotification.notification to DecodeAdcGroups.notification;
            flow from KeepPreviousInputBuffer.fallbackInputData to SetMissingNotificationQualifier.fallbackInputData;

            // Decision: timestamp fresh?
                first DecodeAdcGroups if DecodedAdcTimestamp_isFresh then ValidateTimestamp;
                first DecodeAdcGroups if not DecodedAdcTimestamp_isFresh then MarkNotificationStale;
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
                first ValidateGroup0Sample if Group0Sample_isInvalid then SetGroup0InvalidQualifier;
                first ValidateGroup1Sample if Group1Sample_isInvalid then SetGroup1InvalidQualifier;
first ValidateSupplySample if SupplySample_isInvalid then SetSupplyInvalidQualifier;
// Join/convergence before plausibility evaluation.
            first ValidateGroup0Sample then Join_IndependentInputChecks;
            first ValidateGroup1Sample then Join_IndependentInputChecks;
            first ValidateSupplySample then Join_IndependentInputChecks;
            first Join_IndependentInputChecks then ValidateSensorPairPlausibility;

            flow from ValidateGroup0Sample.group0CheckedInputData to ValidateSensorPairPlausibility.inputData;
            flow from ValidateGroup1Sample.group1CheckedInputData to ValidateSensorPairPlausibility.inputData;
            flow from ValidateSupplySample.supplyCheckedInputData to ValidateSensorPairPlausibility.inputData;

            // Decision: sensor pair plausible?
                first ValidateSensorPairPlausibility if SensorPair_isPlausible then ComposeValidInputData;
                first ValidateSensorPairPlausibility if not SensorPair_isPlausible then SetSensorPairImplausibleQualifier;

            first SetSensorPairImplausibleQualifier then ComposeFallbackInputData;
            first MarkNotificationStale then ComposeFallbackInputData;
            first SetMissingNotificationQualifier then ComposeFallbackInputData;

            first ComposeValidInputData then PublishInputData;
            first ComposeFallbackInputData then PublishInputData;

            flow from ComposeValidInputData.composedInputData to PublishInputData.inputData;
            flow from ComposeFallbackInputData.composedInputData to PublishInputData.inputData;
        }

        action AcpdCdd_InputNotificationHandling_Conditional {

            in item notificationPayload : AdcNotificationPayloadType;
            out item inputData : InputDataType;

            attribute notificationArrived : Boolean;

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

                action updateAdcInputBufferPath;
                action updateNotificationTimestampPath;
                action clearMissingNotificationCounterPath;

                first updateAdcInputBufferPath if notificationArrived then updateNotificationTimestampPath;
                first updateNotificationTimestampPath if notificationArrived then clearMissingNotificationCounterPath;
                action incrementMissingNotificationCounterPath;
                action keepPreviousInputBufferPath;

                first incrementMissingNotificationCounterPath if not notificationArrived then keepPreviousInputBufferPath;
first Decision_NotificationAvailable then Merge_NotificationHandling;
            first Merge_NotificationHandling then publishInputData;
        }

        action AcpdCdd_TimestampSupervision_Conditional {

            in item inputData : InputDataType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            attribute timestampWithinTolerance : Boolean;

            action readNotificationTimestamps;
            action Decision_TimestampWithinTolerance;
            action markNotificationFresh;
            action keepQualifierCandidateOk;
            action markNotificationStale;
            action requestQualifierErrorReaction;
            action Merge_TimestampSupervision;
            action publishMonitoringStatus;

            first readNotificationTimestamps then Decision_TimestampWithinTolerance;

                action markNotificationFreshPath;
                action keepQualifierCandidateOkPath;

                first markNotificationFreshPath if timestampWithinTolerance then keepQualifierCandidateOkPath;
                // trlc-satisfies: 28711565
                // trlc-satisfies: 28711591
                action markNotificationStalePath;
                action requestQualifierErrorReactionPath;

                first markNotificationStalePath if not timestampWithinTolerance then requestQualifierErrorReactionPath;
first Decision_TimestampWithinTolerance then Merge_TimestampSupervision;
            first Merge_TimestampSupervision then publishMonitoringStatus;
        }

        action AcpdCdd_DeviationCheck_Conditional {

            in item processedData : ChannelMeansType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            attribute sensorDeviationWithinLimit : Boolean;

            action readSensorPairMeans;
            action Decision_SensorDeviationWithinLimit;
            action acceptSensorPairPlausible;
            action keepSensorQualifierOk;
            action detectSensorPairImplausible;
            action requestSensorQualifierError;
            action Merge_DeviationCheck;
            action publishDeviationCheckResult;

            first readSensorPairMeans then Decision_SensorDeviationWithinLimit;

                action acceptSensorPairPlausiblePath;
                action keepSensorQualifierOkPath;

                first acceptSensorPairPlausiblePath if sensorDeviationWithinLimit then keepSensorQualifierOkPath;
                // trlc-satisfies: 25090543
                action detectSensorPairImplausiblePath;
                action requestSensorQualifierErrorPath;

                first detectSensorPairImplausiblePath if not sensorDeviationWithinLimit then requestSensorQualifierErrorPath;
first Decision_SensorDeviationWithinLimit then Merge_DeviationCheck;
            first Merge_DeviationCheck then publishDeviationCheckResult;
        }

        action AcpdCdd_OutputQualifier_Conditional {

            in item processedData : ChannelMeansType;
            in item monitoringStatus : MonitoringStatusPayloadType;
            out item rteOutput : ProcessedSensorOutputPayloadType;

            attribute monitoringStatusOk : Boolean;

            action readProcessedDataAndMonitoringStatus;
            action Decision_MonitoringStatusOk;
            action writeQualifiedSensorValuesToRte;
            action forceErrorQualifier;
            action writeErrorQualifiedValuesToRte;
            action Merge_OutputQualifier;
            action publishRteOutput;

            first readProcessedDataAndMonitoringStatus then Decision_MonitoringStatusOk;

                action writeQualifiedSensorValuesToRtePath;
                // trlc-satisfies: 28711397
                action forceErrorQualifierPath;
                action writeErrorQualifiedValuesToRtePath;

                first forceErrorQualifierPath if not monitoringStatusOk then writeErrorQualifiedValuesToRtePath;
first Decision_MonitoringStatusOk then Merge_OutputQualifier;
            first Merge_OutputQualifier then publishRteOutput;
        }

        action AcpdCdd_Powermanagement_Conditional {

            in item activationStatus : ActivationStatusPayloadType;
            out item dioCommand : DioCommandPayloadType;

            attribute activationRequested : Boolean;

            action readActivationStatus;
            action Decision_ActivationRequested;
            action commandPowerOn;
            action commandPowerOff;
            action Merge_PowermanagementCommand;
            action publishDioCommand;

            first readActivationStatus then Decision_ActivationRequested;

                action commandPowerOnPath;
                action commandPowerOffPath;
first Decision_ActivationRequested then Merge_PowermanagementCommand;
            first Merge_PowermanagementCommand then publishDioCommand;
        }

        action AcpdCdd_Main10ms_ConditionalOverview {

            attribute inputDataFresh : Boolean;
            attribute sensorPairPlausible : Boolean;

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

                action continueWithProcessing;
                first continueWithProcessing if inputDataFresh then computeProcessedSensorValues;
                action requestErrorQualifierDueToStaleInputPath;
first Decision_InputDataFresh then Merge_InputFreshness;
            first Merge_InputFreshness then checkSensorPlausibility;
            first checkSensorPlausibility then Decision_SensorPairPlausible;

                action keepQualifierOkPath;
                action requestErrorQualifierDueToImplausibilityPath;
first Decision_SensorPairPlausible then Merge_SensorPlausibility;
            first Merge_SensorPlausibility then updateOutputQualifier;
            first updateOutputQualifier then writeRteOutput;
        }
    }
}

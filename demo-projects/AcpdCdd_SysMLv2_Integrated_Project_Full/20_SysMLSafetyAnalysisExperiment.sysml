package GoalOrientedSafetyReasoning {

    private import Types::*;

    // Experimental SysML-v2-native FMEA/safety-reasoning model.
    //
    // Main idea:
    //
    // FailureMode is modeled as a part with attributes.
    // The FailureMode assumes the failure condition has happened.
    // The FailureMode has an objective: reach/maintain a safe state.
    // The FailureMode requires one or more ControlMeasures.
    //
    // If required control measures are not present/implemented,
    // the FailureMode exposes a safety gap.
    //
    // This is intentionally one pilot example:
    // AcpdCddSafety.MissingAdcNotification.

    enum def AsilKind {
        enum QM;
        enum ASIL_A;
        enum ASIL_B;
        enum ASIL_C;
        enum ASIL_D;
    }

    enum def FailureModeStateKind {
        enum AssumedOccurred;
        enum Controlled;
        enum Uncontrolled;
    }

    enum def ControlCoverageKind {
        enum NoControlMeasure;
        enum PartialControlMeasure;
        enum FullControlMeasure;
    }

    part def ControlMeasure {
        attribute implemented : boolean;
        attribute verified : boolean;
        attribute description : ScalarValues::String;
    }

    part def FailureMode {
        attribute asil : AsilKind;
        attribute assumedOccurred : boolean;
        attribute controlCoverage : ControlCoverageKind;
        attribute state : FailureModeStateKind;
        attribute hasSafetyGap : boolean;
        attribute localEffect : ScalarValues::String;
        attribute endEffect : ScalarValues::String;
    }

    part def SafetyGap {
        attribute open : boolean;
        attribute reason : ScalarValues::String;
    }

    requirement def Objective_MitigateMissingAdcNotification {
        doc
        /*
        If ADC notification loss/delay is assumed to occur,
        AcpdCdd shall transition to a controlled safe output state.
        */
    }

    requirement def Assume_MissingAdcNotificationOccurred {
        doc
        /*
        ADC Group0, Group1, or Supply notification is missing
        or arrives later than the configured tolerance.
        */
    }

    requirement def Require_TimestampSupervision {
        doc
        /*
        The failure mode requires timestamp/frequency supervision
        as a detection control measure.
        */
    }

    requirement def Require_ErrorQualifierFallback {
        doc
        /*
        The failure mode requires ERROR qualifier fallback
        as a mitigation control measure.
        */
    }

    part def MissingAdcNotification_FailureModeModel {

        // trlc-failure-mode: AcpdCddSafety.MissingAdcNotification

        part missingAdcNotification : FailureMode {
            attribute asil = ASIL_C;
            attribute assumedOccurred = true;
            attribute controlCoverage = FullControlMeasure;
            attribute state = Controlled;
            attribute hasSafetyGap = false;
            attribute localEffect = "ADC input buffer may not be refreshed.";
            attribute endEffect = "Downstream output could use stale sensor information if not mitigated.";
        }

        objective mitigateFailureMode
            : Objective_MitigateMissingAdcNotification;

        assume failureHasOccurred
            : Assume_MissingAdcNotificationOccurred;

        require timestampSupervisionRequired
            : Require_TimestampSupervision;

        require errorQualifierFallbackRequired
            : Require_ErrorQualifierFallback;

        part timestampSupervision : ControlMeasure {
            attribute implemented = true;
            attribute verified = true;
            attribute description = "Detect missing or delayed ADC notifications by timestamp/frequency supervision.";
        }

        part errorQualifierFallback : ControlMeasure {
            attribute implemented = true;
            attribute verified = true;
            attribute description = "Force affected signal qualifier to ERROR when notification freshness is violated.";
        }

        part noControlMeasureGap : SafetyGap {
            attribute open = false;
            attribute reason = "Required control measures are present and implemented.";
        }
    }

    part def MissingAdcNotification_FailureModeGapExample {

        // This second part is intentionally a negative example for checker/demo purposes.
        // It shows the same failure mode if one required control measure were absent.

        part missingAdcNotification : FailureMode {
            attribute asil = ASIL_C;
            attribute assumedOccurred = true;
            attribute controlCoverage = PartialControlMeasure;
            attribute state = Uncontrolled;
            attribute hasSafetyGap = true;
            attribute localEffect = "ADC input buffer may not be refreshed.";
            attribute endEffect = "Stale sensor information may reach output because required mitigation is missing.";
        }

        objective mitigateFailureMode
            : Objective_MitigateMissingAdcNotification;

        assume failureHasOccurred
            : Assume_MissingAdcNotificationOccurred;

        require timestampSupervisionRequired
            : Require_TimestampSupervision;

        require errorQualifierFallbackRequired
            : Require_ErrorQualifierFallback;

        part timestampSupervision : ControlMeasure {
            attribute implemented = true;
            attribute verified = true;
            attribute description = "Detect missing or delayed ADC notifications.";
        }

        part missingErrorQualifierFallbackGap : SafetyGap {
            attribute open = true;
            attribute reason = "ERROR qualifier fallback is required but no implemented ControlMeasure part is present.";
        }
    }

    action def MissingAdcNotification_ControlCoverageBehavior {

        in item notificationPayload : AdcNotificationPayloadType;
        out item monitoringStatus : MonitoringStatusPayloadType;
        out item rteOutput : ProcessedSensorOutputPayloadType;

        action assumeMissingNotificationOccurred;
        action evaluateRequiredControlMeasures;

        if timestampSupervisionImplemented {
            action detectMissingOrDelayedNotification;
        }
        else {
            action exposeDetectionGap;
        }

        if errorQualifierFallbackImplemented {
            action forceErrorQualifier;
        }
        else {
            action exposeMitigationGap;
        }

        if allRequiredControlsImplemented {
            action markFailureModeControlled;
        }
        else {
            action markFailureModeUncontrolled;
        }

        action publishSafetyAnalysisResult;

        first assumeMissingNotificationOccurred
            then evaluateRequiredControlMeasures;

        first evaluateRequiredControlMeasures
            then timestampSupervisionImplemented;

        first timestampSupervisionImplemented
            then errorQualifierFallbackImplemented;

        first errorQualifierFallbackImplemented
            then allRequiredControlsImplemented;

        first allRequiredControlsImplemented
            then publishSafetyAnalysisResult;
    }
}

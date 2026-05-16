package AcpdCdd_FaultTrees {

    action def MissingAdcNotification_FTA {
        // trlc-failure-mode: AcpdCddSafety.MissingAdcNotification

        action topEvent;

        action notificationPathOrGate;
        // fta-gate: OR

        action missingAdcNotification;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_MissingAdcNotification

        action staleInputBuffer;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_StaleInputBuffer

        action adcCallbackNotExecuted;
        // fta-event: intermediate

        first missingAdcNotification then notificationPathOrGate;
        first staleInputBuffer then notificationPathOrGate;
        first adcCallbackNotExecuted then notificationPathOrGate;
        first notificationPathOrGate then topEvent;
    }

    action def DelayedAdcNotification_FTA {
        // trlc-failure-mode: AcpdCddSafety.DelayedAdcNotification

        action topEvent;

        action delayPathOrGate;
        // fta-gate: OR

        action delayedAdcNotification;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_DelayedAdcNotification

        action timestampWindowExceeded;
        // fta-event: intermediate

        first delayedAdcNotification then delayPathOrGate;
        first timestampWindowExceeded then delayPathOrGate;
        first delayPathOrGate then topEvent;
    }

    action def IncorrectProcessedSensorValue_FTA {
        // trlc-failure-mode: AcpdCddSafety.IncorrectProcessedSensorValue

        action topEvent;

        action processingPathOrGate;
        // fta-gate: OR

        action invalidProcessedSensorValue;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_InvalidProcessedSensorValue

        action incorrectMovingAverageComputation;
        // fta-event: intermediate

        action sensorDeviationNotPlausible;
        // fta-event: intermediate

        first invalidProcessedSensorValue then processingPathOrGate;
        first incorrectMovingAverageComputation then processingPathOrGate;
        first sensorDeviationNotPlausible then processingPathOrGate;
        first processingPathOrGate then topEvent;
    }

    action def MissingMonitoringReaction_FTA {
        // trlc-failure-mode: AcpdCddSafety.MissingMonitoringReaction

        action topEvent;

        action monitoringPathOrGate;
        // fta-gate: OR

        action referenceVoltageErrorNotHandled;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_ReferenceVoltageErrorNotHandled

        action invalidInputNotReacted;
        // fta-event: intermediate

        action invalidProcessingResultNotReacted;
        // fta-event: intermediate

        first referenceVoltageErrorNotHandled then monitoringPathOrGate;
        first invalidInputNotReacted then monitoringPathOrGate;
        first invalidProcessingResultNotReacted then monitoringPathOrGate;
        first monitoringPathOrGate then topEvent;
    }

    action def WrongRteOutput_FTA {
        // trlc-failure-mode: AcpdCddSafety.WrongRteOutput

        action topEvent;

        action outputPathOrGate;
        // fta-gate: OR

        action wrongRteOutput;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_WrongRteOutput

        action wrongQualifierPublished;
        // fta-event: intermediate

        action rteWriteNotPerformed;
        // fta-event: intermediate

        first wrongRteOutput then outputPathOrGate;
        first wrongQualifierPublished then outputPathOrGate;
        first rteWriteNotPerformed then outputPathOrGate;
        first outputPathOrGate then topEvent;
    }
}

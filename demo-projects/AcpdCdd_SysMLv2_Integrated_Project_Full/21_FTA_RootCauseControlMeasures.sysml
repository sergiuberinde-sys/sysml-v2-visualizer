package AcpdCdd_SysMLv2 {
    package FTA_RootCauseControlMeasures {
        doc
        /*
         * FTA-like root-cause and control-measure model.
         *
         * Design rules:
         * - Root causes reference action-owned software failure modes.
         * - Each root cause owns at least one control-measure action usage.
         * - A root cause without a control-measure action is a safety-analysis gap.
         * - The checker enforces that referenced failure modes and control-measure actions exist.
         */

        private import AcpdCdd_SysMLv2::SWFailureCatalogue::*;
        private import AcpdCdd_SysMLv2::AUTOSAR_CDD_FunctionKinds::*;
        private import AcpdCdd_SysMLv2::Input::*;
        private import AcpdCdd_SysMLv2::Process::*;
        private import AcpdCdd_SysMLv2::Powermanagement::*;
        private import AcpdCdd_SysMLv2::Monitoring::*;
        private import AcpdCdd_SysMLv2::Output::*;

        part def RootCause {
            ref causedFailure : SwFailureMode;
        }

        part def SwControlMeasure;

        part adcNotificationMissingOrLate : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_CollectInputData::missingOrStaleInputDataFailure;
            action timestampSupervisionControl;
            action missingDataSupervisionControl;
        }

        part invalidAdcSampleAccepted : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_CollectInputData::missingOrStaleInputDataFailure;
            action missingDataSupervisionControl;
        }

        part wrongAveragingOrConversion : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_Process::incorrectMeanComputationFailure;
            action deviationControl;
            action plausibilityControl;
        }

        part activationSignalMisread : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_Activation::activationMisinterpretedFailure;
            action powerStateQualificationControl;
        }

        part powerTransitionStatusIncorrect : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_PowermanagementCalcStatus::incorrectPowerStatusFailure;
            action powerStateQualificationControl;
        }

        part timestampErrorCounterNotUpdated : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_CheckTimestamps::timestampErrorNotDetectedFailure;
            action monitoringQualifierControl;
        }

        part missingDataCounterNotUpdated : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_MissingDataCheck::missingDataNotDetectedFailure;
            action monitoringQualifierControl;
        }

        part deviationResultIncorrect : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_DeviationCheck::deviationNotDetectedFailure;
            action monitoringQualifierControl;
        }

        part supplyThresholdCheckIncorrect : RootCause {
            ref causedFailure : SwFailureMode = SupplyVoltageCheck::supplyFaultNotDetectedFailure;
            action monitoringQualifierControl;
        }

        part monitoringQualifierComputationIncorrect : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_Monitoring::qualifierIncorrectFailure;
            action outputQualificationControl;
        }

        part outputNullHandlingIncorrect : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_UpdateOutput::nullInputDefaultNotAppliedFailure;
            action defaultOutputControl;
        }

        part rteOutputMappingIncorrect : RootCause {
            ref causedFailure : SwFailureMode = AcpdCdd_UpdateOutput::incorrectRteOutputFailure;
            action rteAtomicWriteControl;
        }
    }
}

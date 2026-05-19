package AcpdCdd_SysMLv2 {
    package SWFailureCatalogue {
        doc
        /*
         * Software failure catalogue for action-level safety analysis.
         *
         * Design rules:
         * - Safety-relevant action definitions own concrete failure-mode items.
         * - Each owned failure mode is typed by one of this catalogue's failure-mode definitions.
         * - Each owned failure mode states its local effect.
         * - Final effect, severity, occurrence, detection ranking, ASIL relevance, and actions are intentionally
         *   left for engineer review in the generated base FMEA table.
         */

        private import ScalarValues::String;

        item def SwFailureMode {
            attribute localEffect : String;
        }

        item def NotExecuted :> SwFailureMode;
        item def ExecutedTooLate :> SwFailureMode;
        item def ExecutedTooEarly :> SwFailureMode;
        item def RepeatedUnexpectedly :> SwFailureMode;

        item def MissingInputData :> SwFailureMode;
        item def InvalidInputData :> SwFailureMode;
        item def MissingOrStaleInputData :> SwFailureMode;
        item def StaleOutputData :> SwFailureMode;
        item def IncorrectOutputData :> SwFailureMode;
        item def DefaultValueNotApplied :> SwFailureMode;

        item def WrongBranchTaken :> SwFailureMode;
        item def ConditionIncorrectlyEvaluated :> SwFailureMode;
        item def DetectionFailed :> SwFailureMode;
        item def RangeCheckFailed :> SwFailureMode;
        item def QualifierIncorrect :> SwFailureMode;
        item def PowerStateIncorrect :> SwFailureMode;
    }
}

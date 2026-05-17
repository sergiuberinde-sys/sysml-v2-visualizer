package AcpdCdd_SysMLv2 {

    package FailurePropagation {

        // Official-library-oriented safety analysis layer.
        //
        // This package intentionally does not duplicate the AcpdCdd architecture with
        // anonymous safety-analysis parts. The propagation context below references the
        // actual architecture and behavior types from the model, and each event occurrence
        // carries an fp-subject comment that is checked by tools/check_failure_propagation_model.py.
        //
        // Interpretation:
        // - event occurrences represent failure/effect occurrences anchored to actual
        //   parts, ports, or behavior/action definitions in the AcpdCdd model.
        // - #causation links represent single-cause propagation.
        // - #multicausation links represent combined-cause propagation.
        //
        // This remains a source model, not a generated FMEA/FTA report.

        private import CauseAndEffect::*;
        private import AcpdCdd_SysMLv2::ComponentDesign::*;
        private import AcpdCdd_SysMLv2::Input::*;
        private import AcpdCdd_SysMLv2::Process::*;
        private import AcpdCdd_SysMLv2::Powermanagement::*;
        private import AcpdCdd_SysMLv2::Monitoring::*;
        private import AcpdCdd_SysMLv2::Output::*;
        private import AcpdCdd_SysMLv2::ExternalActors::*;

        part acpdCddFailurePropagationContext {

            // Typed references to real model elements. These are deliberately refs, not
            // duplicate local parts, so the failure propagation model remains tied to the
            // actual architecture/behavior model.
            ref acpdCdd : AcpdCdd;
            ref input : AcpdCdd_Input;
            ref process : AcpdCdd_Process;
            ref powermanagement : AcpdCdd_Powermanagement;
            ref monitoring : AcpdCdd_Monitoring;
            ref output : AcpdCdd_Output;
            ref rte : RTE;

            // Input-originating failure/effect occurrences.
            // fp-subject: inputCollectionNotExecuted -> AcpdCdd_SysMLv2::Input::AcpdCdd_CollectInputData
            event occurrence inputCollectionNotExecuted;

            // fp-subject: inputCollectionTooLate -> AcpdCdd_SysMLv2::Input::AcpdCdd_CollectInputData
            event occurrence inputCollectionTooLate;

            // fp-subject: staleInputDataProduced -> AcpdCdd_SysMLv2::Input::AcpdCdd_CollectInputData::MapTimestamps
            event occurrence staleInputDataProduced;

            // fp-subject: invalidInputDataProduced -> AcpdCdd_SysMLv2::Input::AcpdCdd_CollectInputData::ValidateCollectedInputData
            event occurrence invalidInputDataProduced;

            // Processing failure/effect occurrences.
            // fp-subject: invalidInputDataAccepted -> AcpdCdd_SysMLv2::Process::AcpdCdd_Process::CheckInputDataPointer
            event occurrence invalidInputDataAccepted;

            // fp-subject: outputRequestComputedFromStaleData -> AcpdCdd_SysMLv2::Process::AcpdCdd_Process::ComputeChannelMeans
            event occurrence outputRequestComputedFromStaleData;

            // fp-subject: outputRequestIncorrect -> AcpdCdd_SysMLv2::Process::AcpdCdd_Process::ReturnProcessedData
            event occurrence outputRequestIncorrect;

            // Monitoring/control failure/effect occurrences.
            // fp-subject: detectionNotPerformed -> AcpdCdd_SysMLv2::Monitoring::AcpdCdd_Monitoring::ResultPlausibilityCheck
            event occurrence detectionNotPerformed;

            // fp-subject: mitigationNotApplied -> AcpdCdd_SysMLv2::Output::AcpdCdd_Output_Behavior::WriteSafeDefaultOutput
            event occurrence mitigationNotApplied;

            // Output failure/effect occurrences.
            // fp-subject: invalidOutputDataPrepared -> AcpdCdd_SysMLv2::Output::AcpdCdd_UpdateOutput::MergeRteData
            event occurrence invalidOutputDataPrepared;

            // fp-subject: invalidExternalCallIssued -> AcpdCdd_SysMLv2::Output::AcpdCdd_UpdateOutput::Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            event occurrence invalidExternalCallIssued;

            // fp-subject: invalidOutputDataTransmitted -> AcpdCdd_SysMLv2::Output::AcpdCdd_UpdateOutput::Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            event occurrence invalidOutputDataTransmitted;

            // Vehicle/system-level effects represented as external actor effects.
            // fp-subject: unintendedActuationRequest -> AcpdCdd_SysMLv2::Output::AcpdCdd_UpdateOutput::Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            event occurrence unintendedActuationRequest;

            // fp-subject: delayedActuationRequest -> AcpdCdd_SysMLv2::Output::AcpdCdd_UpdateOutput::Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            event occurrence delayedActuationRequest;

            #causation connect staleInputDataProduced to outputRequestComputedFromStaleData;
            #causation connect outputRequestComputedFromStaleData to outputRequestIncorrect;
            #causation connect outputRequestIncorrect to invalidOutputDataPrepared;
            #causation connect invalidOutputDataPrepared to invalidOutputDataTransmitted;
            #causation connect invalidOutputDataTransmitted to unintendedActuationRequest;

            #causation connect inputCollectionTooLate to outputRequestComputedFromStaleData;
            #causation connect inputCollectionNotExecuted to delayedActuationRequest;
            #causation connect invalidInputDataAccepted to outputRequestIncorrect;
            #causation connect invalidExternalCallIssued to unintendedActuationRequest;

            #multicausation connection monitoringMissedInvalidOutput {
                end #cause ::> detectionNotPerformed;
                end #cause ::> mitigationNotApplied;
                end #effect ::> invalidOutputDataTransmitted;
            }

            #multicausation connection invalidInputNotControlled {
                end #cause ::> invalidInputDataProduced;
                end #cause ::> detectionNotPerformed;
                end #effect ::> invalidInputDataAccepted;
            }
        }
    }
}

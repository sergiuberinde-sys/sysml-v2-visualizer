package AcpdCdd_SysMLv2 {

    package FailurePropagation {

        // Official-library-oriented safety analysis layer.
        //
        // Direction:
        // - Do not attach custom failureMode_* attributes to actions.
        // - Do not define custom FMEA rows or generated report artifacts in the model.
        // - Use the SysML v2 CauseAndEffect domain library to model failure/effect
        //   occurrences and causal propagation chains.
        //
        // Interpretation:
        // - event occurrences represent failure/effect occurrences relevant to the architecture.
        // - #causation links represent single-cause propagation.
        // - #multicausation links represent combined-cause propagation.
        //
        // This package is a first source-only propagation model. It is intentionally not
        // an ISO 26262 FMEA table and does not introduce S/O/D/RPN-style process fields.

        private import CauseAndEffect::*;

        part acpdCddFailurePropagation {

            part input {
                event occurrence inputCollectionNotExecuted;
                event occurrence inputCollectionTooLate;
                event occurrence staleInputDataProduced;
                event occurrence invalidInputDataProduced;
            }

            part process {
                event occurrence invalidInputDataAccepted;
                event occurrence outputRequestComputedFromStaleData;
                event occurrence outputRequestIncorrect;
            }

            part monitoring {
                event occurrence detectionNotPerformed;
                event occurrence mitigationNotApplied;
            }

            part output {
                event occurrence invalidOutputDataPrepared;
                event occurrence invalidExternalCallIssued;
                event occurrence invalidOutputDataTransmitted;
            }

            ref vehicle {
                event occurrence unintendedActuationRequest;
                event occurrence delayedActuationRequest;
            }

            #causation connect input.staleInputDataProduced to process.outputRequestComputedFromStaleData;
            #causation connect process.outputRequestComputedFromStaleData to process.outputRequestIncorrect;
            #causation connect process.outputRequestIncorrect to output.invalidOutputDataPrepared;
            #causation connect output.invalidOutputDataPrepared to output.invalidOutputDataTransmitted;
            #causation connect output.invalidOutputDataTransmitted to vehicle.unintendedActuationRequest;

            #causation connect input.inputCollectionTooLate to process.outputRequestComputedFromStaleData;
            #causation connect input.inputCollectionNotExecuted to vehicle.delayedActuationRequest;
            #causation connect process.invalidInputDataAccepted to process.outputRequestIncorrect;
            #causation connect output.invalidExternalCallIssued to vehicle.unintendedActuationRequest;

            #multicausation connection monitoringMissedInvalidOutput {
                end #cause ::> monitoring.detectionNotPerformed;
                end #cause ::> monitoring.mitigationNotApplied;
                end #effect ::> output.invalidOutputDataTransmitted;
            }

            #multicausation connection invalidInputNotControlled {
                end #cause ::> input.invalidInputDataProduced;
                end #cause ::> monitoring.detectionNotPerformed;
                end #effect ::> process.invalidInputDataAccepted;
            }
        }
    }
}

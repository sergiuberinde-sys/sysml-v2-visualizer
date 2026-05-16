package Behavior_Init {

    private import ScalarValues::*;

    item def CheckAcpdCddActiveDecisionType {
        attribute AcpdCdd_active : Boolean;
    }


    item def CheckSetupTrialCounterAgainstMaxAttemptsDecisionType {
        attribute CheckSetupTrialCounterAgainstMaxAttempts_allows_AcpdCdd_StartInputCollector : Boolean;
        attribute CheckSetupTrialCounterAgainstMaxAttempts_allows_StopProcessing : Boolean;
    }


    item def RuntimeInitializesInputModuleDecisionType {
        attribute RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule : Boolean;
        attribute RuntimeInitializesInputModule_allows_RuntimeStopsInitialization : Boolean;
    }


    action def AcpdCdd_Initialization {

        attribute AcpdCdd_active;
        attribute setup_trial_counter;

        first CheckAcpdCddActive;
        action CheckAcpdCddActive {
            out item decision : CheckAcpdCddActiveDecisionType;
        }
        action ExecuteCyclicTasksIfActive;
        action CheckSetupTrialCounterAgainstMaxAttempts {
            out item decision : CheckSetupTrialCounterAgainstMaxAttemptsDecisionType;
        }
        action AcpdCdd_StartInputCollector;
        action AcpdCdd_StartProcessing;
        action EnableAdcNotificationsAndHardwareTriggers;
        action SetAcpdCddActiveTrue;
        action IncrementSetupTrialCounter;
        action StopProcessing;
        action UpdateRteOutputWithSafeDefaultValues;

        first CheckAcpdCddActive then ExecuteCyclicTasksIfActive;
        first CheckAcpdCddActive then CheckSetupTrialCounterAgainstMaxAttempts;
        first CheckSetupTrialCounterAgainstMaxAttempts then AcpdCdd_StartInputCollector;
        first AcpdCdd_StartInputCollector then AcpdCdd_StartProcessing;
        first AcpdCdd_StartProcessing then EnableAdcNotificationsAndHardwareTriggers;
        first EnableAdcNotificationsAndHardwareTriggers then SetAcpdCddActiveTrue;
        first SetAcpdCddActiveTrue then IncrementSetupTrialCounter;
        first CheckSetupTrialCounterAgainstMaxAttempts then StopProcessing;
        first StopProcessing then UpdateRteOutputWithSafeDefaultValues;
    }

    action def AcpdCdd_Init_Sequence_AsActionFlow {

        first RuntimeInitializesInputModule;
        action RuntimeInitializesInputModule {
            out item decision : RuntimeInitializesInputModuleDecisionType;
        }
        action RuntimeInitializesPowermanagementModule;
        action RuntimeInitializesMonitoringModule;
        action RuntimeInitializesOutputModule;
        action RuntimeStopsInitialization;
        action RuntimeWritesSafeDefaultOutput;

        first RuntimeInitializesInputModule then RuntimeInitializesPowermanagementModule;
        first RuntimeInitializesInputModule then RuntimeStopsInitialization;
        first RuntimeInitializesPowermanagementModule then RuntimeInitializesMonitoringModule;
        first RuntimeInitializesMonitoringModule then RuntimeInitializesOutputModule;
        first RuntimeStopsInitialization then RuntimeWritesSafeDefaultOutput;
    }


}

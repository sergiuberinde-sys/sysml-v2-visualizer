package AcpdCdd_SysMLv2 {

    package Behavior_Init {

        private import ScalarValues::*;

        action def AcpdCdd_Initialization {

            attribute AcpdCdd_active;
            attribute setup_trial_counter;

            action entryAction;
            first entryAction then CheckAcpdCddActive;
            attribute CheckSetupTrialCounterAgainstMaxAttempts_allows_AcpdCdd_StartInputCollector : Boolean;
            attribute CheckSetupTrialCounterAgainstMaxAttempts_allows_StopProcessing : Boolean;
            action CheckAcpdCddActive;
            action ExecuteCyclicTasksIfActive;
            action CheckSetupTrialCounterAgainstMaxAttempts;
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

            action entryAction;
            first entryAction then RuntimeInitializesInputModule;
            attribute RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule : Boolean;
            attribute RuntimeInitializesInputModule_allows_RuntimeStopsInitialization : Boolean;
            action RuntimeInitializesInputModule;
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
}

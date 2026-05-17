package AcpdCdd_SysMLv2 {

    package Behavior_Init {

        private import ScalarValues::*;

        action def AcpdCdd_Initialization {

            attribute AcpdCdd_active;
            attribute setup_trial_counter;

            action entry;
            first entry then CheckAcpdCddActive;
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

            first CheckAcpdCddActive if AcpdCdd_active then ExecuteCyclicTasksIfActive;
            first CheckAcpdCddActive if not AcpdCdd_active then CheckSetupTrialCounterAgainstMaxAttempts;
            first CheckSetupTrialCounterAgainstMaxAttempts if CheckSetupTrialCounterAgainstMaxAttempts_allows_AcpdCdd_StartInputCollector then AcpdCdd_StartInputCollector;
            first AcpdCdd_StartInputCollector then AcpdCdd_StartProcessing;
            first AcpdCdd_StartProcessing then EnableAdcNotificationsAndHardwareTriggers;
            first EnableAdcNotificationsAndHardwareTriggers then SetAcpdCddActiveTrue;
            first SetAcpdCddActiveTrue then IncrementSetupTrialCounter;
            first CheckSetupTrialCounterAgainstMaxAttempts if CheckSetupTrialCounterAgainstMaxAttempts_allows_StopProcessing then StopProcessing;
            first StopProcessing then UpdateRteOutputWithSafeDefaultValues;
        }

        action def AcpdCdd_Init_Sequence_AsActionFlow {

            action entry;
            first entry then RuntimeInitializesInputModule;
            attribute RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule : Boolean;
            attribute RuntimeInitializesInputModule_allows_RuntimeStopsInitialization : Boolean;
            action RuntimeInitializesInputModule;
            action RuntimeInitializesPowermanagementModule;
            action RuntimeInitializesMonitoringModule;
            action RuntimeInitializesOutputModule;
            action RuntimeStopsInitialization;
            action RuntimeWritesSafeDefaultOutput;

            first RuntimeInitializesInputModule if RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule then RuntimeInitializesPowermanagementModule;
            first RuntimeInitializesInputModule if RuntimeInitializesInputModule_allows_RuntimeStopsInitialization then RuntimeStopsInitialization;
            first RuntimeInitializesPowermanagementModule then RuntimeInitializesMonitoringModule;
            first RuntimeInitializesMonitoringModule then RuntimeInitializesOutputModule;
            first RuntimeStopsInitialization then RuntimeWritesSafeDefaultOutput;
        }


    }
}

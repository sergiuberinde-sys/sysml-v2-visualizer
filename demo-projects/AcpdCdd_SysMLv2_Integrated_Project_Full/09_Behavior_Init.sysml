package AcpdCdd_SysMLv2 {

    package Behavior_Init {

        private import ScalarValues::*;
	private import ScalarValues::Boolean;

        action def AcpdCdd_Initialization {

            attribute AcpdCdd_active : Boolean;
            attribute setup_trial_counter;
attribute AcpdCddActive_isTrue : Boolean;
            attribute SetupTrialCounterBelowMaxAttempts : Boolean;
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

                first CheckAcpdCddActive if AcpdCddActive_isTrue then ExecuteCyclicTasksIfActive;
                first CheckAcpdCddActive if not AcpdCddActive_isTrue then CheckSetupTrialCounterAgainstMaxAttempts;
                first CheckSetupTrialCounterAgainstMaxAttempts if SetupTrialCounterBelowMaxAttempts then AcpdCdd_StartInputCollector;
                first AcpdCdd_StartInputCollector if SetupTrialCounterBelowMaxAttempts then AcpdCdd_StartProcessing;
                first AcpdCdd_StartProcessing if SetupTrialCounterBelowMaxAttempts then EnableAdcNotificationsAndHardwareTriggers;
                first EnableAdcNotificationsAndHardwareTriggers if SetupTrialCounterBelowMaxAttempts then SetAcpdCddActiveTrue;
                first SetAcpdCddActiveTrue if SetupTrialCounterBelowMaxAttempts then IncrementSetupTrialCounter;
                first CheckSetupTrialCounterAgainstMaxAttempts if not SetupTrialCounterBelowMaxAttempts then StopProcessing;
                first StopProcessing if not SetupTrialCounterBelowMaxAttempts then UpdateRteOutputWithSafeDefaultValues;
}

        action def AcpdCdd_Init_Sequence_AsActionFlow {
attribute RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule : Boolean;
            attribute RuntimeInitializesInputModule_allows_RuntimeStopsInitialization : Boolean;
            action RuntimeInitializesInputModule;
            action RuntimeInitializesPowermanagementModule;
            action RuntimeInitializesMonitoringModule;
            action RuntimeInitializesOutputModule;
            action RuntimeStopsInitialization;
            action RuntimeWritesSafeDefaultOutput;

                first RuntimeInitializesInputModule if RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule then RuntimeInitializesPowermanagementModule;
                first RuntimeInitializesInputModule if not RuntimeInitializesInputModule_allows_RuntimeInitializesPowermanagementModule then RuntimeStopsInitialization;
first RuntimeInitializesPowermanagementModule then RuntimeInitializesMonitoringModule;
            first RuntimeInitializesMonitoringModule then RuntimeInitializesOutputModule;
            first RuntimeStopsInitialization then RuntimeWritesSafeDefaultOutput;
        }


    }
}

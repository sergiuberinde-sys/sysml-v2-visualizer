
package Behavior_Init {

    private import ScalarValues::*;

    action def AcpdCdd_Initialization {

        attribute AcpdCdd_active;
        attribute setup_trial_counter;

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
        first CheckSetupTrialCounterAgainstMaxAttempts then AcpdCdd_StartInputCollector;
        first AcpdCdd_StartInputCollector then AcpdCdd_StartProcessing;
        first AcpdCdd_StartProcessing then EnableAdcNotificationsAndHardwareTriggers;
        first EnableAdcNotificationsAndHardwareTriggers then SetAcpdCddActiveTrue;
        first SetAcpdCddActiveTrue then IncrementSetupTrialCounter;
        first CheckSetupTrialCounterAgainstMaxAttempts then StopProcessing;
        first StopProcessing then UpdateRteOutputWithSafeDefaultValues;
    }

    action def AcpdCdd_Init_Sequence_AsActionFlow {

        action RuntimeInitializesInputModule;
        action RuntimeInitializesPowermanagementModule;
        action RuntimeInitializesMonitoringModule;
        action RuntimeInitializesOutputModule;

        first RuntimeInitializesInputModule
        then RuntimeInitializesPowermanagementModule;

        first RuntimeInitializesPowermanagementModule
        then RuntimeInitializesMonitoringModule;

        first RuntimeInitializesMonitoringModule
        then RuntimeInitializesOutputModule;
    }


}

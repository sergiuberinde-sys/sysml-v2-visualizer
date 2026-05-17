package AcpdCdd_SysMLv2 {

    package Behavior_Main10ms {

        private import ScalarValues::*;
        // trlc-satisfies: 28596119
        action def AcpdCdd_Main10ms {

            action entryAction;
            first entryAction then AcpdCdd_Activation;
            attribute AcpdCdd_Activation_allows_CyclicExecution : Boolean;
            attribute AcpdCdd_Activation_allows_SafeOutputOnly : Boolean;
            action AcpdCdd_Activation;
            action AcpdCdd_CollectInputData;
            action AcpdCdd_Process;
            action AcpdCdd_PowermanagementCalcStatus;
            action AdcBist_GetVaref1ErrorStatus;
            action AdcBist_GetVaref2ErrorStatus;
            action AcpdCdd_Monitoring;
            action AcpdCdd_Output;
            action AcpdCdd_SafeOutputOnly;

            first AcpdCdd_Activation then AcpdCdd_CollectInputData;
            first AcpdCdd_Activation then AcpdCdd_SafeOutputOnly;
            first AcpdCdd_CollectInputData then AcpdCdd_Process;
            first AcpdCdd_Process then AcpdCdd_PowermanagementCalcStatus;
            first AcpdCdd_PowermanagementCalcStatus then AdcBist_GetVaref1ErrorStatus;
            first AdcBist_GetVaref1ErrorStatus then AdcBist_GetVaref2ErrorStatus;
            first AdcBist_GetVaref2ErrorStatus then AcpdCdd_Monitoring;
            first AcpdCdd_Monitoring then AcpdCdd_Output;
            first AcpdCdd_SafeOutputOnly then AcpdCdd_Output;
        }

        action def AcpdCdd_Runtime_Sequence_AsActionFlow {

            action entryAction;
            first entryAction then RuntimeActivatesAcpdCdd;
            attribute RuntimeActivatesAcpdCdd_allows_RuntimeExecutesInputCycle : Boolean;
            attribute RuntimeActivatesAcpdCdd_allows_RuntimeExecutesSafeOutputCycle : Boolean;
            action RuntimeActivatesAcpdCdd;
            action RuntimeExecutesInputCycle;
            action RuntimeExecutesProcessingCycle;
            action RuntimeExecutesPowermanagementCycle;
            action RuntimeExecutesMonitoringCycle;
            action RuntimeExecutesSafeOutputCycle;
            action RuntimeExecutesOutputCycle;

            first RuntimeActivatesAcpdCdd then RuntimeExecutesInputCycle;
            first RuntimeActivatesAcpdCdd then RuntimeExecutesSafeOutputCycle;
            first RuntimeExecutesInputCycle then RuntimeExecutesProcessingCycle;
            first RuntimeExecutesProcessingCycle then RuntimeExecutesPowermanagementCycle;
            first RuntimeExecutesPowermanagementCycle then RuntimeExecutesMonitoringCycle;
            first RuntimeExecutesMonitoringCycle then RuntimeExecutesOutputCycle;
            first RuntimeExecutesSafeOutputCycle then RuntimeExecutesOutputCycle;
        }


    }
}

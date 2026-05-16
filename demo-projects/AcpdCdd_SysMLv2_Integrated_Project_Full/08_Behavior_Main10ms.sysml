
package Behavior_Main10ms {

    private import ScalarValues::*;
    // trlc-satisfies: 28596119
    action def AcpdCdd_Main10ms {

        action AcpdCdd_Activation;
        action AcpdCdd_CollectInputData;
        action AcpdCdd_Process;
        action AcpdCdd_PowermanagementCalcStatus;
        action AdcBist_GetVaref1ErrorStatus;
        action AdcBist_GetVaref2ErrorStatus;
        action AcpdCdd_Monitoring;
        action AcpdCdd_Output;

        first AcpdCdd_Activation then AcpdCdd_CollectInputData;
        first AcpdCdd_CollectInputData then AcpdCdd_Process;
        first AcpdCdd_Process then AcpdCdd_PowermanagementCalcStatus;
        first AcpdCdd_PowermanagementCalcStatus then AdcBist_GetVaref1ErrorStatus;
        first AdcBist_GetVaref1ErrorStatus then AdcBist_GetVaref2ErrorStatus;
        first AdcBist_GetVaref2ErrorStatus then AcpdCdd_Monitoring;
        first AcpdCdd_Monitoring then AcpdCdd_Output;
    }

    action def AcpdCdd_Runtime_Sequence_AsActionFlow {

        action RuntimeActivatesAcpdCdd;
        action RuntimeExecutesInputCycle;
        action RuntimeExecutesProcessingCycle;
        action RuntimeExecutesPowermanagementCycle;
        action RuntimeExecutesMonitoringCycle;
        action RuntimeExecutesOutputCycle;

        first RuntimeActivatesAcpdCdd then RuntimeExecutesInputCycle;

        first RuntimeExecutesInputCycle
        then RuntimeExecutesProcessingCycle;

        first RuntimeExecutesProcessingCycle
        then RuntimeExecutesPowermanagementCycle;

        first RuntimeExecutesPowermanagementCycle
        then RuntimeExecutesMonitoringCycle;

        first RuntimeExecutesMonitoringCycle
        then RuntimeExecutesOutputCycle;
    }


}

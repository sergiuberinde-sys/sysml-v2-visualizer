package AcpdCdd_SysMLv2 {

    package Behavior_Main10ms {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::AUTOSAR_CDD_FunctionKinds::*;
        // trlc-satisfies: 28596119
        action def AcpdCdd_Main10ms :> RunnableFunction {
action AcpdCdd_Activation : ModuleApiFunction;
            action AcpdCdd_CollectInputData : ModuleApiFunction;
            action AcpdCdd_Process : ModuleApiFunction;
            action AcpdCdd_PowermanagementCalcStatus : ModuleApiFunction;
            action AdcBist_GetVaref1ErrorStatus : ExternalBswFunction;
            action AdcBist_GetVaref2ErrorStatus : ExternalBswFunction;
            action AcpdCdd_Monitoring : ModuleApiFunction;
            action AcpdCdd_Output : ModuleApiFunction;

            first AcpdCdd_Activation then AcpdCdd_CollectInputData;
            first AcpdCdd_CollectInputData then AcpdCdd_Process;
            first AcpdCdd_Process then AcpdCdd_PowermanagementCalcStatus;
            first AcpdCdd_PowermanagementCalcStatus then AdcBist_GetVaref1ErrorStatus;
            first AdcBist_GetVaref1ErrorStatus then AdcBist_GetVaref2ErrorStatus;
            first AdcBist_GetVaref2ErrorStatus then AcpdCdd_Monitoring;
            first AcpdCdd_Monitoring then AcpdCdd_Output;
        }

        action AcpdCdd_Runtime_Sequence_AsActionFlow {
action RuntimeActivatesAcpdCdd;
            action RuntimeExecutesInputCycle;
            action RuntimeExecutesProcessingCycle;
            action RuntimeExecutesPowermanagementCycle;
            action RuntimeExecutesMonitoringCycle;
            action RuntimeExecutesOutputCycle;

            first RuntimeActivatesAcpdCdd then RuntimeExecutesInputCycle;
            first RuntimeExecutesInputCycle then RuntimeExecutesProcessingCycle;
            first RuntimeExecutesProcessingCycle then RuntimeExecutesPowermanagementCycle;
            first RuntimeExecutesPowermanagementCycle then RuntimeExecutesMonitoringCycle;
            first RuntimeExecutesMonitoringCycle then RuntimeExecutesOutputCycle;
        }



    }
}

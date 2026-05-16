
package ComponentDesign {

    private import Input::*;
    private import Process::*;
    private import Powermanagement::*;
    private import Monitoring::*;
    private import Output::*;
    // trlc-satisfies: 25093540
    // trlc-satisfies: 25090543
    // trlc-satisfies: 28712675
    part def AcpdCdd {
        part input : AcpdCdd_Input;
        part process : AcpdCdd_Process;
        part powermanagement : AcpdCdd_Powermanagement;
        part monitoring : AcpdCdd_Monitoring;
        part output : AcpdCdd_Output;
    }

    part acpdCdd : AcpdCdd;
}

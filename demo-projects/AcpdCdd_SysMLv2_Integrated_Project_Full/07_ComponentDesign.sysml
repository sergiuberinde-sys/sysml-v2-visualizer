package AcpdCdd_SysMLv2 {

    package ComponentDesign {

        private import AcpdCdd_SysMLv2::Input::*;
        private import AcpdCdd_SysMLv2::Process::*;
        private import AcpdCdd_SysMLv2::Powermanagement::*;
        private import AcpdCdd_SysMLv2::Monitoring::*;
        private import AcpdCdd_SysMLv2::Output::*;
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
}

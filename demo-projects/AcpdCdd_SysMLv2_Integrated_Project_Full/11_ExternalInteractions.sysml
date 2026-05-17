package AcpdCdd_SysMLv2 {

    package ExternalInteractions {

        private import AcpdCdd_SysMLv2::ComponentDesign::*;

        part def AdcService;
        part def AdcBistService;
        part def DioService;
        part def DemService;
        part def RteService;

        part def AcpdCddExternalInteractionContext {
            part acpdCdd : AcpdCdd;
            part adc : AdcService;
            part adcBist : AdcBistService;
            part dio : DioService;
            part dem : DemService;
            part rte : RteService;
        }

        part acpdCddExternalInteractionContext : AcpdCddExternalInteractionContext;
    }
}

package ExternalInteractions {

    private import ComponentDesign::*;

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

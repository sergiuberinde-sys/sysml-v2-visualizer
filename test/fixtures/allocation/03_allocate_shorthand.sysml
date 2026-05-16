package AllocateShorthand {
    part def SoftwareFunction;
    part def Processor;

    part def AutomotiveSystem {
        part func : SoftwareFunction;
        part cpu : Processor;
        allocate func to cpu;
    }
}

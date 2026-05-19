package AcpdCdd_SysMLv2 {
    package AUTOSAR_CDD_FunctionKinds {
        doc
        /*
         * AUTOSAR CDD function-kind semantics for the behavior model.
         *
         * These are not a separate classification table. They are action definition
         * kinds that the actual modeled C functions specialize.
         */

        action def CddFunction;
        action def RunnableFunction :> CddFunction;
        action def BswCallbackFunction :> CddFunction;
        action def ModuleApiFunction :> CddFunction;
        action def StaticHelperFunction :> CddFunction;
        action def ExternalBswFunction :> CddFunction;
        action def ExternalRteFunction :> CddFunction;
    }
}

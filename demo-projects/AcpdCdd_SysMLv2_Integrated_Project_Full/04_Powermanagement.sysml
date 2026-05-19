package AcpdCdd_SysMLv2 {
    package Powermanagement {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;
	private import ScalarValues::Boolean;
        private import AcpdCdd_SysMLv2::AUTOSAR_CDD_FunctionKinds::*;
        private import AcpdCdd_SysMLv2::SWFailureCatalogue::*;
// trlc-satisfies: 25188489
        port def ActivationInPort {
            in attribute activation;
        }

        port def PowerStatusOutPort {
            out item Status : PowerStatusType;
        }

        // trlc-satisfies: 25188507
        port def DioStatusOutPort {
            out attribute Status;
        }

        action def AcpdCdd_InitPowerDio :> StaticHelperFunction {
action SetDioChannelCto5vapp1Low;
            action SetDioChannelCto5vapp2Low;
            action Return;

            first SetDioChannelCto5vapp1Low then SetDioChannelCto5vapp2Low;
            first SetDioChannelCto5vapp2Low then Return;
        }

        action def AcpdCdd_SetPowerDio :> StaticHelperFunction {
            in attribute Status;
action WriteDioChannelCto5vapp1;
            action WriteDioChannelCto5vapp2;
            action OptionalReadbackVerification;
            action Return;

            first WriteDioChannelCto5vapp1 then WriteDioChannelCto5vapp2;
            first WriteDioChannelCto5vapp2 then OptionalReadbackVerification;
            first OptionalReadbackVerification then Return;
        }

        action def AcpdCdd_PowermanagementInit :> ModuleApiFunction {
action AcpdCdd_InitPowerDio : StaticHelperFunction;
            // trlc-satisfies: 41716503
            action SetCurrentPowerStatePowerOff;
            action SetCurrentPowerTransitionNone;
            action ResetSwitchOnEvent;

            first AcpdCdd_InitPowerDio then SetCurrentPowerStatePowerOff;
            first SetCurrentPowerStatePowerOff then SetCurrentPowerTransitionNone;
            first SetCurrentPowerTransitionNone then ResetSwitchOnEvent;
        }

        // trlc-satisfies: 25188589
        action def AcpdCdd_PowermanagementCalcStatus :> ModuleApiFunction {
            out item Status : PowerStatusType;
action CopyCurrentPowerStateToStatus;
            action CopyCurrentPowerTransitionToStatus;
            action ResetCurrentPowerTransitionToNone;
            action ReturnStatus;

            first CopyCurrentPowerStateToStatus then CopyCurrentPowerTransitionToStatus;
            first CopyCurrentPowerTransitionToStatus then ResetCurrentPowerTransitionToNone;
            first ResetCurrentPowerTransitionToNone then ReturnStatus;

            item incorrectPowerStatusFailure : PowerStateIncorrect {
                attribute localEffect = "Returned PowerStatusType does not represent the actual power state or transition.";
            }
}

        action def AcpdCdd_PowermanagementExecute :> ModuleApiFunction {
            in attribute PowerState;
attribute PowerState_isValid : Boolean;
            attribute RequestedTransition_isPowerOffToPowerOn : Boolean;
            attribute RequestedTransition_isPowerOnToPowerOff : Boolean;
            attribute SwitchOnEvent_isLatched : Boolean;
            action RangeCheckPowerState;
            action DoNothingForOutOfRangePowerState;
            // trlc-satisfies: 28826666
            action DeterminePowerOffToPowerOnTransition;
            // trlc-satisfies: 28826692
            action DeterminePowerOnToPowerOffTransition;
            // trlc-satisfies: 25188528
            action DetermineNoTransition;
            action StoreNewPowerState;
            action SetPowerDioOn;
            action SetSwitchOnEventTrue;
            action SetPowerDioOff;
            action LatchPreviousSwitchOnEvent;
            action ResetSwitchOnEventFalse;
            action Return;

                first RangeCheckPowerState if PowerState_isValid then StoreNewPowerState;
                first RangeCheckPowerState if not PowerState_isValid then DoNothingForOutOfRangePowerState;
                first DoNothingForOutOfRangePowerState if not PowerState_isValid then Return;
                first StoreNewPowerState if RequestedTransition_isPowerOffToPowerOn then DeterminePowerOffToPowerOnTransition;
                first DeterminePowerOffToPowerOnTransition if RequestedTransition_isPowerOffToPowerOn then SetPowerDioOn;
                first SetPowerDioOn if RequestedTransition_isPowerOffToPowerOn then SetSwitchOnEventTrue;
                first SetSwitchOnEventTrue if RequestedTransition_isPowerOffToPowerOn then Return;
                first StoreNewPowerState if not RequestedTransition_isPowerOffToPowerOn and RequestedTransition_isPowerOnToPowerOff then DeterminePowerOnToPowerOffTransition;
                first DeterminePowerOnToPowerOffTransition if RequestedTransition_isPowerOnToPowerOff then SetPowerDioOff;
                first SetPowerDioOff if RequestedTransition_isPowerOnToPowerOff then Return;
                first StoreNewPowerState if not RequestedTransition_isPowerOffToPowerOn and not RequestedTransition_isPowerOnToPowerOff then DetermineNoTransition;
                first DetermineNoTransition if SwitchOnEvent_isLatched then LatchPreviousSwitchOnEvent;
                first LatchPreviousSwitchOnEvent if SwitchOnEvent_isLatched then ResetSwitchOnEventFalse;
                first ResetSwitchOnEventFalse if SwitchOnEvent_isLatched then Return;
                first DetermineNoTransition if not SwitchOnEvent_isLatched then Return;
        }

        action def AcpdCdd_Activation :> ModuleApiFunction {
attribute CompareActivationWithActivate_allows_ExecutePowerOn : Boolean;
            attribute CompareActivationWithActivate_allows_ExecutePowerOff : Boolean;
            action ReadActivationSignalFromRte;
            action CompareActivationWithActivate;
            action ExecutePowerOn;
            action ExecutePowerOff;
            action Return;

            first ReadActivationSignalFromRte then CompareActivationWithActivate;
                first CompareActivationWithActivate if CompareActivationWithActivate_allows_ExecutePowerOn then ExecutePowerOn;
                first CompareActivationWithActivate if not CompareActivationWithActivate_allows_ExecutePowerOn then ExecutePowerOff;
first ExecutePowerOn then Return;
            first ExecutePowerOff then Return;

            item activationMisinterpretedFailure : ConditionIncorrectlyEvaluated {
                attribute localEffect = "Requested activation state is interpreted incorrectly before power-state execution.";
            }
}

        action AcpdCdd_Powermanagement_Behavior {
action AcpdCdd_PowermanagementInit : ModuleApiFunction;
            action AcpdCdd_Activation : ModuleApiFunction;
            action AcpdCdd_PowermanagementExecute : ModuleApiFunction;
            action AcpdCdd_SetPowerDio : StaticHelperFunction;
            action AcpdCdd_PowermanagementCalcStatus : ModuleApiFunction;

            first AcpdCdd_PowermanagementInit then AcpdCdd_Activation;
            first AcpdCdd_Activation then AcpdCdd_PowermanagementExecute;
            first AcpdCdd_PowermanagementExecute then AcpdCdd_SetPowerDio;
            first AcpdCdd_SetPowerDio then AcpdCdd_PowermanagementCalcStatus;
        }

        part def AcpdCdd_Powermanagement {
            port activationIn : ActivationInPort;
            port powerStatusOut : PowerStatusOutPort;
            port dioStatusOut : DioStatusOutPort;

            attribute CurrentPowerState;
            attribute CurrentPowerTransition;
            attribute SwitchOnEvent;

            action powermanagementInit;
            action powermanagementCalcStatus;
            action powermanagementExecute;
            action activation;
            action initPowerDio;
            action setPowerDio;
            action powermanagementBehavior;
        }

        action AcpdCdd_Powermanagement_Sequence_AsActionFlow {
action PowermanagementInitializesModule;
            action PowermanagementCalculatesPowerStatus;

            action PowermanagementRequestsDioInitialization;
            action DioInitializesPowerChannel;

            action PowermanagementRequestsPowerChannelUpdate;
            action DioSetsPowerChannelState;

            action PowermanagementPublishesPowerStatus;

            first PowermanagementInitializesModule then PowermanagementCalculatesPowerStatus;

            first PowermanagementCalculatesPowerStatus
            then PowermanagementRequestsDioInitialization;

            first PowermanagementRequestsDioInitialization
            then DioInitializesPowerChannel;

            first DioInitializesPowerChannel
            then PowermanagementRequestsPowerChannelUpdate;

            first PowermanagementRequestsPowerChannelUpdate
            then DioSetsPowerChannelState;

            first DioSetsPowerChannelState
            then PowermanagementPublishesPowerStatus;
        }


    }
}

package Powermanagement {

    private import ScalarValues::*;
    private import Types::*;

    item def CompareActivationWithActivateDecisionType {
        attribute CompareActivationWithActivate_allows_ExecutePowerOff : Boolean;
        attribute CompareActivationWithActivate_allows_ExecutePowerOn : Boolean;
    }


    item def StoreNewPowerStateDecisionType {
        attribute StoreNewPowerState_allows_LatchPreviousSwitchOnEvent : Boolean;
        attribute StoreNewPowerState_allows_SetPowerDioOff : Boolean;
        attribute StoreNewPowerState_allows_SetPowerDioOn : Boolean;
    }


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

    action def AcpdCdd_InitPowerDio {
        first SetDioChannelCto5vapp1Low;
        action SetDioChannelCto5vapp1Low;
        action SetDioChannelCto5vapp2Low;
        action Return;

        first SetDioChannelCto5vapp1Low then SetDioChannelCto5vapp2Low;
        first SetDioChannelCto5vapp2Low then Return;
    }

    action def AcpdCdd_SetPowerDio {
        in attribute Status;

        first WriteDioChannelCto5vapp1;
        action WriteDioChannelCto5vapp1;
        action WriteDioChannelCto5vapp2;
        action OptionalReadbackVerification;
        action Return;

        first WriteDioChannelCto5vapp1 then WriteDioChannelCto5vapp2;
        first WriteDioChannelCto5vapp2 then OptionalReadbackVerification;
        first OptionalReadbackVerification then Return;
    }

    action def AcpdCdd_PowermanagementInit {

        first AcpdCdd_InitPowerDio;
        action AcpdCdd_InitPowerDio;
        // trlc-satisfies: 41716503
        action SetCurrentPowerStatePowerOff;
        action SetCurrentPowerTransitionNone;
        action ResetSwitchOnEvent;

        first AcpdCdd_InitPowerDio then SetCurrentPowerStatePowerOff;
        first SetCurrentPowerStatePowerOff then SetCurrentPowerTransitionNone;
        first SetCurrentPowerTransitionNone then ResetSwitchOnEvent;
    }

    // trlc-satisfies: 25188589
    action def AcpdCdd_PowermanagementCalcStatus {
        out item Status : PowerStatusType;

        first CopyCurrentPowerStateToStatus;
        action CopyCurrentPowerStateToStatus;
        action CopyCurrentPowerTransitionToStatus;
        action ResetCurrentPowerTransitionToNone;
        action ReturnStatus;

        first CopyCurrentPowerStateToStatus then CopyCurrentPowerTransitionToStatus;
        first CopyCurrentPowerTransitionToStatus then ResetCurrentPowerTransitionToNone;
        first ResetCurrentPowerTransitionToNone then ReturnStatus;
    }

    action def AcpdCdd_PowermanagementExecute {
        in attribute PowerState;

        first RangeCheckPowerState;
        action RangeCheckPowerState;
        // trlc-satisfies: 28826666
        action DeterminePowerOffToPowerOnTransition;
        // trlc-satisfies: 28826692
        action DeterminePowerOnToPowerOffTransition;
        // trlc-satisfies: 25188528
        action DetermineNoTransition;
        action StoreNewPowerState {
            out item decision : StoreNewPowerStateDecisionType;
        }
        action SetPowerDioOn;
        action SetSwitchOnEventTrue;
        action SetPowerDioOff;
        action LatchPreviousSwitchOnEvent;
        action ResetSwitchOnEventFalse;
        action Return;

        first RangeCheckPowerState then DeterminePowerOffToPowerOnTransition;
        first DeterminePowerOffToPowerOnTransition then DeterminePowerOnToPowerOffTransition;
        first DeterminePowerOnToPowerOffTransition then DetermineNoTransition;
        first DetermineNoTransition then StoreNewPowerState;
        first StoreNewPowerState then SetPowerDioOn;
        first SetPowerDioOn then SetSwitchOnEventTrue;
        first SetSwitchOnEventTrue then Return;
        first StoreNewPowerState then SetPowerDioOff;
        first SetPowerDioOff then Return;
        first StoreNewPowerState then LatchPreviousSwitchOnEvent;
        first LatchPreviousSwitchOnEvent then ResetSwitchOnEventFalse;
        first ResetSwitchOnEventFalse then Return;
    }

    action def AcpdCdd_Activation {

        first ReadActivationSignalFromRte;
        action ReadActivationSignalFromRte;
        action CompareActivationWithActivate {
            out item decision : CompareActivationWithActivateDecisionType;
        }
        action ExecutePowerOn;
        action ExecutePowerOff;
        action Return;

        first ReadActivationSignalFromRte then CompareActivationWithActivate;
        first CompareActivationWithActivate then ExecutePowerOn;
        first CompareActivationWithActivate then ExecutePowerOff;
        first ExecutePowerOn then Return;
        first ExecutePowerOff then Return;
    }

    action def AcpdCdd_Powermanagement_Behavior {
        first AcpdCdd_PowermanagementInit;
        action AcpdCdd_PowermanagementInit;
        action AcpdCdd_Activation;
        action AcpdCdd_PowermanagementExecute;
        action AcpdCdd_SetPowerDio;
        action AcpdCdd_PowermanagementCalcStatus;

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

        action powermanagementInit : AcpdCdd_PowermanagementInit;
        action powermanagementCalcStatus : AcpdCdd_PowermanagementCalcStatus;
        action powermanagementExecute : AcpdCdd_PowermanagementExecute;
        action activation : AcpdCdd_Activation;
        action initPowerDio : AcpdCdd_InitPowerDio;
        action setPowerDio : AcpdCdd_SetPowerDio;
        action powermanagementBehavior : AcpdCdd_Powermanagement_Behavior;
bind activationIn.activation = powermanagementExecute.PowerState;
bind dioStatusOut.Status = setPowerDio.Status;
    }

    action def AcpdCdd_Powermanagement_Sequence_AsActionFlow {

        first PowermanagementInitializesModule;
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

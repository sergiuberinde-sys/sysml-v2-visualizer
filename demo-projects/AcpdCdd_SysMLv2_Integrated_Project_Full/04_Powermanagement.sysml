package AcpdCdd_SysMLv2 {
    package Powermanagement {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

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
            action entry;
            first entry then SetDioChannelCto5vapp1Low;
            action SetDioChannelCto5vapp1Low;
            action SetDioChannelCto5vapp2Low;
            action Return;

            first SetDioChannelCto5vapp1Low then SetDioChannelCto5vapp2Low;
            first SetDioChannelCto5vapp2Low then Return;
        }

        action def AcpdCdd_SetPowerDio {
            in attribute Status;

            action entry;
            first entry then WriteDioChannelCto5vapp1;
            action WriteDioChannelCto5vapp1;
            action WriteDioChannelCto5vapp2;
            action OptionalReadbackVerification;
            action Return;

            first WriteDioChannelCto5vapp1 then WriteDioChannelCto5vapp2;
            first WriteDioChannelCto5vapp2 then OptionalReadbackVerification;
            first OptionalReadbackVerification then Return;
        }

        action def AcpdCdd_PowermanagementInit {

            action entry;
            first entry then AcpdCdd_InitPowerDio;
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

            action entry;
            first entry then CopyCurrentPowerStateToStatus;
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

            action entry;
            first entry then RangeCheckPowerState;
            attribute StoreNewPowerState_allows_SetPowerDioOn : Boolean;
            attribute StoreNewPowerState_allows_SetPowerDioOff : Boolean;
            attribute StoreNewPowerState_allows_LatchPreviousSwitchOnEvent : Boolean;
            action RangeCheckPowerState;
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

            first RangeCheckPowerState then DeterminePowerOffToPowerOnTransition;
            first DeterminePowerOffToPowerOnTransition then DeterminePowerOnToPowerOffTransition;
            first DeterminePowerOnToPowerOffTransition then DetermineNoTransition;
            first DetermineNoTransition then StoreNewPowerState;
            first StoreNewPowerState if StoreNewPowerState_allows_SetPowerDioOn then SetPowerDioOn;
            first SetPowerDioOn then SetSwitchOnEventTrue;
            first SetSwitchOnEventTrue then Return;
            first StoreNewPowerState if StoreNewPowerState_allows_SetPowerDioOff then SetPowerDioOff;
            first SetPowerDioOff then Return;
            first StoreNewPowerState if StoreNewPowerState_allows_LatchPreviousSwitchOnEvent then LatchPreviousSwitchOnEvent;
            first LatchPreviousSwitchOnEvent then ResetSwitchOnEventFalse;
            first ResetSwitchOnEventFalse then Return;
        }

        action def AcpdCdd_Activation {

            action entry;
            first entry then ReadActivationSignalFromRte;
            attribute CompareActivationWithActivate_allows_ExecutePowerOn : Boolean;
            attribute CompareActivationWithActivate_allows_ExecutePowerOff : Boolean;
            action ReadActivationSignalFromRte;
            action CompareActivationWithActivate;
            action ExecutePowerOn;
            action ExecutePowerOff;
            action Return;

            first ReadActivationSignalFromRte then CompareActivationWithActivate;
            first CompareActivationWithActivate if CompareActivationWithActivate_allows_ExecutePowerOn then ExecutePowerOn;
            first CompareActivationWithActivate if CompareActivationWithActivate_allows_ExecutePowerOff then ExecutePowerOff;
            first ExecutePowerOn then Return;
            first ExecutePowerOff then Return;
        }

        action def AcpdCdd_Powermanagement_Behavior {
            action entry;
            first entry then AcpdCdd_PowermanagementInit;
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

            action powermanagementInit;
            action powermanagementCalcStatus;
            action powermanagementExecute;
            action activation;
            action initPowerDio;
            action setPowerDio;
            action powermanagementBehavior;
        }

        action def AcpdCdd_Powermanagement_Sequence_AsActionFlow {

            action entry;
            first entry then PowermanagementInitializesModule;
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

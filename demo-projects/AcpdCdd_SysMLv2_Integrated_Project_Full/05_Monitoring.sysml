package AcpdCdd_SysMLv2 {
    package Monitoring {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;
	private import ScalarValues::Boolean;
        private import AcpdCdd_SysMLv2::AUTOSAR_CDD_FunctionKinds::*;
        private import AcpdCdd_SysMLv2::SWFailureCatalogue::*;
port def InputDataInPort {
            in item InputData : InputDataType;
        }

        port def ProcessedDataInPort {
            in item ProcessedData : ChannelMeansType;
        }

        port def PowerStatusInPort {
            in item PowerCycleStatus : PowerStatusType;
        }

        port def VARef1ErrorInPort {
            in attribute VARef1ErrorPresent;
        }

        port def VARef2ErrorInPort {
            in attribute VARef2ErrorPresent;
        }

        port def AcceleratorDataOutPort {
            out item acceleratorData : tAcpdCdd_rc_AccrSnsr;
        }

        // trlc-satisfies: 28710854
        action def AcpdCdd_CrossCheckTimestamps :> StaticHelperFunction {
            in attribute timestamp0;
            in attribute timestamp1;
            in attribute timestampOffset;
            out attribute result;
attribute CompareWithCrosscheckBound_allows_ReturnTrueIfInRange : Boolean;
            attribute CompareWithCrosscheckBound_allows_ReturnFalseIfOutOfRange : Boolean;
            action ComputeInitialOffset;
            action ComputeCurrentOffset;
            action ComputeOffsetDifference;
            action CompareWithCrosscheckBound;
            action ReturnTrueIfInRange;
            action ReturnFalseIfOutOfRange;

            first ComputeInitialOffset then ComputeCurrentOffset;
            first ComputeCurrentOffset then ComputeOffsetDifference;
            first ComputeOffsetDifference then CompareWithCrosscheckBound;
                first CompareWithCrosscheckBound if CompareWithCrosscheckBound_allows_ReturnTrueIfInRange then ReturnTrueIfInRange;
                first CompareWithCrosscheckBound if not CompareWithCrosscheckBound_allows_ReturnTrueIfInRange then ReturnFalseIfOutOfRange;
}

        // trlc-satisfies: 28710924
        // trlc-satisfies: 28711397
        // trlc-satisfies: 41781961
        // trlc-satisfies: 41781989
        // trlc-satisfies: 28711565
        // trlc-satisfies: 30474716
        action def AcpdCdd_CheckTimestamps :> StaticHelperFunction {
            in item InputData : InputDataType;
            out item ErrorCounters : AcpdCddCheckErrorCountersType;
action InitializeErrorCounters;
            action IterateAdcUpdateCycleCount;
            action ComputeGroup0TimestampDelta;
            action ComputeGroup1TimestampDelta;
            action ComputeSupplyTimestampDelta;
            action CheckGroup0DeltaTolerance;
            action CheckGroup1DeltaTolerance;
            action CheckSupplyDeltaTolerance;
            action UpdateGroupErrorCounters;
            action RecomputeInitialOffsetIfNeeded;
            action CallAcpdCdd_CrossCheckTimestamps;
            action IncrementGroup0Group1CountersOnCrosscheckFail;
            action ReturnErrorCounters;

            first InitializeErrorCounters then IterateAdcUpdateCycleCount;
            first IterateAdcUpdateCycleCount then ComputeGroup0TimestampDelta;
            first ComputeGroup0TimestampDelta then ComputeGroup1TimestampDelta;
            first ComputeGroup1TimestampDelta then ComputeSupplyTimestampDelta;
            first ComputeSupplyTimestampDelta then CheckGroup0DeltaTolerance;
            first CheckGroup0DeltaTolerance then CheckGroup1DeltaTolerance;
            first CheckGroup1DeltaTolerance then CheckSupplyDeltaTolerance;
            first CheckSupplyDeltaTolerance then UpdateGroupErrorCounters;
            first UpdateGroupErrorCounters then RecomputeInitialOffsetIfNeeded;
            first RecomputeInitialOffsetIfNeeded then CallAcpdCdd_CrossCheckTimestamps;
            first CallAcpdCdd_CrossCheckTimestamps then IncrementGroup0Group1CountersOnCrosscheckFail;
            first IncrementGroup0Group1CountersOnCrosscheckFail then ReturnErrorCounters;

            item timestampErrorNotDetectedFailure : DetectionFailed {
                attribute localEffect = "Timestamp/update-frequency inconsistency is not reflected in the error counters.";
            }
}

        // trlc-satisfies: 28711591
        action def AcpdCdd_MissingDataCheck :> StaticHelperFunction {
            in item InputData : InputDataType;
            out item ErrorCounters : AcpdCddCheckErrorCountersType;
action InitializeMissingDataCounters;
            action IterateSensor0Data;
            action IterateSensor1Data;
            action CheckInvalidInputVoltage;
            action DetectStuckValues;
            action IncrementGroup0Counter;
            action IncrementGroup1Counter;
            action IncrementSupplyCounter;
            action ReturnMissingDataCounters;

            first InitializeMissingDataCounters then IterateSensor0Data;
            first IterateSensor0Data then IterateSensor1Data;
            first IterateSensor1Data then CheckInvalidInputVoltage;
            first CheckInvalidInputVoltage then DetectStuckValues;
            first DetectStuckValues then IncrementGroup0Counter;
            first IncrementGroup0Counter then IncrementGroup1Counter;
            first IncrementGroup1Counter then IncrementSupplyCounter;
            first IncrementSupplyCounter then ReturnMissingDataCounters;

            item missingDataNotDetectedFailure : DetectionFailed {
                attribute localEffect = "Missing, invalid, or stuck ADC samples are not reflected in the error counters.";
            }
}

        // trlc-satisfies: 25128928
        // trlc-satisfies: 44879718
        // trlc-satisfies: 44879786
        // trlc-satisfies: 25128720
        // trlc-satisfies: 25128907
        // trlc-satisfies: 25128928
        // trlc-satisfies: 44879718
        // trlc-satisfies: 44879786
        // trlc-satisfies: 25128720
        // trlc-satisfies: 25128907
        action def AcpdCdd_DeviationCheck :> StaticHelperFunction {
            in item ProcessedData : ChannelMeansType;
attribute Sensor0MonitoringMeanWithinAcceptableInterval : Boolean;
            attribute Sensor1MonitoringMeanWithinAcceptableInterval : Boolean;
            action SelectSensor0MissionAndMonitoringMeans;
            action ComputeSensor0AcceptableInterval;
            action CheckSensor0MonitoringWithinInterval;
            action KeepSensor0QualifierUnchanged;
            action SetSensor0QualifierDegraded;
            action SetSensor0ValueToMinimum;
            action SelectSensor1MissionAndMonitoringMeans;
            action ComputeSensor1AcceptableInterval;
            action CheckSensor1MonitoringWithinInterval;
            action KeepSensor1QualifierUnchanged;
            action SetSensor1QualifierDegraded;
            action SetSensor1ValueToMinimum;
            action ReturnDeviationResult;

            first SelectSensor0MissionAndMonitoringMeans then ComputeSensor0AcceptableInterval;
            first ComputeSensor0AcceptableInterval then CheckSensor0MonitoringWithinInterval;
                first CheckSensor0MonitoringWithinInterval if Sensor0MonitoringMeanWithinAcceptableInterval then KeepSensor0QualifierUnchanged;
                first KeepSensor0QualifierUnchanged if Sensor0MonitoringMeanWithinAcceptableInterval then SelectSensor1MissionAndMonitoringMeans;
                first CheckSensor0MonitoringWithinInterval if not Sensor0MonitoringMeanWithinAcceptableInterval then SetSensor0QualifierDegraded;
                first SetSensor0QualifierDegraded if not Sensor0MonitoringMeanWithinAcceptableInterval then SetSensor0ValueToMinimum;
                first SetSensor0ValueToMinimum if not Sensor0MonitoringMeanWithinAcceptableInterval then SelectSensor1MissionAndMonitoringMeans;
first SelectSensor1MissionAndMonitoringMeans then ComputeSensor1AcceptableInterval;
            first ComputeSensor1AcceptableInterval then CheckSensor1MonitoringWithinInterval;
                first CheckSensor1MonitoringWithinInterval if Sensor1MonitoringMeanWithinAcceptableInterval then KeepSensor1QualifierUnchanged;
                first KeepSensor1QualifierUnchanged if Sensor1MonitoringMeanWithinAcceptableInterval then ReturnDeviationResult;
                first CheckSensor1MonitoringWithinInterval if not Sensor1MonitoringMeanWithinAcceptableInterval then SetSensor1QualifierDegraded;
                first SetSensor1QualifierDegraded if not Sensor1MonitoringMeanWithinAcceptableInterval then SetSensor1ValueToMinimum;
                first SetSensor1ValueToMinimum if not Sensor1MonitoringMeanWithinAcceptableInterval then ReturnDeviationResult;

            item deviationNotDetectedFailure : DetectionFailed {
                attribute localEffect = "Mission/monitoring channel deviation is not detected or not classified correctly.";
            }
}

        action def ResultPlausibilityCheck :> StaticHelperFunction {
attribute Sensor0VoltageBelowLowerBound : Boolean;
            attribute Sensor0VoltageAboveUpperBound : Boolean;
            attribute Sensor1VoltageBelowLowerBound : Boolean;
            attribute Sensor1VoltageAboveUpperBound : Boolean;
            action CheckSensor0VoltageLowerBound;
            action ClampSensor0ToZeroAndSetError;
            action CheckSensor0VoltageUpperBound;
            action ClampSensor0ToSixteenAndSetError;
            action CheckSensor1VoltageLowerBound;
            action ClampSensor1ToZeroAndSetError;
            action CheckSensor1VoltageUpperBound;
            action ClampSensor1ToSixteenAndSetError;
            action ReturnPlausibilityResult;

                first CheckSensor0VoltageLowerBound if Sensor0VoltageBelowLowerBound then ClampSensor0ToZeroAndSetError;
                first ClampSensor0ToZeroAndSetError if Sensor0VoltageBelowLowerBound then CheckSensor1VoltageLowerBound;
                first CheckSensor0VoltageLowerBound if not Sensor0VoltageBelowLowerBound then CheckSensor0VoltageUpperBound;
                first CheckSensor0VoltageUpperBound if Sensor0VoltageAboveUpperBound then ClampSensor0ToSixteenAndSetError;
                first ClampSensor0ToSixteenAndSetError if Sensor0VoltageAboveUpperBound then CheckSensor1VoltageLowerBound;
                first CheckSensor0VoltageUpperBound if not Sensor0VoltageAboveUpperBound then CheckSensor1VoltageLowerBound;
                first CheckSensor1VoltageLowerBound if Sensor1VoltageBelowLowerBound then ClampSensor1ToZeroAndSetError;
                first ClampSensor1ToZeroAndSetError if Sensor1VoltageBelowLowerBound then ReturnPlausibilityResult;
                first CheckSensor1VoltageLowerBound if not Sensor1VoltageBelowLowerBound then CheckSensor1VoltageUpperBound;
                first CheckSensor1VoltageUpperBound if Sensor1VoltageAboveUpperBound then ClampSensor1ToSixteenAndSetError;
                first ClampSensor1ToSixteenAndSetError if Sensor1VoltageAboveUpperBound then ReturnPlausibilityResult;
                first CheckSensor1VoltageUpperBound if not Sensor1VoltageAboveUpperBound then ReturnPlausibilityResult;
        }

        // trlc-satisfies: 28883887
        // trlc-satisfies: 28883920
        action def SupplyVoltageCheck :> StaticHelperFunction {
attribute Supply1OutOfValidRange : Boolean;
            attribute Supply2OutOfValidRange : Boolean;
            action CheckSupply1LowOrHighBound;
            action SetSensor1AndSupply1QualifierError;
            action LeaveSensor1AndSupply1QualifiersUnchanged;
            action CheckSupply2LowOrHighBound;
            action SetSensor2AndSupply2QualifierError;
            action LeaveSensor2AndSupply2QualifiersUnchanged;
            action ReturnSupplyVoltageResult;

                first CheckSupply1LowOrHighBound if Supply1OutOfValidRange then SetSensor1AndSupply1QualifierError;
                first SetSensor1AndSupply1QualifierError if Supply1OutOfValidRange then CheckSupply2LowOrHighBound;
                first CheckSupply1LowOrHighBound if not Supply1OutOfValidRange then LeaveSensor1AndSupply1QualifiersUnchanged;
                first LeaveSensor1AndSupply1QualifiersUnchanged if not Supply1OutOfValidRange then CheckSupply2LowOrHighBound;
                first CheckSupply2LowOrHighBound if Supply2OutOfValidRange then SetSensor2AndSupply2QualifierError;
                first SetSensor2AndSupply2QualifierError if Supply2OutOfValidRange then ReturnSupplyVoltageResult;
                first CheckSupply2LowOrHighBound if not Supply2OutOfValidRange then LeaveSensor2AndSupply2QualifiersUnchanged;
                first LeaveSensor2AndSupply2QualifiersUnchanged if not Supply2OutOfValidRange then ReturnSupplyVoltageResult;

            item supplyFaultNotDetectedFailure : DetectionFailed {
                attribute localEffect = "Supply voltage outside allowed thresholds is not converted into an error qualifier.";
            }
}

        // trlc-satisfies: 25188589
        action PowerStateVsQualifiers {
attribute PowerStateIsOff : Boolean;
            attribute TransitionIsSwitchToOn : Boolean;
            attribute TransitionIsSwitchToOff : Boolean;
            action CheckPowerStateOff;
            action CheckPowerStateOn;
            action SetAllQualifiersInit;
            action SetAllQualifiersNotAvailable;
            action ApplyStableOnChecks;
            action ReturnPowerQualifierResult;

                first CheckPowerStateOff if PowerStateIsOff and TransitionIsSwitchToOn then SetAllQualifiersInit;
                first SetAllQualifiersInit if PowerStateIsOff and TransitionIsSwitchToOn then ReturnPowerQualifierResult;
                first CheckPowerStateOff if PowerStateIsOff and not TransitionIsSwitchToOn then SetAllQualifiersNotAvailable;
                first SetAllQualifiersNotAvailable if PowerStateIsOff and not TransitionIsSwitchToOn then ReturnPowerQualifierResult;
                first CheckPowerStateOff if not PowerStateIsOff then CheckPowerStateOn;
                first CheckPowerStateOn if not PowerStateIsOff and TransitionIsSwitchToOn then SetAllQualifiersInit;
                first SetAllQualifiersInit if not PowerStateIsOff and TransitionIsSwitchToOn then ReturnPowerQualifierResult;
                first CheckPowerStateOn if not PowerStateIsOff and not TransitionIsSwitchToOn and TransitionIsSwitchToOff then SetAllQualifiersNotAvailable;
                first SetAllQualifiersNotAvailable if not PowerStateIsOff and TransitionIsSwitchToOff then ReturnPowerQualifierResult;
                first CheckPowerStateOn if not PowerStateIsOff and not TransitionIsSwitchToOn and not TransitionIsSwitchToOff then ApplyStableOnChecks;
                first ApplyStableOnChecks if not PowerStateIsOff and not TransitionIsSwitchToOn and not TransitionIsSwitchToOff then ReturnPowerQualifierResult;
        }

        action VARef_Error_Reaction {
            in attribute VARef1ErrorPresent;
            in attribute VARef2ErrorPresent;
attribute VARef1ErrorPresent_isTrue : Boolean;
            attribute VARef2ErrorPresent_isTrue : Boolean;
            action CheckVARef1ErrorPresent;
            action CheckVARef2ErrorPresent;
            action SetSensorAndSupplyQualifiersDegraded;
            action SetSensorQualifiersDegradedOnly;
            action SetAllQualifiersError;
            action LeaveQualifiersUnchanged;
            action ReturnVARefReaction;

                first CheckVARef1ErrorPresent if VARef1ErrorPresent_isTrue then CheckVARef2ErrorPresent;
                first CheckVARef2ErrorPresent if VARef1ErrorPresent_isTrue and VARef2ErrorPresent_isTrue then SetAllQualifiersError;
                first SetAllQualifiersError if VARef1ErrorPresent_isTrue and VARef2ErrorPresent_isTrue then ReturnVARefReaction;
                first CheckVARef2ErrorPresent if VARef1ErrorPresent_isTrue and not VARef2ErrorPresent_isTrue then SetSensorAndSupplyQualifiersDegraded;
                first SetSensorAndSupplyQualifiersDegraded if VARef1ErrorPresent_isTrue and not VARef2ErrorPresent_isTrue then ReturnVARefReaction;
                first CheckVARef1ErrorPresent if not VARef1ErrorPresent_isTrue then CheckVARef2ErrorPresent;
                first CheckVARef2ErrorPresent if not VARef1ErrorPresent_isTrue and VARef2ErrorPresent_isTrue then SetSensorQualifiersDegradedOnly;
                first SetSensorQualifiersDegradedOnly if not VARef1ErrorPresent_isTrue and VARef2ErrorPresent_isTrue then ReturnVARefReaction;
                first CheckVARef2ErrorPresent if not VARef1ErrorPresent_isTrue and not VARef2ErrorPresent_isTrue then LeaveQualifiersUnchanged;
                first LeaveQualifiersUnchanged if not VARef1ErrorPresent_isTrue and not VARef2ErrorPresent_isTrue then ReturnVARefReaction;
        }

        // trlc-satisfies: 30477411
        // trlc-satisfies: 30477478
        action ADC_Error_Callbacks {
action AcpdCdd_IncrementAdcConvErrGroup0 : StaticHelperFunction;
            action AcpdCdd_IncrementAdcConvErrGroup1 : StaticHelperFunction;
            action AcpdCdd_IncrementAdcConvErrSupply : StaticHelperFunction;
            action EnterExclusiveArea;
            action CheckCounterMaximum;
            action IncrementCounterSafely;
            action ExitExclusiveArea;
            action ApplyAdcErrorImpactToQualifiers;

            first AcpdCdd_IncrementAdcConvErrGroup0 then EnterExclusiveArea;
            first AcpdCdd_IncrementAdcConvErrGroup1 then EnterExclusiveArea;
            first AcpdCdd_IncrementAdcConvErrSupply then EnterExclusiveArea;
            first EnterExclusiveArea then CheckCounterMaximum;
            first CheckCounterMaximum then IncrementCounterSafely;
            first IncrementCounterSafely then ExitExclusiveArea;
            first ExitExclusiveArea then ApplyAdcErrorImpactToQualifiers;
        }

        action def AcpdCdd_IncrementAdcConvErrGroup0 :> StaticHelperFunction;
        action def AcpdCdd_IncrementAdcConvErrGroup1 :> StaticHelperFunction;
        action def AcpdCdd_IncrementAdcConvErrSupply :> StaticHelperFunction;

        action def AcpdCdd_Monitoring :> ModuleApiFunction {
            in item InputData : InputDataType;
            in item ProcessedData : ChannelMeansType;
            in item PowerCycleStatus : PowerStatusType;
            in attribute VARef1ErrorPresent;
            in attribute VARef2ErrorPresent;
            out item acceleratorData : tAcpdCdd_rc_AccrSnsr;

            // trlc-satisfies: 25094047
action InitializeQualifiersFromProcessedData;
            action AcpdCdd_MissingDataCheck : StaticHelperFunction;
            action AcpdCdd_CheckTimestamps : StaticHelperFunction;
            action CombineWithAdcErrorCallbackCounters;
            action PowerStateVsQualifiers;
            action AcpdCdd_DeviationCheck : StaticHelperFunction;
            action ResultPlausibilityCheck : StaticHelperFunction;
            action SupplyVoltageCheck : StaticHelperFunction;
            action VARef_Error_Reaction;
            action ReturnAcceleratorData;

            first InitializeQualifiersFromProcessedData then AcpdCdd_MissingDataCheck;
            first AcpdCdd_MissingDataCheck then AcpdCdd_CheckTimestamps;
            first AcpdCdd_CheckTimestamps then CombineWithAdcErrorCallbackCounters;
            first CombineWithAdcErrorCallbackCounters then PowerStateVsQualifiers;
            first PowerStateVsQualifiers then AcpdCdd_DeviationCheck;
            first AcpdCdd_DeviationCheck then ResultPlausibilityCheck;
            first ResultPlausibilityCheck then SupplyVoltageCheck;
            first SupplyVoltageCheck then VARef_Error_Reaction;
            first VARef_Error_Reaction then ReturnAcceleratorData;
item qualifierIncorrectFailure : QualifierIncorrect {
                attribute localEffect = "Monitoring returns sensor or supply data with an incorrect qualifier.";
            }
}

        action AcpdCdd_Monitoring_Behavior {
action AcpdCdd_Monitoring : ModuleApiFunction;
            action AcpdCdd_MissingDataCheck : StaticHelperFunction;
            action AcpdCdd_CheckTimestamps : StaticHelperFunction;
            action AcpdCdd_CrossCheckTimestamps : StaticHelperFunction;
            action AcpdCdd_DeviationCheck : StaticHelperFunction;
            action ResultPlausibilityCheck : StaticHelperFunction;
            action SupplyVoltageCheck : StaticHelperFunction;
            action PowerStateVsQualifiers;
            action VARef_Error_Reaction;
            action ADC_Error_Callbacks;

            first AcpdCdd_Monitoring then AcpdCdd_MissingDataCheck;
            first AcpdCdd_MissingDataCheck then AcpdCdd_CheckTimestamps;
            first AcpdCdd_CheckTimestamps then AcpdCdd_CrossCheckTimestamps;
            first AcpdCdd_CrossCheckTimestamps then AcpdCdd_DeviationCheck;
            first AcpdCdd_DeviationCheck then ResultPlausibilityCheck;
            first ResultPlausibilityCheck then SupplyVoltageCheck;
            first SupplyVoltageCheck then PowerStateVsQualifiers;
            first PowerStateVsQualifiers then VARef_Error_Reaction;
            first VARef_Error_Reaction then ADC_Error_Callbacks;
        }

        part def AcpdCdd_Monitoring {
            port inputDataIn : InputDataInPort;
            port processedDataIn : ProcessedDataInPort;
            port powerStatusIn : PowerStatusInPort;
            port varef1ErrorIn : VARef1ErrorInPort;
            port varef2ErrorIn : VARef2ErrorInPort;
            port acceleratorDataOut : AcceleratorDataOutPort;

            action monitoring;
            action crossCheckTimestamps;
            action checkTimestamps;
            action missingDataCheck;
            action deviationCheck;
            action resultPlausibilityCheck;
            action supplyVoltageCheck;
            action powerStateVsQualifiers;
            action adcErrorCallbacks;
            action monitoringBehavior;
        }

        action AcpdCdd_Monitoring_Sequence_AsActionFlow {
action MonitoringReceivesProcessedData;
            action MonitoringReceivesPowerStatus;

            action MonitoringChecksInputPlausibility;
            action MonitoringChecksPowerConditions;

            action MonitoringDeterminesFaultStatus;

            action MonitoringRequestsDemEventStorage;
            action DemStoresDiagnosticEvent;

            action MonitoringPublishesMonitoringStatus;

            first MonitoringReceivesProcessedData then MonitoringReceivesPowerStatus;

            first MonitoringReceivesPowerStatus
            then MonitoringChecksInputPlausibility;

            first MonitoringChecksInputPlausibility
            then MonitoringChecksPowerConditions;

            first MonitoringChecksPowerConditions
            then MonitoringDeterminesFaultStatus;

            first MonitoringDeterminesFaultStatus
            then MonitoringRequestsDemEventStorage;

            first MonitoringRequestsDemEventStorage
            then DemStoresDiagnosticEvent;

            first DemStoresDiagnosticEvent
            then MonitoringPublishesMonitoringStatus;
        }


    }
}

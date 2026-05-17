package AcpdCdd_SysMLv2 {
    package Monitoring {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

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
        action def AcpdCdd_CrossCheckTimestamps {
            in attribute timestamp0;
            in attribute timestamp1;
            in attribute timestampOffset;
            out attribute result;

            action entry;
            first entry then ComputeInitialOffset;
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
            first CompareWithCrosscheckBound if CompareWithCrosscheckBound_allows_ReturnFalseIfOutOfRange then ReturnFalseIfOutOfRange;
        }

        // trlc-satisfies: 28710924
        // trlc-satisfies: 28711397
        // trlc-satisfies: 41781961
        // trlc-satisfies: 41781989
        // trlc-satisfies: 28711565
        // trlc-satisfies: 30474716
        action def AcpdCdd_CheckTimestamps {
            in item InputData : InputDataType;
            out item ErrorCounters : AcpdCddCheckErrorCountersType;

            action entry;
            first entry then InitializeErrorCounters;
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
        }

        // trlc-satisfies: 28711591
        action def AcpdCdd_MissingDataCheck {
            in item InputData : InputDataType;
            out item ErrorCounters : AcpdCddCheckErrorCountersType;

            action entry;
            first entry then InitializeMissingDataCounters;
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
        }

        // trlc-satisfies: 25128928
        // trlc-satisfies: 44879718
        // trlc-satisfies: 44879786
        // trlc-satisfies: 25128720
        // trlc-satisfies: 25128907
        action def AcpdCdd_DeviationCheck {
            in item ProcessedData : ChannelMeansType;

            action entry;
            first entry then SelectSensor0MissionAndMonitoringMeans;
            action SelectSensor0MissionAndMonitoringMeans;
            action ComputeSensor0AcceptableInterval;
            action CheckSensor0MonitoringWithinInterval;
            action SetSensor0QualifierDegradedIfOutside;
            action SetSensor0ValueToMinimumIfOutside;
            action SelectSensor1MissionAndMonitoringMeans;
            action ComputeSensor1AcceptableInterval;
            action CheckSensor1MonitoringWithinInterval;
            action SetSensor1QualifierDegradedIfOutside;
            action SetSensor1ValueToMinimumIfOutside;

            first SelectSensor0MissionAndMonitoringMeans then ComputeSensor0AcceptableInterval;
            first ComputeSensor0AcceptableInterval then CheckSensor0MonitoringWithinInterval;
            first CheckSensor0MonitoringWithinInterval then SetSensor0QualifierDegradedIfOutside;
            first SetSensor0QualifierDegradedIfOutside then SetSensor0ValueToMinimumIfOutside;
            first SetSensor0ValueToMinimumIfOutside then SelectSensor1MissionAndMonitoringMeans;
            first SelectSensor1MissionAndMonitoringMeans then ComputeSensor1AcceptableInterval;
            first ComputeSensor1AcceptableInterval then CheckSensor1MonitoringWithinInterval;
            first CheckSensor1MonitoringWithinInterval then SetSensor1QualifierDegradedIfOutside;
            first SetSensor1QualifierDegradedIfOutside then SetSensor1ValueToMinimumIfOutside;
        }

        action def ResultPlausibilityCheck {

            action entry;
            first entry then CheckSensor0VoltageLowerBound;
            action CheckSensor0VoltageLowerBound;
            action ClampSensor0ToZeroAndSetErrorIfBelow;
            action CheckSensor0VoltageUpperBound;
            action ClampSensor0ToSixteenAndSetErrorIfAbove;
            action CheckSensor1VoltageLowerBound;
            action ClampSensor1ToZeroAndSetErrorIfBelow;
            action CheckSensor1VoltageUpperBound;
            action ClampSensor1ToSixteenAndSetErrorIfAbove;

            first CheckSensor0VoltageLowerBound then ClampSensor0ToZeroAndSetErrorIfBelow;
            first ClampSensor0ToZeroAndSetErrorIfBelow then CheckSensor0VoltageUpperBound;
            first CheckSensor0VoltageUpperBound then ClampSensor0ToSixteenAndSetErrorIfAbove;
            first ClampSensor0ToSixteenAndSetErrorIfAbove then CheckSensor1VoltageLowerBound;
            first CheckSensor1VoltageLowerBound then ClampSensor1ToZeroAndSetErrorIfBelow;
            first ClampSensor1ToZeroAndSetErrorIfBelow then CheckSensor1VoltageUpperBound;
            first CheckSensor1VoltageUpperBound then ClampSensor1ToSixteenAndSetErrorIfAbove;
        }

        // trlc-satisfies: 28883887
        // trlc-satisfies: 28883920
        action def SupplyVoltageCheck {

            action entry;
            first entry then CheckSupply1LowOrHighBound;
            action CheckSupply1LowOrHighBound;
            action SetSensor1AndSupply1QualifierErrorIfOutOfRange;
            action CheckSupply2LowOrHighBound;
            action SetSensor2AndSupply2QualifierErrorIfOutOfRange;

            first CheckSupply1LowOrHighBound then SetSensor1AndSupply1QualifierErrorIfOutOfRange;
            first SetSensor1AndSupply1QualifierErrorIfOutOfRange then CheckSupply2LowOrHighBound;
            first CheckSupply2LowOrHighBound then SetSensor2AndSupply2QualifierErrorIfOutOfRange;
        }

        // trlc-satisfies: 25188589
        action def PowerStateVsQualifiers {

            action entry;
            first entry then CheckPowerStateOff;
            attribute CheckPowerStateOff_allows_CheckSwitchToOn : Boolean;
            attribute CheckPowerStateOff_allows_CheckSwitchToOff : Boolean;
            attribute CheckPowerStateOn_allows_CheckSwitchToOn : Boolean;
            attribute CheckPowerStateOn_allows_CheckSwitchToOff : Boolean;
            attribute CheckPowerStateOn_allows_ApplyStableOnChecks : Boolean;
            action CheckPowerStateOff;
            action CheckPowerStateOn;
            action CheckSwitchToOn;
            action SetAllQualifiersInit;
            action CheckSwitchToOff;
            action SetAllQualifiersNotAvailable;
            action ApplyStableOnChecks;

            first CheckPowerStateOff if CheckPowerStateOff_allows_CheckSwitchToOn then CheckSwitchToOn;
            first CheckSwitchToOn then SetAllQualifiersInit;
            first CheckPowerStateOff if CheckPowerStateOff_allows_CheckSwitchToOff then CheckSwitchToOff;
            first CheckSwitchToOff then SetAllQualifiersNotAvailable;
            first CheckPowerStateOn if CheckPowerStateOn_allows_CheckSwitchToOn then CheckSwitchToOn;
            first CheckPowerStateOn if CheckPowerStateOn_allows_CheckSwitchToOff then CheckSwitchToOff;
            first CheckPowerStateOn if CheckPowerStateOn_allows_ApplyStableOnChecks then ApplyStableOnChecks;
        }

        // trlc-satisfies: 30477411
        // trlc-satisfies: 30477478
        action def ADC_Error_Callbacks {

            action entry;
            first entry then AcpdCdd_IncrementAdcConvErrGroup0;
            action AcpdCdd_IncrementAdcConvErrGroup0;
            action AcpdCdd_IncrementAdcConvErrGroup1;
            action AcpdCdd_IncrementAdcConvErrSupply;
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

        action def AcpdCdd_IncrementAdcConvErrGroup0;
        action def AcpdCdd_IncrementAdcConvErrGroup1;
        action def AcpdCdd_IncrementAdcConvErrSupply;

        action def AcpdCdd_Monitoring {
            in item InputData : InputDataType;
            in item ProcessedData : ChannelMeansType;
            in item PowerCycleStatus : PowerStatusType;
            in attribute VARef1ErrorPresent;
            in attribute VARef2ErrorPresent;
            out item acceleratorData : tAcpdCdd_rc_AccrSnsr;

            // trlc-satisfies: 25094047
            action entry;
            first entry then InitializeQualifiersFromProcessedData;
            action InitializeQualifiersFromProcessedData;
            action AcpdCdd_MissingDataCheck;
            action AcpdCdd_CheckTimestamps;
            action CombineWithAdcErrorCallbackCounters;
            action PowerStateVsQualifiers;
            action AcpdCdd_DeviationCheck;
            action ResultPlausibilityCheck;
            action SupplyVoltageCheck;
            action ApplyVARef1ErrorFlag;
            action ApplyVARef2ErrorFlag;
            action ReturnAcceleratorData;

            first InitializeQualifiersFromProcessedData then AcpdCdd_MissingDataCheck;
            first AcpdCdd_MissingDataCheck then AcpdCdd_CheckTimestamps;
            first AcpdCdd_CheckTimestamps then CombineWithAdcErrorCallbackCounters;
            first CombineWithAdcErrorCallbackCounters then PowerStateVsQualifiers;
            first PowerStateVsQualifiers then AcpdCdd_DeviationCheck;
            first AcpdCdd_DeviationCheck then ResultPlausibilityCheck;
            first ResultPlausibilityCheck then SupplyVoltageCheck;
            first SupplyVoltageCheck then ApplyVARef1ErrorFlag;
            first ApplyVARef1ErrorFlag then ApplyVARef2ErrorFlag;
            first ApplyVARef2ErrorFlag then ReturnAcceleratorData;
        }

        action def AcpdCdd_Monitoring_Behavior {
            action entry;
            first entry then AcpdCdd_Monitoring;
            action AcpdCdd_Monitoring;
            action AcpdCdd_MissingDataCheck;
            action AcpdCdd_CheckTimestamps;
            action AcpdCdd_CrossCheckTimestamps;
            action AcpdCdd_DeviationCheck;
            action ResultPlausibilityCheck;
            action SupplyVoltageCheck;
            action PowerStateVsQualifiers;
            action ADC_Error_Callbacks;

            first AcpdCdd_Monitoring then AcpdCdd_MissingDataCheck;
            first AcpdCdd_MissingDataCheck then AcpdCdd_CheckTimestamps;
            first AcpdCdd_CheckTimestamps then AcpdCdd_CrossCheckTimestamps;
            first AcpdCdd_CrossCheckTimestamps then AcpdCdd_DeviationCheck;
            first AcpdCdd_DeviationCheck then ResultPlausibilityCheck;
            first ResultPlausibilityCheck then SupplyVoltageCheck;
            first SupplyVoltageCheck then PowerStateVsQualifiers;
            first PowerStateVsQualifiers then ADC_Error_Callbacks;
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

        action def AcpdCdd_Monitoring_Sequence_AsActionFlow {

            action entry;
            first entry then MonitoringReceivesProcessedData;
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

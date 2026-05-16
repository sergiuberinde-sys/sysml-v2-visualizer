package Input {

    private import ScalarValues::*;
    private import Types::*;

    port def InputDataOutPort {
        out item InputData : InputDataType;
    }

    // trlc-satisfies: 25094200
    // trlc-satisfies: 30474716
    port def AdcGroup0InPort {
        in item SensorDataEntry : AdcSensorDataEntryType;
    }

    port def AdcGroup1InPort {
        in item SensorDataEntry : AdcSensorDataEntryType;
    }

    port def AdcSupplyInPort {
        in item SensorDataEntry : AdcSensorDataEntryType;
    }

    // trlc-satisfies: 28824395
    // trlc-satisfies: 25094135
    action def AcpdCdd_InitializeAdcGroupData {
        in item AdcGroupData : AdcGroupDataType;

        action CheckAdcGroupDataNotNull;
        action SetEntriesToInvalidInputVoltage;
        action SetWriteIndexToZero;
        action SetUpdateCounterToZero;

        first CheckAdcGroupDataNotNull then SetEntriesToInvalidInputVoltage;
        first SetEntriesToInvalidInputVoltage then SetWriteIndexToZero;
        first SetWriteIndexToZero then SetUpdateCounterToZero;
    }

    action def AcpdCdd_AddAdcGroupDataEntry {
        in item SensorData : AdcGroupDataType;
        in item SensorDataEntry : AdcSensorDataEntryType;

        action CheckSensorDataNotNull;
        action CopyEntryAtWriteIndex;
        action IncrementWriteIndex;
        action WrapWriteIndexIfNeeded;
        action IncrementUpdateCounter;

        first CheckSensorDataNotNull then CopyEntryAtWriteIndex;
        first CopyEntryAtWriteIndex then IncrementWriteIndex;
        first IncrementWriteIndex then WrapWriteIndexIfNeeded;
        first WrapWriteIndexIfNeeded then IncrementUpdateCounter;
    }

    action def AcpdCdd_GetAdcGroupData {
        in item SensorData : AdcGroupDataType;
        out item result : AdcSensorDataBufferType;

        action CheckSensorDataNotNull;
        action DetermineOldestIndex;
        action CopyRingBufferOldestToNewest;
        action EvaluateUpdateCounter;
        action SetMissingEntriesToInvalidInputVoltage;
        action DecrementUpdateCounter;
        action ReturnBuffer;

        first CheckSensorDataNotNull then DetermineOldestIndex;
        first DetermineOldestIndex then CopyRingBufferOldestToNewest;
        first CopyRingBufferOldestToNewest then EvaluateUpdateCounter;
        first EvaluateUpdateCounter then SetMissingEntriesToInvalidInputVoltage;
        first SetMissingEntriesToInvalidInputVoltage then DecrementUpdateCounter;
        first DecrementUpdateCounter then ReturnBuffer;
    }

    action def AcpdCdd_StartInputCollector {
        out attribute success;

        action SetupResultBufferGroup0;
        action SetupResultBufferGroup1;
        action SetupResultBufferSupply;
        action InitializeGroup0Data;
        action InitializeGroup1Data;
        action InitializeSupplyData;
        action EnableGroup0Notification;
        action EnableGroup1Notification;
        action EnableSupplyNotification;
        action EnableGroup0HardwareTrigger;
        action EnableGroup1HardwareTrigger;
        action EnableSupplyHardwareTrigger;
        action ReturnSuccess;

        first SetupResultBufferGroup0 then SetupResultBufferGroup1;
        first SetupResultBufferGroup1 then SetupResultBufferSupply;
        first SetupResultBufferSupply then InitializeGroup0Data;
        first InitializeGroup0Data then InitializeGroup1Data;
        first InitializeGroup1Data then InitializeSupplyData;
        first InitializeSupplyData then EnableGroup0Notification;
        first EnableGroup0Notification then EnableGroup1Notification;
        first EnableGroup1Notification then EnableSupplyNotification;
        first EnableSupplyNotification then EnableGroup0HardwareTrigger;
        first EnableGroup0HardwareTrigger then EnableGroup1HardwareTrigger;
        first EnableGroup1HardwareTrigger then EnableSupplyHardwareTrigger;
        first EnableSupplyHardwareTrigger then ReturnSuccess;
    }
    // trlc-satisfies: 25127428
    // trlc-satisfies: 25187813
    action def AcpdCdd_AdcGroup0NewData {

        action GetGroup0SampleFromAdc;
        action ValidateSampleCountPointerAndRange;
        action UseActualOrInvalidSample;
        action CheckOldGroup0Cache;
        action PushOldGroup0WithInvalidGroup1IfNeeded;
        action CacheNewGroup0Sample;
        action SetIsGroup0FilledTrue;
        action CheckBothGroup0AndGroup1Filled;
        action WriteConsistentPairToRingBuffer;
        action ResetCachePair;

        first GetGroup0SampleFromAdc then ValidateSampleCountPointerAndRange;
        first ValidateSampleCountPointerAndRange then UseActualOrInvalidSample;
        first UseActualOrInvalidSample then CheckOldGroup0Cache;
        first CheckOldGroup0Cache then PushOldGroup0WithInvalidGroup1IfNeeded;
        first PushOldGroup0WithInvalidGroup1IfNeeded then CacheNewGroup0Sample;
        first CacheNewGroup0Sample then SetIsGroup0FilledTrue;
        first SetIsGroup0FilledTrue then CheckBothGroup0AndGroup1Filled;
        first CheckBothGroup0AndGroup1Filled then WriteConsistentPairToRingBuffer;
        first WriteConsistentPairToRingBuffer then ResetCachePair;
    }

    action def AcpdCdd_AdcGroup1NewData {

        action GetGroup1SampleFromAdc;
        action ValidateSampleCountPointerAndRange;
        action UseActualOrInvalidSample;
        action CheckOldGroup1Cache;
        action PushOldGroup1WithInvalidGroup0IfNeeded;
        action CacheNewGroup1Sample;
        action SetIsGroup1FilledTrue;
        action CheckBothGroup0AndGroup1Filled;
        action WriteConsistentPairToRingBuffer;
        action ResetCachePair;

        first GetGroup1SampleFromAdc then ValidateSampleCountPointerAndRange;
        first ValidateSampleCountPointerAndRange then UseActualOrInvalidSample;
        first UseActualOrInvalidSample then CheckOldGroup1Cache;
        first CheckOldGroup1Cache then PushOldGroup1WithInvalidGroup0IfNeeded;
        first PushOldGroup1WithInvalidGroup0IfNeeded then CacheNewGroup1Sample;
        first CacheNewGroup1Sample then SetIsGroup1FilledTrue;
        first SetIsGroup1FilledTrue then CheckBothGroup0AndGroup1Filled;
        first CheckBothGroup0AndGroup1Filled then WriteConsistentPairToRingBuffer;
        first WriteConsistentPairToRingBuffer then ResetCachePair;
    }

    // trlc-satisfies: 25127531
    action def AcpdCdd_AdcSupplyNewData {

        action GetSupplySampleFromAdc;
        action ValidateSupplySample;
        action WriteSupplySampleToRingBuffer;
        action UpdateSupplyCache;

        first GetSupplySampleFromAdc then ValidateSupplySample;
        first ValidateSupplySample then WriteSupplySampleToRingBuffer;
        first WriteSupplySampleToRingBuffer then UpdateSupplyCache;
    }
    // trlc-satisfies: 25130711
    // trlc-satisfies: 28710933
    action def AcpdCdd_CollectInputData {
        out item InputData : InputDataType;

        action EnterSensorGroupDataHandlingExclusiveArea;
        action GetGroup0Data;
        action GetGroup1Data;
        action ExitSensorGroupDataHandlingExclusiveArea;
        action EnterSupplyDataHandlingExclusiveArea;
        action GetSupplyData;
        action ExitSupplyDataHandlingExclusiveArea;
        action MapGroup0Group1SupplyToSensor0Data;
        action MapGroup0Group1SupplyToSensor1Data;
        action MapTimestamps;
        action ReturnInputData;

        first EnterSensorGroupDataHandlingExclusiveArea then GetGroup0Data;
        first GetGroup0Data then GetGroup1Data;
        first GetGroup1Data then ExitSensorGroupDataHandlingExclusiveArea;
        first ExitSensorGroupDataHandlingExclusiveArea then EnterSupplyDataHandlingExclusiveArea;
        first EnterSupplyDataHandlingExclusiveArea then GetSupplyData;
        first GetSupplyData then ExitSupplyDataHandlingExclusiveArea;
        first ExitSupplyDataHandlingExclusiveArea then MapGroup0Group1SupplyToSensor0Data;
        first MapGroup0Group1SupplyToSensor0Data then MapGroup0Group1SupplyToSensor1Data;
        first MapGroup0Group1SupplyToSensor1Data then MapTimestamps;
        first MapTimestamps then ReturnInputData;
    }

    action def AcpdCdd_Input_Behavior {

        action AcpdCdd_StartInputCollector;
        action AcpdCdd_AdcGroup0NewData;
        action AcpdCdd_AdcGroup1NewData;
        action AcpdCdd_AdcSupplyNewData;
        action AcpdCdd_CollectInputData;

        first AcpdCdd_StartInputCollector then AcpdCdd_CollectInputData;
        first AcpdCdd_AdcGroup0NewData then AcpdCdd_CollectInputData;
        first AcpdCdd_AdcGroup1NewData then AcpdCdd_CollectInputData;
        first AcpdCdd_AdcSupplyNewData then AcpdCdd_CollectInputData;
    }

    part def AcpdCdd_Input {
        port adcGroup0In : AdcGroup0InPort;
        port adcGroup1In : AdcGroup1InPort;
        port adcSupplyIn : AdcSupplyInPort;
        port inputDataOut : InputDataOutPort;

        item group0Data : AdcGroupDataType;
        item group1Data : AdcGroupDataType;
        item supplyData : AdcGroupDataType;
        item groupDataEntryPair : AdcGroupDataEntryPairType;

        action initializeAdcGroupData;
        action addAdcGroupDataEntry;
        action getAdcGroupData;
        action startInputCollector;
        action adcGroup0NewData;
        action adcGroup1NewData;
        action adcSupplyNewData;
        action collectInputData;
        action inputBehavior;
    }

    action def AcpdCdd_Input_Sequence_AsActionFlow {

        action InputInitializesAdcGroupData;
        action InputAddsAdcGroupDataEntry;
        action InputRequestsStoredAdcGroupData;

        action InputRequestsAdcGroup0Conversion;
        action AdcProvidesGroup0Data;

        action InputRequestsAdcGroup1Conversion;
        action AdcProvidesGroup1Data;

        action InputRequestsAdcSupplyConversion;
        action AdcProvidesSupplyData;

        action InputCollectsAndValidatesData;
        action InputPublishesInputData;

        first InputInitializesAdcGroupData then InputAddsAdcGroupDataEntry;
        first InputAddsAdcGroupDataEntry then InputRequestsStoredAdcGroupData;

        first InputRequestsStoredAdcGroupData then InputRequestsAdcGroup0Conversion;
        first InputRequestsAdcGroup0Conversion then AdcProvidesGroup0Data;

        first AdcProvidesGroup0Data then InputRequestsAdcGroup1Conversion;
        first InputRequestsAdcGroup1Conversion then AdcProvidesGroup1Data;

        first AdcProvidesGroup1Data then InputRequestsAdcSupplyConversion;
        first InputRequestsAdcSupplyConversion then AdcProvidesSupplyData;

        first AdcProvidesSupplyData then InputCollectsAndValidatesData;
        first InputCollectsAndValidatesData then InputPublishesInputData;
    }


}

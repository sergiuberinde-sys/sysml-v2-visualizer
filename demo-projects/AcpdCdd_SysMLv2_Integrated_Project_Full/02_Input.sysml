package AcpdCdd_SysMLv2 {
    package Input {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;
	private import ScalarValues::Boolean;
        // Boolean guards used by explicit conditional branching.
        attribute EvaluateUpdateCounter_detectsMissingEntries : Boolean;
        attribute Group0SampleCountPointerAndRange_isValid : Boolean;
        attribute OldGroup0Cache_isFilled : Boolean;
        attribute Group0AndGroup1Cache_areBothFilled : Boolean;
        attribute Group1SampleCountPointerAndRange_isValid : Boolean;
        attribute OldGroup1Cache_isFilled : Boolean;
        attribute SupplySample_isValid : Boolean;
        attribute CollectedInputData_isValid : Boolean;
        attribute AdcNotification_hasArrived : Boolean;
        attribute DecodedAdcTimestamp_isFresh : Boolean;
        attribute Group0Sample_isInvalid : Boolean;
        attribute Group1Sample_isInvalid : Boolean;
        attribute SupplySample_isInvalid : Boolean;
        attribute SensorPair_isPlausible : Boolean;



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
            out item InitializedAdcGroupData : AdcGroupDataType;
            action CheckAdcGroupDataNotNull {
                in item AdcGroupData : AdcGroupDataType;
                out item CheckedAdcGroupData : AdcGroupDataType;
            }
            action SetEntriesToInvalidInputVoltage {
                in item AdcGroupData : AdcGroupDataType;
                out item InvalidInitializedAdcGroupData : AdcGroupDataType;
            }
            action SetWriteIndexToZero {
                in item AdcGroupData : AdcGroupDataType;
                out item IndexedAdcGroupData : AdcGroupDataType;
            }
            action SetUpdateCounterToZero {
                in item AdcGroupData : AdcGroupDataType;
                out item InitializedAdcGroupData : AdcGroupDataType;
            }
first CheckAdcGroupDataNotNull then SetEntriesToInvalidInputVoltage;
            first SetEntriesToInvalidInputVoltage then SetWriteIndexToZero;
            first SetWriteIndexToZero then SetUpdateCounterToZero;
flow from AdcGroupData to CheckAdcGroupDataNotNull.AdcGroupData;
            flow from CheckAdcGroupDataNotNull.CheckedAdcGroupData to SetEntriesToInvalidInputVoltage.AdcGroupData;
            flow from SetEntriesToInvalidInputVoltage.InvalidInitializedAdcGroupData to SetWriteIndexToZero.AdcGroupData;
            flow from SetWriteIndexToZero.IndexedAdcGroupData to SetUpdateCounterToZero.AdcGroupData;
            flow from SetUpdateCounterToZero.InitializedAdcGroupData to InitializedAdcGroupData;
        }

        action def AcpdCdd_AddAdcGroupDataEntry {
            in item SensorData : AdcGroupDataType;
            in item SensorDataEntry : AdcSensorDataEntryType;
            out item UpdatedSensorData : AdcGroupDataType;
            action CheckSensorDataNotNull {
                in item SensorData : AdcGroupDataType;
                out item CheckedSensorData : AdcGroupDataType;
            }
            action CopyEntryAtWriteIndex {
                in item SensorData : AdcGroupDataType;
                in item SensorDataEntry : AdcSensorDataEntryType;
                out item SensorDataWithCopiedEntry : AdcGroupDataType;
            }
            action IncrementWriteIndex {
                in item SensorData : AdcGroupDataType;
                out item SensorDataWithIncrementedWriteIndex : AdcGroupDataType;
            }
            action WrapWriteIndexIfNeeded {
                in item SensorData : AdcGroupDataType;
                out item SensorDataWithWrappedWriteIndex : AdcGroupDataType;
            }
            action IncrementUpdateCounter {
                in item SensorData : AdcGroupDataType;
                out item UpdatedSensorData : AdcGroupDataType;
            }
first CheckSensorDataNotNull then CopyEntryAtWriteIndex;
            first CopyEntryAtWriteIndex then IncrementWriteIndex;
            first IncrementWriteIndex then WrapWriteIndexIfNeeded;
            first WrapWriteIndexIfNeeded then IncrementUpdateCounter;
flow from SensorData to CheckSensorDataNotNull.SensorData;
            flow from CheckSensorDataNotNull.CheckedSensorData to CopyEntryAtWriteIndex.SensorData;
            flow from SensorDataEntry to CopyEntryAtWriteIndex.SensorDataEntry;
            flow from CopyEntryAtWriteIndex.SensorDataWithCopiedEntry to IncrementWriteIndex.SensorData;
            flow from IncrementWriteIndex.SensorDataWithIncrementedWriteIndex to WrapWriteIndexIfNeeded.SensorData;
            flow from WrapWriteIndexIfNeeded.SensorDataWithWrappedWriteIndex to IncrementUpdateCounter.SensorData;
            flow from IncrementUpdateCounter.UpdatedSensorData to UpdatedSensorData;
        }

        action def AcpdCdd_GetAdcGroupData {
            in item SensorData : AdcGroupDataType;
            out item result : AdcSensorDataBufferType;
            out item UpdatedSensorData : AdcGroupDataType;
            action CheckSensorDataNotNull {
                in item SensorData : AdcGroupDataType;
                out item CheckedSensorData : AdcGroupDataType;
            }
            action DetermineOldestIndex {
                in item SensorData : AdcGroupDataType;
                out item IndexedSensorData : AdcGroupDataType;
            }
            action CopyRingBufferOldestToNewest {
                in item SensorData : AdcGroupDataType;
                out item CopiedBuffer : AdcSensorDataBufferType;
            }
            action EvaluateUpdateCounter {
                in item SensorData : AdcGroupDataType;
                out item counterState : AdcGroupDataReadDecisionType;
            }
            action SetMissingEntriesToInvalidInputVoltage {
                in item buffer : AdcSensorDataBufferType;
                out item completedBuffer : AdcSensorDataBufferType;
            }
            action DecrementUpdateCounter {
                in item SensorData : AdcGroupDataType;
                out item UpdatedSensorData : AdcGroupDataType;
            }
            action ReturnBuffer {
                in item buffer : AdcSensorDataBufferType;
                out item result : AdcSensorDataBufferType;
            }
first CheckSensorDataNotNull then DetermineOldestIndex;
            first DetermineOldestIndex then CopyRingBufferOldestToNewest;
            first CopyRingBufferOldestToNewest then EvaluateUpdateCounter;

            // Decision: if the ring buffer does not contain enough updates, pad with invalid entries.
                first EvaluateUpdateCounter if EvaluateUpdateCounter_detectsMissingEntries then SetMissingEntriesToInvalidInputVoltage;
                first EvaluateUpdateCounter if not EvaluateUpdateCounter_detectsMissingEntries then ReturnBuffer;
first SetMissingEntriesToInvalidInputVoltage then ReturnBuffer;
            first ReturnBuffer then DecrementUpdateCounter;
flow from SensorData to CheckSensorDataNotNull.SensorData;
            flow from CheckSensorDataNotNull.CheckedSensorData to DetermineOldestIndex.SensorData;
            flow from DetermineOldestIndex.IndexedSensorData to CopyRingBufferOldestToNewest.SensorData;
            flow from DetermineOldestIndex.IndexedSensorData to EvaluateUpdateCounter.SensorData;
            flow from CopyRingBufferOldestToNewest.CopiedBuffer to SetMissingEntriesToInvalidInputVoltage.buffer;
            flow from CopyRingBufferOldestToNewest.CopiedBuffer to ReturnBuffer.buffer;
            flow from SetMissingEntriesToInvalidInputVoltage.completedBuffer to ReturnBuffer.buffer;
            flow from DetermineOldestIndex.IndexedSensorData to DecrementUpdateCounter.SensorData;
            flow from ReturnBuffer.result to result;
            flow from DecrementUpdateCounter.UpdatedSensorData to UpdatedSensorData;
        }

        action def AcpdCdd_StartInputCollector {
            out attribute success : Boolean;
            out item group0Data : AdcGroupDataType;
            out item group1Data : AdcGroupDataType;
            out item supplyData : AdcGroupDataType;
action SetupResultBufferGroup0 {
                out item group0Data : AdcGroupDataType;
            }
            action SetupResultBufferGroup1 {
                out item group1Data : AdcGroupDataType;
            }
            action SetupResultBufferSupply {
                out item supplyData : AdcGroupDataType;
            }
            action InitializeGroup0Data {
                in item group0Data : AdcGroupDataType;
                out item initializedGroup0Data : AdcGroupDataType;
            }
            action InitializeGroup1Data {
                in item group1Data : AdcGroupDataType;
                out item initializedGroup1Data : AdcGroupDataType;
            }
            action InitializeSupplyData {
                in item supplyData : AdcGroupDataType;
                out item initializedSupplyData : AdcGroupDataType;
            }
            action EnableGroup0Notification;
            action EnableGroup1Notification;
            action EnableSupplyNotification;
            action EnableGroup0HardwareTrigger;
            action EnableGroup1HardwareTrigger;
            action EnableSupplyHardwareTrigger;
            action ReturnSuccess {
                in item group0Data : AdcGroupDataType;
                in item group1Data : AdcGroupDataType;
                in item supplyData : AdcGroupDataType;
                out attribute success : Boolean;
                out item returnedGroup0Data : AdcGroupDataType;
                out item returnedGroup1Data : AdcGroupDataType;
                out item returnedSupplyData : AdcGroupDataType;
            }
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

            flow from SetupResultBufferGroup0.group0Data to InitializeGroup0Data.group0Data;
            flow from SetupResultBufferGroup1.group1Data to InitializeGroup1Data.group1Data;
            flow from SetupResultBufferSupply.supplyData to InitializeSupplyData.supplyData;
            flow from InitializeGroup0Data.initializedGroup0Data to ReturnSuccess.group0Data;
            flow from InitializeGroup1Data.initializedGroup1Data to ReturnSuccess.group1Data;
            flow from InitializeSupplyData.initializedSupplyData to ReturnSuccess.supplyData;
            flow from ReturnSuccess.returnedGroup0Data to group0Data;
            flow from ReturnSuccess.returnedGroup1Data to group1Data;
            flow from ReturnSuccess.returnedSupplyData to supplyData;
        }
        // trlc-satisfies: 25127428
        // trlc-satisfies: 25187813
        action def AcpdCdd_AdcGroup0NewData {

            in item adcGroup0Sample : AdcSensorDataEntryType;
            in item groupDataEntryPair : AdcGroupDataEntryPairType;
            out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;

            action GetGroup0SampleFromAdc {
                in item adcGroup0Sample : AdcSensorDataEntryType;
                out item group0Sample : AdcSensorDataEntryType;
            }

            action ValidateSampleCountPointerAndRange {
                in item group0Sample : AdcSensorDataEntryType;
                out item validationResult : AdcGroup0NewDataDecisionType;
            }

            action UseActualGroup0Sample {
                in item group0Sample : AdcSensorDataEntryType;
                out item normalizedGroup0Sample : AdcSensorDataEntryType;
            }

            action UseInvalidGroup0Sample {
                out item normalizedGroup0Sample : AdcSensorDataEntryType;
            }

            action CheckOldGroup0Cache {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cacheState : AdcGroup0NewDataDecisionType;
            }

            action PushOldGroup0WithInvalidGroup1IfNeeded {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item flushedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action CacheNewGroup0Sample {
                in item group0Sample : AdcSensorDataEntryType;
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cachedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action SetIsGroup0FilledTrue {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action CheckBothGroup0AndGroup1Filled {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item pairState : AdcGroup0NewDataDecisionType;
            }

            action WriteConsistentPairToRingBuffer {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item writtenGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action ResetCachePair {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item resetGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action KeepPartialPairCached {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cachedPartialGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action ReturnUpdatedGroupDataEntryPair {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            // Entry point and data preparation: obtain sample and validate whether the ADC sample can be used.
first GetGroup0SampleFromAdc then ValidateSampleCountPointerAndRange;
flow from adcGroup0Sample to GetGroup0SampleFromAdc.adcGroup0Sample;
            flow from GetGroup0SampleFromAdc.group0Sample to ValidateSampleCountPointerAndRange.group0Sample;

            // Decision: received Group0 sample is usable?
                first ValidateSampleCountPointerAndRange if Group0SampleCountPointerAndRange_isValid then UseActualGroup0Sample;
                first ValidateSampleCountPointerAndRange if not Group0SampleCountPointerAndRange_isValid then UseInvalidGroup0Sample;
flow from GetGroup0SampleFromAdc.group0Sample to UseActualGroup0Sample.group0Sample;

            // Merge: both branches produce the same normalized sample type for the following cache update.
            first UseActualGroup0Sample then CheckOldGroup0Cache;
            first UseInvalidGroup0Sample then CheckOldGroup0Cache;
            flow from groupDataEntryPair to CheckOldGroup0Cache.groupDataEntryPair;
            // Decision: a previous unpaired Group0 sample already exists?
                first CheckOldGroup0Cache if OldGroup0Cache_isFilled then PushOldGroup0WithInvalidGroup1IfNeeded;
                first CheckOldGroup0Cache if not OldGroup0Cache_isFilled then CacheNewGroup0Sample;
flow from groupDataEntryPair to PushOldGroup0WithInvalidGroup1IfNeeded.groupDataEntryPair;
            flow from groupDataEntryPair to CacheNewGroup0Sample.groupDataEntryPair;
            flow from UseActualGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;
            flow from UseInvalidGroup0Sample.normalizedGroup0Sample to CacheNewGroup0Sample.group0Sample;

            // Merge after optional flush: in both cases the new Group0 sample is cached.
            first PushOldGroup0WithInvalidGroup1IfNeeded then CacheNewGroup0Sample;
            flow from PushOldGroup0WithInvalidGroup1IfNeeded.flushedGroupDataEntryPair to CacheNewGroup0Sample.groupDataEntryPair;

            first CacheNewGroup0Sample then SetIsGroup0FilledTrue;
            flow from CacheNewGroup0Sample.cachedGroupDataEntryPair to SetIsGroup0FilledTrue.groupDataEntryPair;

            first SetIsGroup0FilledTrue then CheckBothGroup0AndGroup1Filled;
            flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to CheckBothGroup0AndGroup1Filled.groupDataEntryPair;

            // Decision: Group0 and Group1 now form a complete pair?
                first CheckBothGroup0AndGroup1Filled if Group0AndGroup1Cache_areBothFilled then WriteConsistentPairToRingBuffer;
                first CheckBothGroup0AndGroup1Filled if not Group0AndGroup1Cache_areBothFilled then KeepPartialPairCached;
flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to WriteConsistentPairToRingBuffer.groupDataEntryPair;
            flow from SetIsGroup0FilledTrue.updatedGroupDataEntryPair to KeepPartialPairCached.groupDataEntryPair;

            first WriteConsistentPairToRingBuffer then ResetCachePair;
            flow from WriteConsistentPairToRingBuffer.writtenGroupDataEntryPair to ResetCachePair.groupDataEntryPair;

            // Final merge: both complete-pair and partial-pair paths return the updated cache state.
            first ResetCachePair then ReturnUpdatedGroupDataEntryPair;
            first KeepPartialPairCached then ReturnUpdatedGroupDataEntryPair;
            flow from ResetCachePair.resetGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;
            flow from KeepPartialPairCached.cachedPartialGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;
            flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;
        }

        action def AcpdCdd_AdcGroup1NewData {

            in item adcGroup1Sample : AdcSensorDataEntryType;
            in item groupDataEntryPair : AdcGroupDataEntryPairType;
            out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;

            action ValidateGroup1SampleCountPointerAndRange {
                in item group1Sample : AdcSensorDataEntryType;
                out item validationResult : AdcGroup1NewDataDecisionType;
            }

            action UseActualGroup1Sample {
                in item group1Sample : AdcSensorDataEntryType;
                out item normalizedGroup1Sample : AdcSensorDataEntryType;
            }

            action UseInvalidGroup1Sample {
                out item normalizedGroup1Sample : AdcSensorDataEntryType;
            }

            action CheckOldGroup1Cache {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cacheState : AdcGroup1NewDataDecisionType;
            }

            action PushOldGroup1WithInvalidGroup0IfNeeded {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item flushedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action CacheNewGroup1Sample {
                in item group1Sample : AdcSensorDataEntryType;
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cachedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action SetIsGroup1FilledTrue {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action CheckBothGroup0AndGroup1Filled {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item pairState : AdcGroup1NewDataDecisionType;
            }

            action WriteConsistentPairToRingBuffer {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item writtenGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action ResetCachePair {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item resetGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action KeepPartialPairCached {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item cachedPartialGroupDataEntryPair : AdcGroupDataEntryPairType;
            }

            action ReturnUpdatedGroupDataEntryPair {
                in item groupDataEntryPair : AdcGroupDataEntryPairType;
                out item updatedGroupDataEntryPair : AdcGroupDataEntryPairType;
            }
flow from adcGroup1Sample to ValidateGroup1SampleCountPointerAndRange.group1Sample;
                first ValidateGroup1SampleCountPointerAndRange if Group1SampleCountPointerAndRange_isValid then UseActualGroup1Sample;
                first ValidateGroup1SampleCountPointerAndRange if not Group1SampleCountPointerAndRange_isValid then UseInvalidGroup1Sample;
flow from adcGroup1Sample to UseActualGroup1Sample.group1Sample;
            first UseActualGroup1Sample then CheckOldGroup1Cache;
            first UseInvalidGroup1Sample then CheckOldGroup1Cache;
            flow from groupDataEntryPair to CheckOldGroup1Cache.groupDataEntryPair;
                first CheckOldGroup1Cache if OldGroup1Cache_isFilled then PushOldGroup1WithInvalidGroup0IfNeeded;
                first CheckOldGroup1Cache if not OldGroup1Cache_isFilled then CacheNewGroup1Sample;
flow from groupDataEntryPair to PushOldGroup1WithInvalidGroup0IfNeeded.groupDataEntryPair;
            flow from groupDataEntryPair to CacheNewGroup1Sample.groupDataEntryPair;
            flow from UseActualGroup1Sample.normalizedGroup1Sample to CacheNewGroup1Sample.group1Sample;
            flow from UseInvalidGroup1Sample.normalizedGroup1Sample to CacheNewGroup1Sample.group1Sample;

            first PushOldGroup1WithInvalidGroup0IfNeeded then CacheNewGroup1Sample;
            flow from PushOldGroup1WithInvalidGroup0IfNeeded.flushedGroupDataEntryPair to CacheNewGroup1Sample.groupDataEntryPair;

            first CacheNewGroup1Sample then SetIsGroup1FilledTrue;
            flow from CacheNewGroup1Sample.cachedGroupDataEntryPair to SetIsGroup1FilledTrue.groupDataEntryPair;

            first SetIsGroup1FilledTrue then CheckBothGroup0AndGroup1Filled;
            flow from SetIsGroup1FilledTrue.updatedGroupDataEntryPair to CheckBothGroup0AndGroup1Filled.groupDataEntryPair;

                first CheckBothGroup0AndGroup1Filled if Group0AndGroup1Cache_areBothFilled then WriteConsistentPairToRingBuffer;
                first CheckBothGroup0AndGroup1Filled if not Group0AndGroup1Cache_areBothFilled then KeepPartialPairCached;
flow from SetIsGroup1FilledTrue.updatedGroupDataEntryPair to WriteConsistentPairToRingBuffer.groupDataEntryPair;
            flow from SetIsGroup1FilledTrue.updatedGroupDataEntryPair to KeepPartialPairCached.groupDataEntryPair;

            first WriteConsistentPairToRingBuffer then ResetCachePair;
            flow from WriteConsistentPairToRingBuffer.writtenGroupDataEntryPair to ResetCachePair.groupDataEntryPair;

            first ResetCachePair then ReturnUpdatedGroupDataEntryPair;
            first KeepPartialPairCached then ReturnUpdatedGroupDataEntryPair;
            flow from ResetCachePair.resetGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;
            flow from KeepPartialPairCached.cachedPartialGroupDataEntryPair to ReturnUpdatedGroupDataEntryPair.groupDataEntryPair;
            flow from ReturnUpdatedGroupDataEntryPair.updatedGroupDataEntryPair to updatedGroupDataEntryPair;
        }

        // trlc-satisfies: 25127531
        action def AcpdCdd_AdcSupplyNewData {

            in item adcSupplySample : AdcSensorDataEntryType;
            in item supplyData : AdcGroupDataType;
            out item updatedSupplyData : AdcGroupDataType;

            action ValidateSupplySample {
                in item supplySample : AdcSensorDataEntryType;
                out item validationResult : AdcSupplyNewDataDecisionType;
            }

            action UseActualSupplySample {
                in item supplySample : AdcSensorDataEntryType;
                out item normalizedSupplySample : AdcSensorDataEntryType;
            }

            action UseInvalidSupplySample {
                out item normalizedSupplySample : AdcSensorDataEntryType;
            }

            action WriteSupplySampleToRingBuffer {
                in item supplyData : AdcGroupDataType;
                in item supplySample : AdcSensorDataEntryType;
                out item updatedSupplyData : AdcGroupDataType;
            }

            action ReturnUpdatedSupplyData {
                in item supplyData : AdcGroupDataType;
                out item updatedSupplyData : AdcGroupDataType;
            }
flow from adcSupplySample to ValidateSupplySample.supplySample;
                first ValidateSupplySample if SupplySample_isValid then UseActualSupplySample;
                first ValidateSupplySample if not SupplySample_isValid then UseInvalidSupplySample;
flow from adcSupplySample to UseActualSupplySample.supplySample;
            first UseActualSupplySample then WriteSupplySampleToRingBuffer;
            first UseInvalidSupplySample then WriteSupplySampleToRingBuffer;
            flow from supplyData to WriteSupplySampleToRingBuffer.supplyData;
            flow from UseActualSupplySample.normalizedSupplySample to WriteSupplySampleToRingBuffer.supplySample;
            flow from UseInvalidSupplySample.normalizedSupplySample to WriteSupplySampleToRingBuffer.supplySample;

            first WriteSupplySampleToRingBuffer then ReturnUpdatedSupplyData;
            flow from WriteSupplySampleToRingBuffer.updatedSupplyData to ReturnUpdatedSupplyData.supplyData;
            flow from ReturnUpdatedSupplyData.updatedSupplyData to updatedSupplyData;
        }
        // trlc-satisfies: 25130711
        // trlc-satisfies: 28710933
        action def AcpdCdd_CollectInputData {
            in item group0Data : AdcGroupDataType;
            in item group1Data : AdcGroupDataType;
            in item supplyData : AdcGroupDataType;
            out item InputData : InputDataType;
            out item updatedGroup0Data : AdcGroupDataType;
            out item updatedGroup1Data : AdcGroupDataType;
            out item updatedSupplyData : AdcGroupDataType;
            action EnterSensorGroupDataHandlingExclusiveArea;
            action GetGroup0Data {
                in item group0Data : AdcGroupDataType;
                out item group0Buffer : AdcSensorDataBufferType;
                out item updatedGroup0Data : AdcGroupDataType;
            }
            action GetGroup1Data {
                in item group1Data : AdcGroupDataType;
                out item group1Buffer : AdcSensorDataBufferType;
                out item updatedGroup1Data : AdcGroupDataType;
            }
            action ExitSensorGroupDataHandlingExclusiveArea;
            action EnterSupplyDataHandlingExclusiveArea;
            action GetSupplyData {
                in item supplyData : AdcGroupDataType;
                out item supplyBuffer : AdcSensorDataBufferType;
                out item updatedSupplyData : AdcGroupDataType;
            }
            action ExitSupplyDataHandlingExclusiveArea;
            action MapGroup0Group1SupplyToSensor0Data {
                in item group0Buffer : AdcSensorDataBufferType;
                in item group1Buffer : AdcSensorDataBufferType;
                in item supplyBuffer : AdcSensorDataBufferType;
                out item sensor0InputData : InputDataType;
            }
            action MapGroup0Group1SupplyToSensor1Data {
                in item partialInputData : InputDataType;
                out item sensor1InputData : InputDataType;
            }
            action MapTimestamps {
                in item partialInputData : InputDataType;
                out item timestampedInputData : InputDataType;
            }
            action ValidateCollectedInputData {
                in item inputData : InputDataType;
                out item validationResult : CollectInputDataDecisionType;
                out item checkedInputData : InputDataType;
            }
            action ReturnValidInputData {
                in item inputData : InputDataType;
                out item InputData : InputDataType;
            }
            action ReturnDegradedInputData {
                in item inputData : InputDataType;
                out item InputData : InputDataType;
            }
            action ReturnInputData {
                in item inputData : InputDataType;
                out item InputData : InputDataType;
            }
first EnterSensorGroupDataHandlingExclusiveArea then GetGroup0Data;
            first GetGroup0Data then GetGroup1Data;
            first GetGroup1Data then ExitSensorGroupDataHandlingExclusiveArea;
            first ExitSensorGroupDataHandlingExclusiveArea then EnterSupplyDataHandlingExclusiveArea;
            first EnterSupplyDataHandlingExclusiveArea then GetSupplyData;
            first GetSupplyData then ExitSupplyDataHandlingExclusiveArea;
            first ExitSupplyDataHandlingExclusiveArea then MapGroup0Group1SupplyToSensor0Data;
            first MapGroup0Group1SupplyToSensor0Data then MapGroup0Group1SupplyToSensor1Data;
            first MapGroup0Group1SupplyToSensor1Data then MapTimestamps;
            first MapTimestamps then ValidateCollectedInputData;

                first ValidateCollectedInputData if CollectedInputData_isValid then ReturnValidInputData;
                first ValidateCollectedInputData if not CollectedInputData_isValid then ReturnDegradedInputData;
first ReturnValidInputData then ReturnInputData;
            first ReturnDegradedInputData then ReturnInputData;
flow from group0Data to GetGroup0Data.group0Data;
            flow from group1Data to GetGroup1Data.group1Data;
            flow from supplyData to GetSupplyData.supplyData;
            flow from GetGroup0Data.group0Buffer to MapGroup0Group1SupplyToSensor0Data.group0Buffer;
            flow from GetGroup1Data.group1Buffer to MapGroup0Group1SupplyToSensor0Data.group1Buffer;
            flow from GetSupplyData.supplyBuffer to MapGroup0Group1SupplyToSensor0Data.supplyBuffer;
            flow from MapGroup0Group1SupplyToSensor0Data.sensor0InputData to MapGroup0Group1SupplyToSensor1Data.partialInputData;
            flow from MapGroup0Group1SupplyToSensor1Data.sensor1InputData to MapTimestamps.partialInputData;
            flow from MapTimestamps.timestampedInputData to ValidateCollectedInputData.inputData;
            flow from ValidateCollectedInputData.checkedInputData to ReturnValidInputData.inputData;
            flow from ValidateCollectedInputData.checkedInputData to ReturnDegradedInputData.inputData;
            flow from ReturnValidInputData.InputData to ReturnInputData.inputData;
            flow from ReturnDegradedInputData.InputData to ReturnInputData.inputData;
            flow from ReturnInputData.InputData to InputData;
            flow from GetGroup0Data.updatedGroup0Data to updatedGroup0Data;
            flow from GetGroup1Data.updatedGroup1Data to updatedGroup1Data;
            flow from GetSupplyData.updatedSupplyData to updatedSupplyData;
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


        // Main 10 ms Input behavior modeled with explicit guarded successions.
        // This follows the official SysML v2 conditional succession pattern:
        // first <sourceAction> if <Boolean expression> then <targetAction>;
        // Visualizers can render those guarded successions as dotted conditional arrows.
        action def AcpdCdd_Input_Main10ms_GuardedBranching {

            in item adcNotification : AdcNotificationPayloadType;
            out item inputData : InputDataType;
action receiveAdcNotification {
                out item notification : AdcNotificationPayloadType;
            }

            action decodeAdcGroups {
                in item notification : AdcNotificationPayloadType;
                out item decodedInputData : InputDataType;
            }

            action incrementMissingNotificationCounter;
            action keepPreviousInputBuffer {
                out item fallbackInputData : InputDataType;
            }
            action setMissingNotificationQualifier {
                in item fallbackInputData : InputDataType;
                out item qualifiedFallbackInputData : InputDataType;
            }

            action validateTimestamp {
                in item decodedInputData : InputDataType;
                out item timestampCheckedInputData : InputDataType;
            }
            action markNotificationStale {
                in item decodedInputData : InputDataType;
                out item staleInputData : InputDataType;
            }

            action validateGroup0Sample {
                in item inputData : InputDataType;
                out item group0CheckedInputData : InputDataType;
            }
            action validateGroup1Sample {
                in item inputData : InputDataType;
                out item group1CheckedInputData : InputDataType;
            }
            action validateSupplySample {
                in item inputData : InputDataType;
                out item supplyCheckedInputData : InputDataType;
            }

            action setGroup0InvalidQualifier;
            action setGroup1InvalidQualifier;
            action setSupplyInvalidQualifier;

            action validateSensorPairPlausibility {
                in item inputData : InputDataType;
                out item plausibilityCheckedInputData : InputDataType;
            }
            action setSensorPairImplausibleQualifier;

            action composeValidInputData {
                out item composedInputData : InputDataType;
            }
            action composeFallbackInputData {
                out item composedInputData : InputDataType;
            }
            action publishInputData {
                in item inputData : InputDataType;
            }

            // Decision: notification available?
                first receiveAdcNotification if AdcNotification_hasArrived then decodeAdcGroups;
                first receiveAdcNotification if not AdcNotification_hasArrived then incrementMissingNotificationCounter;
first incrementMissingNotificationCounter then keepPreviousInputBuffer;
            first keepPreviousInputBuffer then setMissingNotificationQualifier;

            flow from receiveAdcNotification.notification to decodeAdcGroups.notification;
            flow from keepPreviousInputBuffer.fallbackInputData to setMissingNotificationQualifier.fallbackInputData;

            // Decision: timestamp fresh?
                first decodeAdcGroups if DecodedAdcTimestamp_isFresh then validateTimestamp;
                first decodeAdcGroups if not DecodedAdcTimestamp_isFresh then markNotificationStale;
flow from decodeAdcGroups.decodedInputData to validateTimestamp.decodedInputData;
            flow from decodeAdcGroups.decodedInputData to markNotificationStale.decodedInputData;

            // Fork-style independent validation fan-out.
            first validateTimestamp then validateGroup0Sample;
            first validateTimestamp then validateGroup1Sample;
            first validateTimestamp then validateSupplySample;

            flow from validateTimestamp.timestampCheckedInputData to validateGroup0Sample.inputData;
            flow from validateTimestamp.timestampCheckedInputData to validateGroup1Sample.inputData;
            flow from validateTimestamp.timestampCheckedInputData to validateSupplySample.inputData;

            // Decisions after independent checks.
                first validateGroup0Sample if Group0Sample_isInvalid then setGroup0InvalidQualifier;
                first validateGroup1Sample if Group1Sample_isInvalid then setGroup1InvalidQualifier;
first validateSupplySample if SupplySample_isInvalid then setSupplyInvalidQualifier;
// Join-style convergence before plausibility check.
            first validateGroup0Sample then validateSensorPairPlausibility;
            first validateGroup1Sample then validateSensorPairPlausibility;
            first validateSupplySample then validateSensorPairPlausibility;

                first validateSensorPairPlausibility if SensorPair_isPlausible then composeValidInputData;
                first validateSensorPairPlausibility if not SensorPair_isPlausible then setSensorPairImplausibleQualifier;

            first setSensorPairImplausibleQualifier then composeFallbackInputData;
            first markNotificationStale then composeFallbackInputData;
            first setMissingNotificationQualifier then composeFallbackInputData;

            first composeValidInputData then publishInputData;
            first composeFallbackInputData then publishInputData;

            flow from composeValidInputData.composedInputData to publishInputData.inputData;
            flow from composeFallbackInputData.composedInputData to publishInputData.inputData;
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
            action adcGroup0NewData : AcpdCdd_AdcGroup0NewData;
            action adcGroup1NewData;
            action adcSupplyNewData;
            action collectInputData;
            action inputBehavior;
            action inputMain10msGuardedBranching : AcpdCdd_Input_Main10ms_GuardedBranching;
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
}

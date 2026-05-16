export const BRK_SAMPLE = `package AcpdCdd_SysMLv2 {

    package Types {

        private import ScalarValues::*;

        attribute def float32 :> Real;
        attribute def uint8 :> Integer;
        attribute def uint16 :> Integer;
        attribute def sint16 :> Integer;
        attribute def boolean :> Boolean;
        attribute def microseconds :> Integer;

        attribute def volt_float32_0_16 :> float32;

        enum def AcpdCdd_ActivationDataType {
            enum ACTIVATE;
            enum DEACTIVATE;
        }

        enum def PowerStateType {
            enum POWER_OFF;
            enum POWER_ON;
            enum ACPD_POWER_OFF;
            enum ACPD_POWER_ON;
        }

        enum def PowerTransitionType {
            enum POWER_SWITCH_NONE;
            enum POWER_SWITCH_TO_ON;
            enum POWER_SWITCH_TO_OFF;
            enum ACPD_POWER_SWITCH_NONE;
            enum ACPD_POWER_SWITCH_TO_ON;
            enum ACPD_POWER_SWITCH_TO_OFF;
        }

        enum def DioStatusType {
            enum DIO_OFF;
            enum DIO_ON;
        }

        // trlc-satisfies: 25187609
        enum def ValueQualifierType {
            enum ValueQualifier_QUAL_VAL_OK;
            enum ValueQualifier_QUAL_VAL_DEGRADED;
            enum ValueQualifier_QUAL_VAL_ERROR;
            enum ValueQualifier_QUAL_VAL_NOT_AVAILABLE;
            enum ValueQualifier_QUAL_VAL_INIT;
        }

        item def PowerStatusType {
            attribute CurrentPowerState : PowerStateType;
            attribute CurrentPowerTransition : PowerTransitionType;
        }

        item def AcpdCddCheckErrorCountersType {
            attribute Group0ErrorCount : uint16;
            attribute Group1ErrorCount : uint16;
            attribute SupplyErrorCount : uint16;
        }

        item def AdcSensorDataEntryType {
            attribute SensorValue0 : uint16;
            attribute SensorValue1 : uint16;
            attribute SupplyValue : uint16;
        }

        item def AdcTimestampEntryType {
            attribute AdcGroup0Time : uint16;
            attribute AdcGroup1Time : uint16;
            attribute AdcSupplyTime : uint16;
        }

        item def AdcSensorDataBufferType {
            item Data : AdcSensorDataEntryType;
        }

        item def AdcTimestampBufferType {
            item Data : AdcTimestampEntryType;
        }

        item def AdcGroupDataType {
            item Data : AdcSensorDataBufferType;
            attribute WriteIndex : uint16;
            attribute UpdateCounter : uint16;
        }

        item def AdcGroupDataBufferType {
            item Data : AdcSensorDataBufferType;
        }

        item def AdcGroupDataEntryPairType {
            item group0 : AdcSensorDataEntryType;
            item group1 : AdcSensorDataEntryType;
            attribute isGroup0Filled : boolean;
            attribute isGroup1Filled : boolean;
        }

        item def InputDataType {
            item Sensor0Data : AdcSensorDataBufferType;
            item Sensor1Data : AdcSensorDataBufferType;
            item Timestamps : AdcTimestampBufferType;
        }

        item def ChannelMeansType {
            attribute Sensor0Voltage0 : volt_float32_0_16;
            attribute Sensor0Voltage1 : volt_float32_0_16;
            attribute Sensor1Voltage0 : volt_float32_0_16;
            attribute Sensor1Voltage1 : volt_float32_0_16;
            attribute Sensor0Supply : volt_float32_0_16;
            attribute Sensor1Supply : volt_float32_0_16;
        }

        // trlc-satisfies: 25094059
        item def tAcpdCdd_rc_SnsAccrSnsr {
            attribute AcpdCdd_u_AccrSnsr : float32;
            attribute AcpdCdd_u_AccrSnsr_vq : uint8;
        }

        item def tAcpdCdd_rc_AccrSnsr {
            item AcpdCdd_Snsr1_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Snsr2_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Vcc1_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Vcc2_rc : tAcpdCdd_rc_SnsAccrSnsr;
        }

        item def AcpdCddDataType {
            item AcpdCdd_Snsr1_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Snsr2_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Vcc1_rc : tAcpdCdd_rc_SnsAccrSnsr;
            item AcpdCdd_Vcc2_rc : tAcpdCdd_rc_SnsAccrSnsr;
        }

        attribute ADC_UPDATE_CYCLE_COUNT : uint16;
        attribute ADC_MAX_VAL : uint16;
        attribute ADC_GROUP_CONVERSION_FWG : float32;
        attribute ADC_GROUP_CONVERSION_SUPPLY : float32;
        attribute INVALID_VOLTAGE : float32;
        attribute INVALID_INPUT_VOLTAGE : uint16;
        attribute THRESHOLD_MISSING_DATA_CHECK_CNT : uint16;
        attribute THRESHOLD_TIMESTAMP_ERROR_CHECK_CNT : uint16;
        // trlc-satisfies: 28710924
        attribute TIME_TOLERANCE_CHECK_LOW : microseconds;
        attribute TIME_TOLERANCE_CHECK_HIGH : microseconds;
        attribute CROSSCHECK_BOUND : microseconds;
        // trlc-satisfies: 28883887
        // trlc-satisfies: 28883920
        attribute SUPPLY_VOLTAGE_BOUND_HIGH : float32;
        attribute SUPPLY_VOLTAGE_BOUND_LOW : float32;
        // trlc-satisfies: 25128928
        attribute MINIMUM_VOLTAGE_DIFFERENCE : float32;
        attribute SETUP_RESULT_BUFFER_MAX_ATTEMPTS : uint8;

        // Shared runtime interface payload semantics.
        // These item definitions make interaction contracts type-aware instead of name-only.

        item def NoPayloadType;

        item def AdcNotificationPayloadType {
            attribute Group0NotificationArrived : boolean;
            attribute Group1NotificationArrived : boolean;
            attribute SupplyNotificationArrived : boolean;
            item Timestamps : AdcTimestampBufferType;
        }

        item def ActivationRequestPayloadType {
            attribute RequestedActivationState : AcpdCdd_ActivationDataType;
        }

        item def ActivationStatusPayloadType {
            attribute ActivationState : AcpdCdd_ActivationDataType;
        }

        item def ProcessedSensorOutputPayloadType {
            item OutputData : tAcpdCdd_rc_AccrSnsr;
        }

        item def MonitoringStatusPayloadType {
            item ErrorCounters : AcpdCddCheckErrorCountersType;
        }

        item def DioCommandPayloadType {
            attribute RequestedPowerState : DioStatusType;
        }

        item def AdcBistStatusPayloadType {
            attribute ReferenceVoltageErrorDetected : boolean;
        }
    }
}

package AcpdCdd_SysMLv2 {

    package ExternalActors {

        private import AcpdCdd_SysMLv2::Types::*;

        port def AdcNotificationOutPort {
            out item adcSample : AdcNotificationPayloadType;
        }

        port def VARefErrorStatusOutPort {
            out attribute errorPresent;
        }

        port def ActivationOutPort {
            out attribute activation;
        }

        port def RteAcceleratorDataInPort {
            in item acceleratorData : tAcpdCdd_rc_AccrSnsr;
        }

        part def ADC {
            port group0Notification;
            port group1Notification;
            port supplyNotification;
        }

        part def AdcBist {
            port varef1ErrorStatusOut;
            port varef2ErrorStatusOut;
        }

        part def RTE {
            port activationOut;
            port acceleratorDataIn;
        }
    }
}

package AcpdCdd_SysMLv2 {
    package Input {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

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
}

package AcpdCdd_SysMLv2 {
    package Process {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

        port def InputDataInPort {
            in item InputData : InputDataType;
        }

        port def ChannelMeansOutPort {
            out item ProcessedData : ChannelMeansType;
        }

        action def AcpdCdd_StartProcessing {
            action InitializeProcessWithDefault;
            action SetProcessingReady;
            first InitializeProcessWithDefault then SetProcessingReady;
        }

        // trlc-satisfies: 44880031
        action def AcpdCdd_Process {
            in item InputData : InputDataType;
            out item ProcessedData : ChannelMeansType;

            action CheckInputDataPointer;
            action FetchSensor0MissionBuffer;
            action FetchSensor0MonitoringBuffer;
            action FetchSensor0SupplyBuffer;
            action FetchSensor1MissionBuffer;
            action FetchSensor1MonitoringBuffer;
            action FetchSensor1SupplyBuffer;
            // trlc-satisfies: 25094087
            // trlc-satisfies: 28820111
            // trlc-satisfies: 28820750
            action ConvertSensor0MissionSamples;
            action ConvertSensor0MonitoringSamples;
            action ConvertSensor0SupplySamples;
            action ConvertSensor1MissionSamples;
            action ConvertSensor1MonitoringSamples;
            action ConvertSensor1SupplySamples;
            action SumSensor0MissionValues;
            action SumSensor0MonitoringValues;
            action SumSensor0SupplyValues;
            action SumSensor1MissionValues;
            action SumSensor1MonitoringValues;
            action SumSensor1SupplyValues;
            // trlc-satisfies: 28824427
            action ComputeSensor0MissionMean;
            action ComputeSensor0MonitoringMean;
            action ComputeSensor0SupplyMean;
            action ComputeSensor1MissionMean;
            action ComputeSensor1MonitoringMean;
            action ComputeSensor1SupplyMean;
            action PopulateChannelMeansType;
            action ReturnProcessedData;

            first CheckInputDataPointer then FetchSensor0MissionBuffer;
            first FetchSensor0MissionBuffer then FetchSensor0MonitoringBuffer;
            first FetchSensor0MonitoringBuffer then FetchSensor0SupplyBuffer;
            first FetchSensor0SupplyBuffer then FetchSensor1MissionBuffer;
            first FetchSensor1MissionBuffer then FetchSensor1MonitoringBuffer;
            first FetchSensor1MonitoringBuffer then FetchSensor1SupplyBuffer;
            first FetchSensor1SupplyBuffer then ConvertSensor0MissionSamples;
            first ConvertSensor0MissionSamples then ConvertSensor0MonitoringSamples;
            first ConvertSensor0MonitoringSamples then ConvertSensor0SupplySamples;
            first ConvertSensor0SupplySamples then ConvertSensor1MissionSamples;
            first ConvertSensor1MissionSamples then ConvertSensor1MonitoringSamples;
            first ConvertSensor1MonitoringSamples then ConvertSensor1SupplySamples;
            first ConvertSensor1SupplySamples then SumSensor0MissionValues;
            first SumSensor0MissionValues then SumSensor0MonitoringValues;
            first SumSensor0MonitoringValues then SumSensor0SupplyValues;
            first SumSensor0SupplyValues then SumSensor1MissionValues;
            first SumSensor1MissionValues then SumSensor1MonitoringValues;
            first SumSensor1MonitoringValues then SumSensor1SupplyValues;
            first SumSensor1SupplyValues then ComputeSensor0MissionMean;
            first ComputeSensor0MissionMean then ComputeSensor0MonitoringMean;
            first ComputeSensor0MonitoringMean then ComputeSensor0SupplyMean;
            first ComputeSensor0SupplyMean then ComputeSensor1MissionMean;
            first ComputeSensor1MissionMean then ComputeSensor1MonitoringMean;
            first ComputeSensor1MonitoringMean then ComputeSensor1SupplyMean;
            first ComputeSensor1SupplyMean then PopulateChannelMeansType;
            first PopulateChannelMeansType then ReturnProcessedData;
        }

        action def AcpdCdd_Process_Behavior {
            action AcpdCdd_StartProcessing;
            action AcpdCdd_Process;

            first AcpdCdd_StartProcessing then AcpdCdd_Process;
        }

        part def AcpdCdd_Process {
            port inputDataIn : InputDataInPort;
            port processedDataOut : ChannelMeansOutPort;

            action startProcessing;
            action process;
            action processBehavior;
        }

        action def AcpdCdd_Process_Sequence_AsActionFlow {

            action ProcessReceivesInputData;
            action ProcessCalculatesAcceleratorPosition;
            action ProcessGeneratesProcessedData;
            action ProcessPublishesProcessedData;

            first ProcessReceivesInputData then ProcessCalculatesAcceleratorPosition;
            first ProcessCalculatesAcceleratorPosition then ProcessGeneratesProcessedData;
            first ProcessGeneratesProcessedData then ProcessPublishesProcessedData;
        }


    }
}

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
            action SetDioChannelCto5vapp1Low;
            action SetDioChannelCto5vapp2Low;
            action Return;

            first SetDioChannelCto5vapp1Low then SetDioChannelCto5vapp2Low;
            first SetDioChannelCto5vapp2Low then Return;
        }

        action def AcpdCdd_SetPowerDio {
            in attribute Status;

            action WriteDioChannelCto5vapp1;
            action WriteDioChannelCto5vapp2;
            action OptionalReadbackVerification;
            action Return;

            first WriteDioChannelCto5vapp1 then WriteDioChannelCto5vapp2;
            first WriteDioChannelCto5vapp2 then OptionalReadbackVerification;
            first OptionalReadbackVerification then Return;
        }

        action def AcpdCdd_PowermanagementInit {

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

            action ReadActivationSignalFromRte;
            action CompareActivationWithActivate;
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

            action ComputeInitialOffset;
            action ComputeCurrentOffset;
            action ComputeOffsetDifference;
            action CompareWithCrosscheckBound;
            action ReturnTrueIfInRange;
            action ReturnFalseIfOutOfRange;

            first ComputeInitialOffset then ComputeCurrentOffset;
            first ComputeCurrentOffset then ComputeOffsetDifference;
            first ComputeOffsetDifference then CompareWithCrosscheckBound;
            first CompareWithCrosscheckBound then ReturnTrueIfInRange;
            first CompareWithCrosscheckBound then ReturnFalseIfOutOfRange;
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

            action CheckPowerStateOff;
            action CheckPowerStateOn;
            action CheckSwitchToOn;
            action SetAllQualifiersInit;
            action CheckSwitchToOff;
            action SetAllQualifiersNotAvailable;
            action ApplyStableOnChecks;

            first CheckPowerStateOff then CheckSwitchToOn;
            first CheckSwitchToOn then SetAllQualifiersInit;
            first CheckPowerStateOff then CheckSwitchToOff;
            first CheckSwitchToOff then SetAllQualifiersNotAvailable;
            first CheckPowerStateOn then CheckSwitchToOn;
            first CheckPowerStateOn then CheckSwitchToOff;
            first CheckPowerStateOn then ApplyStableOnChecks;
        }

        // trlc-satisfies: 30477411
        // trlc-satisfies: 30477478
        action def ADC_Error_Callbacks {

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

package AcpdCdd_SysMLv2 {
    package Output {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;

        port def AcceleratorDataInPort {
            in item acceleratorData : tAcpdCdd_rc_AccrSnsr;
        }

        port def RteDataOutPort {
            out item RteData : tAcpdCdd_rc_AccrSnsr;
        }

        // trlc-satisfies: 25094008
        // trlc-satisfies: 44879821
        // trlc-satisfies: 25131815
        // trlc-satisfies: 25131787
        action def AcpdCdd_UpdateOutput {
            in item acceleratorData : tAcpdCdd_rc_AccrSnsr;
            out item RteData : tAcpdCdd_rc_AccrSnsr;

            action CheckAcceleratorDataPointer;
            action UseDefaultErrorValuesIfNull;
            // trlc-satisfies: 25094059
            action ConvertAcpdCddDataTypeToRteType;
            action CopySensor1Data;
            action CopySensor2Data;
            action CopySupply1Data;
            action CopySupply2Data;
            action Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc;
            action Return;

            first CheckAcceleratorDataPointer then UseDefaultErrorValuesIfNull;
            first UseDefaultErrorValuesIfNull then ConvertAcpdCddDataTypeToRteType;
            first ConvertAcpdCddDataTypeToRteType then CopySensor1Data;
            first CopySensor1Data then CopySensor2Data;
            first CopySensor2Data then CopySupply1Data;
            first CopySupply1Data then CopySupply2Data;
            first CopySupply2Data then Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc;
            first Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc then Return;
        }
        action def AcpdCdd_Output_Behavior {

            action ReceiveAcceleratorData;
            action AcpdCdd_UpdateOutput;
            action WriteRteOutput;

            first ReceiveAcceleratorData then AcpdCdd_UpdateOutput;
            first AcpdCdd_UpdateOutput then WriteRteOutput;
        }

        part def AcpdCdd_Output {
            port acceleratorDataIn : AcceleratorDataInPort;
            port rteDataOut : RteDataOutPort;

            action updateOutput;
            action outputBehavior;
        }

        action def AcpdCdd_Output_Sequence_AsActionFlow {

            action OutputReceivesAcceleratorData;
            action OutputReceivesMonitoringStatus;

            action OutputPreparesRteData;
            action OutputRequestsRteTransmission;
            action RtePublishesOutputData;

            first OutputReceivesAcceleratorData
            then OutputReceivesMonitoringStatus;

            first OutputReceivesMonitoringStatus
            then OutputPreparesRteData;

            first OutputPreparesRteData
            then OutputRequestsRteTransmission;

            first OutputRequestsRteTransmission
            then RtePublishesOutputData;
        }


    }
}

package AcpdCdd_SysMLv2 {

    package ComponentDesign {

        private import AcpdCdd_SysMLv2::Input::*;
        private import AcpdCdd_SysMLv2::Process::*;
        private import AcpdCdd_SysMLv2::Powermanagement::*;
        private import AcpdCdd_SysMLv2::Monitoring::*;
        private import AcpdCdd_SysMLv2::Output::*;
        // trlc-satisfies: 25093540
        // trlc-satisfies: 25090543
        // trlc-satisfies: 28712675
        part def AcpdCdd {
            part input : AcpdCdd_Input;
            part process : AcpdCdd_Process;
            part powermanagement : AcpdCdd_Powermanagement;
            part monitoring : AcpdCdd_Monitoring;
            part output : AcpdCdd_Output;
        }

        part acpdCdd : AcpdCdd;
    }
}

package AcpdCdd_SysMLv2 {

    package Behavior_Main10ms {

        private import ScalarValues::*;
        // trlc-satisfies: 28596119
        action def AcpdCdd_Main10ms {

            action AcpdCdd_Activation;
            action AcpdCdd_CollectInputData;
            action AcpdCdd_Process;
            action AcpdCdd_PowermanagementCalcStatus;
            action AdcBist_GetVaref1ErrorStatus;
            action AdcBist_GetVaref2ErrorStatus;
            action AcpdCdd_Monitoring;
            action AcpdCdd_Output;

            first AcpdCdd_Activation then AcpdCdd_CollectInputData;
            first AcpdCdd_CollectInputData then AcpdCdd_Process;
            first AcpdCdd_Process then AcpdCdd_PowermanagementCalcStatus;
            first AcpdCdd_PowermanagementCalcStatus then AdcBist_GetVaref1ErrorStatus;
            first AdcBist_GetVaref1ErrorStatus then AdcBist_GetVaref2ErrorStatus;
            first AdcBist_GetVaref2ErrorStatus then AcpdCdd_Monitoring;
            first AcpdCdd_Monitoring then AcpdCdd_Output;
        }

        action def AcpdCdd_Runtime_Sequence_AsActionFlow {

            action RuntimeActivatesAcpdCdd;
            action RuntimeExecutesInputCycle;
            action RuntimeExecutesProcessingCycle;
            action RuntimeExecutesPowermanagementCycle;
            action RuntimeExecutesMonitoringCycle;
            action RuntimeExecutesOutputCycle;

            first RuntimeActivatesAcpdCdd then RuntimeExecutesInputCycle;

            first RuntimeExecutesInputCycle
            then RuntimeExecutesProcessingCycle;

            first RuntimeExecutesProcessingCycle
            then RuntimeExecutesPowermanagementCycle;

            first RuntimeExecutesPowermanagementCycle
            then RuntimeExecutesMonitoringCycle;

            first RuntimeExecutesMonitoringCycle
            then RuntimeExecutesOutputCycle;
        }


    }
}

package AcpdCdd_SysMLv2 {

    package Behavior_Init {

        private import ScalarValues::*;

        action def AcpdCdd_Initialization {

            attribute AcpdCdd_active;
            attribute setup_trial_counter;

            action CheckAcpdCddActive;
            action ExecuteCyclicTasksIfActive;
            action CheckSetupTrialCounterAgainstMaxAttempts;
            action AcpdCdd_StartInputCollector;
            action AcpdCdd_StartProcessing;
            action EnableAdcNotificationsAndHardwareTriggers;
            action SetAcpdCddActiveTrue;
            action IncrementSetupTrialCounter;
            action StopProcessing;
            action UpdateRteOutputWithSafeDefaultValues;

            first CheckAcpdCddActive if AcpdCdd_active then ExecuteCyclicTasksIfActive;
            first CheckAcpdCddActive if not AcpdCdd_active then CheckSetupTrialCounterAgainstMaxAttempts;
            first CheckSetupTrialCounterAgainstMaxAttempts then AcpdCdd_StartInputCollector;
            first AcpdCdd_StartInputCollector then AcpdCdd_StartProcessing;
            first AcpdCdd_StartProcessing then EnableAdcNotificationsAndHardwareTriggers;
            first EnableAdcNotificationsAndHardwareTriggers then SetAcpdCddActiveTrue;
            first SetAcpdCddActiveTrue then IncrementSetupTrialCounter;
            first CheckSetupTrialCounterAgainstMaxAttempts then StopProcessing;
            first StopProcessing then UpdateRteOutputWithSafeDefaultValues;
        }

        action def AcpdCdd_Init_Sequence_AsActionFlow {

            action RuntimeInitializesInputModule;
            action RuntimeInitializesPowermanagementModule;
            action RuntimeInitializesMonitoringModule;
            action RuntimeInitializesOutputModule;

            first RuntimeInitializesInputModule
            then RuntimeInitializesPowermanagementModule;

            first RuntimeInitializesPowermanagementModule
            then RuntimeInitializesMonitoringModule;

            first RuntimeInitializesMonitoringModule
            then RuntimeInitializesOutputModule;
        }


    }
}

package AcpdCdd_SysMLv2 {

    package ExternalInteractions {

        private import AcpdCdd_SysMLv2::ComponentDesign::*;

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
}

package AcpdCdd_SysMLv2 {

    package DynamicInteractionSequences {

        part def AcpdCdd_Runtime_Sequence_AdcParticipant {
            event occurrence AcpdCdd_AdcNotificationGroup0_1_Supply_source;
        }

        part def AcpdCdd_Runtime_Sequence_AdcBistParticipant {
            event occurrence AdcBist_GetVaref1ErrorStatus_target;
            event occurrence returnVARef1ErrorFlag_source;
            event occurrence AdcBist_GetVaref2ErrorStatus_target;
            event occurrence returnVARef2ErrorFlag_source;
        }

        part def AcpdCdd_Runtime_Sequence_RteParticipant {
            event occurrence Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_target;
            event occurrence returnActivationStatus_source;
            event occurrence Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_target;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddParticipant {
            event occurrence AcpdCdd_Activation_source;
            event occurrence returnFromPowermanagement_target;
            event occurrence AcpdCdd_CollectInputData_source;
            event occurrence returnInputData_target;
            event occurrence AcpdCdd_Process_source;
            event occurrence returnProcessedData_target;
            event occurrence AcpdCdd_PowermanagementCalcStatus_source;
            event occurrence returnPowerState_target;
            event occurrence AdcBist_GetVaref1ErrorStatus_source;
            event occurrence returnVARef1ErrorFlag_target;
            event occurrence AdcBist_GetVaref2ErrorStatus_source;
            event occurrence returnVARef2ErrorFlag_target;
            event occurrence AcpdCdd_Monitoring_source;
            event occurrence returnAcceleratorData_target;
            event occurrence AcpdCdd_Output_source;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddInputParticipant {
            event occurrence AcpdCdd_CollectInputData_target;
            event occurrence AcpdCdd_AdcNotificationGroup0_1_Supply_target;
            event occurrence returnInputData_source;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddProcessParticipant {
            event occurrence AcpdCdd_Process_target;
            event occurrence returnProcessedData_source;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddPowermanagementParticipant {
            event occurrence AcpdCdd_Activation_target;
            event occurrence Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_source;
            event occurrence returnActivationStatus_target;
            event occurrence returnFromPowermanagement_source;
            event occurrence AcpdCdd_PowermanagementCalcStatus_target;
            event occurrence returnPowerState_source;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddMonitoringParticipant {
            event occurrence AcpdCdd_Monitoring_target;
            event occurrence returnAcceleratorData_source;
        }

        part def AcpdCdd_Runtime_Sequence_AcpdCddOutputParticipant {
            event occurrence AcpdCdd_Output_target;
            event occurrence Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_source;
        }

        part def AcpdCdd_Runtime_Sequence {

            part adc[1] : AcpdCdd_Runtime_Sequence_AdcParticipant;
            part adcBist[1] : AcpdCdd_Runtime_Sequence_AdcBistParticipant;
            part rte[1] : AcpdCdd_Runtime_Sequence_RteParticipant;
            part acpdCdd[1] : AcpdCdd_Runtime_Sequence_AcpdCddParticipant;
            part acpdCddInput[1] : AcpdCdd_Runtime_Sequence_AcpdCddInputParticipant;
            part acpdCddProcess[1] : AcpdCdd_Runtime_Sequence_AcpdCddProcessParticipant;
            part acpdCddPowermanagement[1] : AcpdCdd_Runtime_Sequence_AcpdCddPowermanagementParticipant;
            part acpdCddMonitoring[1] : AcpdCdd_Runtime_Sequence_AcpdCddMonitoringParticipant;
            part acpdCddOutput[1] : AcpdCdd_Runtime_Sequence_AcpdCddOutputParticipant;

            // 1. Original: AcpdCdd_Activation()
            // Purpose: Enable/disable accelerator pedal module
            message AcpdCdd_Activation
                from acpdCdd.AcpdCdd_Activation_source
                to acpdCddPowermanagement.AcpdCdd_Activation_target;

            // 2. Original: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // Purpose: Read activation status from RTE
            message Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
                from acpdCddPowermanagement.Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_source
                to rte.Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_target;

            // 3. Original: return activation status
            // Purpose: Provide ACTIVATE/DEACTIVATE information
            message returnActivationStatus
                from rte.returnActivationStatus_source
                to acpdCddPowermanagement.returnActivationStatus_target;

            // 4. Original: return
            // Purpose: Power management step complete
            message returnFromPowermanagement
                from acpdCddPowermanagement.returnFromPowermanagement_source
                to acpdCdd.returnFromPowermanagement_target;

            // 5. Original: AcpdCdd_CollectInputData()
            // Purpose: Fetch buffered sensor and supply data
            message AcpdCdd_CollectInputData
                from acpdCdd.AcpdCdd_CollectInputData_source
                to acpdCddInput.AcpdCdd_CollectInputData_target;

            // 6. Original: interrupt notifications (AcpdCdd_AdcNotificationGroup0/1/Supply) // asynchronous
            // Purpose: Provide raw ADC samples and timestamps into buffers
            message AcpdCdd_AdcNotificationGroup0_1_Supply
                from adc.AcpdCdd_AdcNotificationGroup0_1_Supply_source
                to acpdCddInput.AcpdCdd_AdcNotificationGroup0_1_Supply_target;

            // 7. Original: return InputData
            // Purpose: Return buffered and grouped data for Sensor1/Sensor2
            message returnInputData
                from acpdCddInput.returnInputData_source
                to acpdCdd.returnInputData_target;

            // 8. Original: AcpdCdd_Process()
            // Purpose: Calculate averages and preliminary qualifiers
            message AcpdCdd_Process
                from acpdCdd.AcpdCdd_Process_source
                to acpdCddProcess.AcpdCdd_Process_target;

            // 9. Original: return ProcessedData
            // Purpose: Return ChannelMeansType / processed voltages
            message returnProcessedData
                from acpdCddProcess.returnProcessedData_source
                to acpdCdd.returnProcessedData_target;

            // 10. Original: AcpdCdd_PowermanagementCalcStatus()
            // Purpose: Determine current power state and transitions
            message AcpdCdd_PowermanagementCalcStatus
                from acpdCdd.AcpdCdd_PowermanagementCalcStatus_source
                to acpdCddPowermanagement.AcpdCdd_PowermanagementCalcStatus_target;

            // 11. Original: return PowerState
            // Purpose: Provide current power status for monitoring
            message returnPowerState
                from acpdCddPowermanagement.returnPowerState_source
                to acpdCdd.returnPowerState_target;

            // 12. Original: AdcBist_GetVaref1ErrorStatus()
            // Purpose: Check VARef1 error flag
            message AdcBist_GetVaref1ErrorStatus
                from acpdCdd.AdcBist_GetVaref1ErrorStatus_source
                to adcBist.AdcBist_GetVaref1ErrorStatus_target;

            // 13. Original: return VARef1ErrorFlag
            // Purpose: Provide VARef1 error status
            message returnVARef1ErrorFlag
                from adcBist.returnVARef1ErrorFlag_source
                to acpdCdd.returnVARef1ErrorFlag_target;

            // 14. Original: AdcBist_GetVaref2ErrorStatus()
            // Purpose: Check VARef2 error flag
            message AdcBist_GetVaref2ErrorStatus
                from acpdCdd.AdcBist_GetVaref2ErrorStatus_source
                to adcBist.AdcBist_GetVaref2ErrorStatus_target;

            // 15. Original: return VARef2ErrorFlag
            // Purpose: Provide VARef2 error status
            message returnVARef2ErrorFlag
                from adcBist.returnVARef2ErrorFlag_source
                to acpdCdd.returnVARef2ErrorFlag_target;

            // 16. Original: AcpdCdd_Monitoring(InputData, ProcessedData, PowerState, VARef1ErrorFlag, VARef2ErrorFlag)
            // Purpose: Compute final qualifiers and adjusted values
            message AcpdCdd_Monitoring
                from acpdCdd.AcpdCdd_Monitoring_source
                to acpdCddMonitoring.AcpdCdd_Monitoring_target;

            // 17. Original: return AcceleratorData
            // Purpose: Return data with qualifiers
            message returnAcceleratorData
                from acpdCddMonitoring.returnAcceleratorData_source
                to acpdCdd.returnAcceleratorData_target;

            // 18. Original: AcpdCdd_Output(AcceleratorData)
            // Purpose: Write to RTE
            message AcpdCdd_Output
                from acpdCdd.AcpdCdd_Output_source
                to acpdCddOutput.AcpdCdd_Output_target;

            // 19. Original: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // Purpose: Provide consistent accelerator pedal signals to RTE
            message Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
                from acpdCddOutput.Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_source
                to rte.Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_target;

        }

        part acpdCddRuntimeSequence : AcpdCdd_Runtime_Sequence;
    }
}

package AcpdCdd_SysMLv2 {

    package InterfaceContracts {

        private import AcpdCdd_SysMLv2::Types::*;

        // This file is a SysML v2 readable contract view.
        // The machine-checkable source of truth is:
        // contracts/runtime_interaction_contracts.json


        item def RuntimeContractPayload;

        port def RuntimeCallerPort {
            out item payload : RuntimeContractPayload;
        }

        port def RuntimeCalleePort {
            in item payload : RuntimeContractPayload;
        }

        // Runtime payload contract catalogue.
        // The JSON runtime contract checker validates that each message maps to one of these payload types.
        // payload-contract: AcpdCdd_AdcNotificationGroup0 payload=AdcNotificationPayloadType
        // payload-contract: AcpdCdd_AdcNotificationGroup1 payload=AdcNotificationPayloadType
        // payload-contract: AcpdCdd_AdcNotificationSupply payload=AdcNotificationPayloadType
        // payload-contract: returnInputData payload=InputDataType
        // payload-contract: AcpdCdd_Process payload=InputDataType
        // payload-contract: returnProcessedData payload=ChannelMeansType
        // payload-contract: AcpdCdd_Monitoring payload=ChannelMeansType
        // payload-contract: returnMonitoringStatus payload=MonitoringStatusPayloadType
        // payload-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc payload=ProcessedSensorOutputPayloadType

        part def AdcService {
            // port-contract: to_input_AcpdCdd_AdcNotificationGroup0_1_Supply role=caller message=AcpdCdd_AdcNotificationGroup0_1_Supply
            port to_input_AcpdCdd_AdcNotificationGroup0_1_Supply : RuntimeCallerPort;
        }
        part def AdcBistService {
            // provides-operation: AdcBist_GetVaref1ErrorStatus
            // provides-operation: returnVARef1ErrorFlag
            // provides-operation: AdcBist_GetVaref2ErrorStatus
            // provides-operation: returnVARef2ErrorFlag
            // port-contract: from_acpdCdd_AdcBist_GetVaref1ErrorStatus role=callee message=AdcBist_GetVaref1ErrorStatus
            port from_acpdCdd_AdcBist_GetVaref1ErrorStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnVARef1ErrorFlag role=caller message=returnVARef1ErrorFlag
            port to_acpdCdd_returnVARef1ErrorFlag : RuntimeCallerPort;
            // port-contract: from_acpdCdd_AdcBist_GetVaref2ErrorStatus role=callee message=AdcBist_GetVaref2ErrorStatus
            port from_acpdCdd_AdcBist_GetVaref2ErrorStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnVARef2ErrorFlag role=caller message=returnVARef2ErrorFlag
            port to_acpdCdd_returnVARef2ErrorFlag : RuntimeCallerPort;
        }
        part def RteService {
            // provides-operation: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // provides-operation: returnActivationStatus
            // provides-operation: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // port-contract: from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation role=callee message=Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            port from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation : RuntimeCalleePort;
            // port-contract: to_powermanagement_returnActivationStatus role=caller message=returnActivationStatus
            port to_powermanagement_returnActivationStatus : RuntimeCallerPort;
            // port-contract: from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc role=callee message=Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            port from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc : RuntimeCalleePort;
        }
        part def AcpdCddCoordinator {
            // port-contract: to_powermanagement_AcpdCdd_Activation role=caller message=AcpdCdd_Activation
            port to_powermanagement_AcpdCdd_Activation : RuntimeCallerPort;
            // port-contract: from_powermanagement_returnFromPowermanagement role=callee message=returnFromPowermanagement
            port from_powermanagement_returnFromPowermanagement : RuntimeCalleePort;
            // port-contract: to_input_AcpdCdd_CollectInputData role=caller message=AcpdCdd_CollectInputData
            port to_input_AcpdCdd_CollectInputData : RuntimeCallerPort;
            // port-contract: from_input_returnInputData role=callee message=returnInputData
            port from_input_returnInputData : RuntimeCalleePort;
            // port-contract: to_process_AcpdCdd_Process role=caller message=AcpdCdd_Process
            port to_process_AcpdCdd_Process : RuntimeCallerPort;
            // port-contract: from_process_returnProcessedData role=callee message=returnProcessedData
            port from_process_returnProcessedData : RuntimeCalleePort;
            // port-contract: to_powermanagement_AcpdCdd_PowermanagementCalcStatus role=caller message=AcpdCdd_PowermanagementCalcStatus
            port to_powermanagement_AcpdCdd_PowermanagementCalcStatus : RuntimeCallerPort;
            // port-contract: from_powermanagement_returnPowerState role=callee message=returnPowerState
            port from_powermanagement_returnPowerState : RuntimeCalleePort;
            // port-contract: to_adcBist_AdcBist_GetVaref1ErrorStatus role=caller message=AdcBist_GetVaref1ErrorStatus
            port to_adcBist_AdcBist_GetVaref1ErrorStatus : RuntimeCallerPort;
            // port-contract: from_adcBist_returnVARef1ErrorFlag role=callee message=returnVARef1ErrorFlag
            port from_adcBist_returnVARef1ErrorFlag : RuntimeCalleePort;
            // port-contract: to_adcBist_AdcBist_GetVaref2ErrorStatus role=caller message=AdcBist_GetVaref2ErrorStatus
            port to_adcBist_AdcBist_GetVaref2ErrorStatus : RuntimeCallerPort;
            // port-contract: from_adcBist_returnVARef2ErrorFlag role=callee message=returnVARef2ErrorFlag
            port from_adcBist_returnVARef2ErrorFlag : RuntimeCalleePort;
            // port-contract: to_monitoring_AcpdCdd_Monitoring role=caller message=AcpdCdd_Monitoring
            port to_monitoring_AcpdCdd_Monitoring : RuntimeCallerPort;
            // port-contract: from_monitoring_returnAcceleratorData role=callee message=returnAcceleratorData
            port from_monitoring_returnAcceleratorData : RuntimeCalleePort;
            // port-contract: to_output_AcpdCdd_Output role=caller message=AcpdCdd_Output
            port to_output_AcpdCdd_Output : RuntimeCallerPort;
        }
        part def AcpdCddInput {
            // provides-operation: AcpdCdd_CollectInputData
            // provides-operation: AcpdCdd_AdcNotificationGroup0_1_Supply
            // provides-operation: returnInputData
            // port-contract: from_acpdCdd_AcpdCdd_CollectInputData role=callee message=AcpdCdd_CollectInputData
            port from_acpdCdd_AcpdCdd_CollectInputData : RuntimeCalleePort;
            // port-contract: from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply role=callee message=AcpdCdd_AdcNotificationGroup0_1_Supply
            port from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnInputData role=caller message=returnInputData
            port to_acpdCdd_returnInputData : RuntimeCallerPort;
        }
        part def AcpdCddProcess {
            // provides-operation: AcpdCdd_Process
            // provides-operation: returnProcessedData
            // port-contract: from_acpdCdd_AcpdCdd_Process role=callee message=AcpdCdd_Process
            port from_acpdCdd_AcpdCdd_Process : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnProcessedData role=caller message=returnProcessedData
            port to_acpdCdd_returnProcessedData : RuntimeCallerPort;
        }
        part def AcpdCddPowermanagement {
            // provides-operation: AcpdCdd_Activation
            // provides-operation: returnFromPowermanagement
            // provides-operation: AcpdCdd_PowermanagementCalcStatus
            // provides-operation: returnPowerState
            // port-contract: from_acpdCdd_AcpdCdd_Activation role=callee message=AcpdCdd_Activation
            port from_acpdCdd_AcpdCdd_Activation : RuntimeCalleePort;
            // port-contract: to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation role=caller message=Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            port to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation : RuntimeCallerPort;
            // port-contract: from_rte_returnActivationStatus role=callee message=returnActivationStatus
            port from_rte_returnActivationStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnFromPowermanagement role=caller message=returnFromPowermanagement
            port to_acpdCdd_returnFromPowermanagement : RuntimeCallerPort;
            // port-contract: from_acpdCdd_AcpdCdd_PowermanagementCalcStatus role=callee message=AcpdCdd_PowermanagementCalcStatus
            port from_acpdCdd_AcpdCdd_PowermanagementCalcStatus : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnPowerState role=caller message=returnPowerState
            port to_acpdCdd_returnPowerState : RuntimeCallerPort;
        }
        part def AcpdCddMonitoring {
            // provides-operation: AcpdCdd_Monitoring
            // provides-operation: returnAcceleratorData
            // port-contract: from_acpdCdd_AcpdCdd_Monitoring role=callee message=AcpdCdd_Monitoring
            port from_acpdCdd_AcpdCdd_Monitoring : RuntimeCalleePort;
            // port-contract: to_acpdCdd_returnAcceleratorData role=caller message=returnAcceleratorData
            port to_acpdCdd_returnAcceleratorData : RuntimeCallerPort;
        }
        part def AcpdCddOutput {
            // provides-operation: AcpdCdd_Output
            // port-contract: from_acpdCdd_AcpdCdd_Output role=callee message=AcpdCdd_Output
            port from_acpdCdd_AcpdCdd_Output : RuntimeCalleePort;
            // port-contract: to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc role=caller message=Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            port to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc : RuntimeCallerPort;
        }

        part def AcpdCdd_Runtime_InterfaceContractContext {
            part adc : AdcService;
            part adcBist : AdcBistService;
            part rte : RteService;
            part acpdCdd : AcpdCddCoordinator;
            part input : AcpdCddInput;
            part process : AcpdCddProcess;
            part powermanagement : AcpdCddPowermanagement;
            part monitoring : AcpdCddMonitoring;
            part output : AcpdCddOutput;

            // connection-contract: AcpdCdd_Activation AcpdCdd.to_powermanagement_AcpdCdd_Activation -> AcpdCdd_Powermanagement.from_acpdCdd_AcpdCdd_Activation
            // connection-contract: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation AcpdCdd_Powermanagement.to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation -> RTE.from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // connection-contract: returnActivationStatus RTE.to_powermanagement_returnActivationStatus -> AcpdCdd_Powermanagement.from_rte_returnActivationStatus
            // connection-contract: returnFromPowermanagement AcpdCdd_Powermanagement.to_acpdCdd_returnFromPowermanagement -> AcpdCdd.from_powermanagement_returnFromPowermanagement
            // connection-contract: AcpdCdd_CollectInputData AcpdCdd.to_input_AcpdCdd_CollectInputData -> AcpdCdd_Input.from_acpdCdd_AcpdCdd_CollectInputData
            // connection-contract: AcpdCdd_AdcNotificationGroup0_1_Supply ADC.to_input_AcpdCdd_AdcNotificationGroup0_1_Supply -> AcpdCdd_Input.from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply
            // connection-contract: returnInputData AcpdCdd_Input.to_acpdCdd_returnInputData -> AcpdCdd.from_input_returnInputData
            // connection-contract: AcpdCdd_Process AcpdCdd.to_process_AcpdCdd_Process -> AcpdCdd_Process.from_acpdCdd_AcpdCdd_Process
            // connection-contract: returnProcessedData AcpdCdd_Process.to_acpdCdd_returnProcessedData -> AcpdCdd.from_process_returnProcessedData
            // connection-contract: AcpdCdd_PowermanagementCalcStatus AcpdCdd.to_powermanagement_AcpdCdd_PowermanagementCalcStatus -> AcpdCdd_Powermanagement.from_acpdCdd_AcpdCdd_PowermanagementCalcStatus
            // connection-contract: returnPowerState AcpdCdd_Powermanagement.to_acpdCdd_returnPowerState -> AcpdCdd.from_powermanagement_returnPowerState
            // connection-contract: AdcBist_GetVaref1ErrorStatus AcpdCdd.to_adcBist_AdcBist_GetVaref1ErrorStatus -> AdcBist.from_acpdCdd_AdcBist_GetVaref1ErrorStatus
            // connection-contract: returnVARef1ErrorFlag AdcBist.to_acpdCdd_returnVARef1ErrorFlag -> AcpdCdd.from_adcBist_returnVARef1ErrorFlag
            // connection-contract: AdcBist_GetVaref2ErrorStatus AcpdCdd.to_adcBist_AdcBist_GetVaref2ErrorStatus -> AdcBist.from_acpdCdd_AdcBist_GetVaref2ErrorStatus
            // connection-contract: returnVARef2ErrorFlag AdcBist.to_acpdCdd_returnVARef2ErrorFlag -> AcpdCdd.from_adcBist_returnVARef2ErrorFlag
            // connection-contract: AcpdCdd_Monitoring AcpdCdd.to_monitoring_AcpdCdd_Monitoring -> AcpdCdd_Monitoring.from_acpdCdd_AcpdCdd_Monitoring
            // connection-contract: returnAcceleratorData AcpdCdd_Monitoring.to_acpdCdd_returnAcceleratorData -> AcpdCdd.from_monitoring_returnAcceleratorData
            // connection-contract: AcpdCdd_Output AcpdCdd.to_output_AcpdCdd_Output -> AcpdCdd_Output.from_acpdCdd_AcpdCdd_Output
            // connection-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc AcpdCdd_Output.to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc -> RTE.from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
        }

        part runtimeInterfaceContractContext : AcpdCdd_Runtime_InterfaceContractContext;
    }
}

package AcpdCdd_SysMLv2 {

    package ComponentInteractionSequences {

        part def AcpdCdd_Input_Sequence_AcpdCddParticipant {
            event occurrence callCollectInputData;
            event occurrence receiveInputData;
        }

        part def AcpdCdd_Input_Sequence_AcpdCddInputParticipant {
            event occurrence receiveCollectInputDataCall;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcGroup0Notification;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcGroup1Notification;
            // trlc-satisfies: 28711565
            event occurrence receiveAdcSupplyNotification;
            event occurrence returnInputData;
        }

        part def AcpdCdd_Input_Sequence_AdcParticipant {
            event occurrence notifyGroup0;
            event occurrence notifyGroup1;
            event occurrence notifySupply;
        }

        part def AcpdCdd_Input_Sequence {

            part acpdCdd[1] : AcpdCdd_Input_Sequence_AcpdCddParticipant;

            part acpdCddInput[1] : AcpdCdd_Input_Sequence_AcpdCddInputParticipant;

            part adc[1] : AcpdCdd_Input_Sequence_AdcParticipant;

            message AcpdCdd_CollectInputData
                from acpdCdd.callCollectInputData
                to acpdCddInput.receiveCollectInputDataCall;
            message AcpdCdd_AdcNotificationGroup0
                from adc.notifyGroup0
                to acpdCddInput.receiveAdcGroup0Notification;
            message AcpdCdd_AdcNotificationGroup1
                from adc.notifyGroup1
                to acpdCddInput.receiveAdcGroup1Notification;
            message AcpdCdd_AdcNotificationSupply
                from adc.notifySupply
                to acpdCddInput.receiveAdcSupplyNotification;

            message returnInputData
                from acpdCddInput.returnInputData
                to acpdCdd.receiveInputData;
        }

        part def AcpdCdd_Process_Sequence_AcpdCddParticipant {
            event occurrence callProcess;
            event occurrence receiveProcessedData;
        }

        part def AcpdCdd_Process_Sequence_AcpdCddProcessParticipant {
            event occurrence receiveProcessCall;
            event occurrence returnProcessedData;
        }

        part def AcpdCdd_Process_Sequence {

            part acpdCdd[1] : AcpdCdd_Process_Sequence_AcpdCddParticipant;

            part acpdCddProcess[1] : AcpdCdd_Process_Sequence_AcpdCddProcessParticipant;

            message AcpdCdd_Process
                from acpdCdd.callProcess
                to acpdCddProcess.receiveProcessCall;

            message returnProcessedData
                from acpdCddProcess.returnProcessedData
                to acpdCdd.receiveProcessedData;
        }

        part def AcpdCdd_Powermanagement_Sequence_AcpdCddParticipant {
            event occurrence callActivation;
            event occurrence receiveActivationReturn;
            event occurrence callPowermanagementCalcStatus;
            event occurrence receivePowerState;
        }

        part def AcpdCdd_Powermanagement_Sequence_AcpdCddPowermanagementParticipant {
            event occurrence receiveActivationCall;
            event occurrence requestActivationStatus;
            event occurrence receiveActivationStatus;
            event occurrence returnActivationComplete;
            event occurrence receivePowermanagementCalcStatusCall;
            event occurrence requestDioPowerChannelUpdate;
            event occurrence returnPowerState;
        }

        part def AcpdCdd_Powermanagement_Sequence_RteParticipant {
            event occurrence receiveActivationReadRequest;
            event occurrence returnActivationStatus;
        }

        part def AcpdCdd_Powermanagement_Sequence_DioParticipant {
            event occurrence receivePowerChannelUpdate;
        }

        part def AcpdCdd_Powermanagement_Sequence {

            part acpdCdd[1] : AcpdCdd_Powermanagement_Sequence_AcpdCddParticipant;

            part acpdCddPowermanagement[1] : AcpdCdd_Powermanagement_Sequence_AcpdCddPowermanagementParticipant;

            part rte[1] : AcpdCdd_Powermanagement_Sequence_RteParticipant;

            part dio[1] : AcpdCdd_Powermanagement_Sequence_DioParticipant;

            message AcpdCdd_Activation
                from acpdCdd.callActivation
                to acpdCddPowermanagement.receiveActivationCall;

            message Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
                from acpdCddPowermanagement.requestActivationStatus
                to rte.receiveActivationReadRequest;

            message returnActivationStatus
                from rte.returnActivationStatus
                to acpdCddPowermanagement.receiveActivationStatus;

            message returnFromPowermanagement
                from acpdCddPowermanagement.returnActivationComplete
                to acpdCdd.receiveActivationReturn;

            message AcpdCdd_PowermanagementCalcStatus
                from acpdCdd.callPowermanagementCalcStatus
                to acpdCddPowermanagement.receivePowermanagementCalcStatusCall;

            message Dio_WriteChannel
                from acpdCddPowermanagement.requestDioPowerChannelUpdate
                to dio.receivePowerChannelUpdate;

            message returnPowerState
                from acpdCddPowermanagement.returnPowerState
                to acpdCdd.receivePowerState;
        }

        part def AcpdCdd_Monitoring_Sequence_AcpdCddParticipant {
            event occurrence callAdcBistVaref1;
            event occurrence receiveVaref1ErrorFlag;
            event occurrence callAdcBistVaref2;
            event occurrence receiveVaref2ErrorFlag;
            event occurrence callMonitoring;
            event occurrence receiveAcceleratorData;
        }

        part def AcpdCdd_Monitoring_Sequence_AdcBistParticipant {
            event occurrence receiveVaref1StatusRequest;
            event occurrence returnVaref1ErrorFlag;
            event occurrence receiveVaref2StatusRequest;
            event occurrence returnVaref2ErrorFlag;
        }

        part def AcpdCdd_Monitoring_Sequence_AcpdCddMonitoringParticipant {
            event occurrence receiveMonitoringCall;
            event occurrence reportDiagnosticEvent;
            event occurrence returnAcceleratorData;
        }

        part def AcpdCdd_Monitoring_Sequence_DemParticipant {
            event occurrence receiveDiagnosticEventReport;
        }

        part def AcpdCdd_Monitoring_Sequence {

            part acpdCdd[1] : AcpdCdd_Monitoring_Sequence_AcpdCddParticipant;

            part adcBist[1] : AcpdCdd_Monitoring_Sequence_AdcBistParticipant;

            part acpdCddMonitoring[1] : AcpdCdd_Monitoring_Sequence_AcpdCddMonitoringParticipant;

            part dem[1] : AcpdCdd_Monitoring_Sequence_DemParticipant;

            message AdcBist_GetVaref1ErrorStatus
                from acpdCdd.callAdcBistVaref1
                to adcBist.receiveVaref1StatusRequest;

            message returnVARef1ErrorFlag
                from adcBist.returnVaref1ErrorFlag
                to acpdCdd.receiveVaref1ErrorFlag;

            message AdcBist_GetVaref2ErrorStatus
                from acpdCdd.callAdcBistVaref2
                to adcBist.receiveVaref2StatusRequest;

            message returnVARef2ErrorFlag
                from adcBist.returnVaref2ErrorFlag
                to acpdCdd.receiveVaref2ErrorFlag;

            message AcpdCdd_Monitoring
                from acpdCdd.callMonitoring
                to acpdCddMonitoring.receiveMonitoringCall;

            message Dem_ReportErrorStatus
                from acpdCddMonitoring.reportDiagnosticEvent
                to dem.receiveDiagnosticEventReport;

            message returnAcceleratorData
                from acpdCddMonitoring.returnAcceleratorData
                to acpdCdd.receiveAcceleratorData;
        }

        part def AcpdCdd_Output_Sequence_AcpdCddParticipant {
            event occurrence callOutput;
        }

        part def AcpdCdd_Output_Sequence_AcpdCddOutputParticipant {
            event occurrence receiveOutputCall;
            event occurrence requestRteWrite;
        }

        part def AcpdCdd_Output_Sequence_RteParticipant {
            event occurrence receiveRteWrite;
        }

        part def AcpdCdd_Output_Sequence {

            part acpdCdd[1] : AcpdCdd_Output_Sequence_AcpdCddParticipant;

            part acpdCddOutput[1] : AcpdCdd_Output_Sequence_AcpdCddOutputParticipant;

            part rte[1] : AcpdCdd_Output_Sequence_RteParticipant;

            message AcpdCdd_Output
                from acpdCdd.callOutput
                to acpdCddOutput.receiveOutputCall;

            message Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
                from acpdCddOutput.requestRteWrite
                to rte.receiveRteWrite;
        }

        part acpdCddInputSequence : AcpdCdd_Input_Sequence;
        part acpdCddProcessSequence : AcpdCdd_Process_Sequence;
        part acpdCddPowermanagementSequence : AcpdCdd_Powermanagement_Sequence;
        part acpdCddMonitoringSequence : AcpdCdd_Monitoring_Sequence;
        part acpdCddOutputSequence : AcpdCdd_Output_Sequence;
    }
}

package AcpdCdd_FaultTrees {

    action def MissingAdcNotification_FTA {
        // trlc-failure-mode: AcpdCddSafety.MissingAdcNotification

        action topEvent;

        action notificationPathOrGate;
        // fta-gate: OR

        action missingAdcNotification;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_MissingAdcNotification

        action staleInputBuffer;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_StaleInputBuffer

        action adcCallbackNotExecuted;
        // fta-event: intermediate

        first missingAdcNotification then notificationPathOrGate;
        first staleInputBuffer then notificationPathOrGate;
        first adcCallbackNotExecuted then notificationPathOrGate;
        first notificationPathOrGate then topEvent;
    }

    action def DelayedAdcNotification_FTA {
        // trlc-failure-mode: AcpdCddSafety.DelayedAdcNotification

        action topEvent;

        action delayPathOrGate;
        // fta-gate: OR

        action delayedAdcNotification;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_DelayedAdcNotification

        action timestampWindowExceeded;
        // fta-event: intermediate

        first delayedAdcNotification then delayPathOrGate;
        first timestampWindowExceeded then delayPathOrGate;
        first delayPathOrGate then topEvent;
    }

    action def IncorrectProcessedSensorValue_FTA {
        // trlc-failure-mode: AcpdCddSafety.IncorrectProcessedSensorValue

        action topEvent;

        action processingPathOrGate;
        // fta-gate: OR

        action invalidProcessedSensorValue;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_InvalidProcessedSensorValue

        action incorrectMovingAverageComputation;
        // fta-event: intermediate

        action sensorDeviationNotPlausible;
        // fta-event: intermediate

        first invalidProcessedSensorValue then processingPathOrGate;
        first incorrectMovingAverageComputation then processingPathOrGate;
        first sensorDeviationNotPlausible then processingPathOrGate;
        first processingPathOrGate then topEvent;
    }

    action def MissingMonitoringReaction_FTA {
        // trlc-failure-mode: AcpdCddSafety.MissingMonitoringReaction

        action topEvent;

        action monitoringPathOrGate;
        // fta-gate: OR

        action referenceVoltageErrorNotHandled;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_ReferenceVoltageErrorNotHandled

        action invalidInputNotReacted;
        // fta-event: intermediate

        action invalidProcessingResultNotReacted;
        // fta-event: intermediate

        first referenceVoltageErrorNotHandled then monitoringPathOrGate;
        first invalidInputNotReacted then monitoringPathOrGate;
        first invalidProcessingResultNotReacted then monitoringPathOrGate;
        first monitoringPathOrGate then topEvent;
    }

    action def WrongRteOutput_FTA {
        // trlc-failure-mode: AcpdCddSafety.WrongRteOutput

        action topEvent;

        action outputPathOrGate;
        // fta-gate: OR

        action wrongRteOutput;
        // fta-event: basic
        // safety-basic-event: AcpdCddSafety.BE_WrongRteOutput

        action wrongQualifierPublished;
        // fta-event: intermediate

        action rteWriteNotPerformed;
        // fta-event: intermediate

        first wrongRteOutput then outputPathOrGate;
        first wrongQualifierPublished then outputPathOrGate;
        first rteWriteNotPerformed then outputPathOrGate;
        first outputPathOrGate then topEvent;
    }
}

package AcpdCdd_SysMLv2 {

    package RuntimeInteractionContracts {

        private import Types::*;

        // SysML v2-readable runtime interaction contract model.
        // The JSON contract remains the current machine-checkable enforcement artifact.

        item def RuntimeInteractionContract {
            attribute SequenceIndex : ScalarValues::Integer;
        }

        part def AcpdCdd_RuntimeInteractionContractSet {

            // interaction-contract: AcpdCdd_Activation
            // sequence-index: 1
            // from: AcpdCdd
            // to: AcpdCdd_Powermanagement
            // caller-port: to_powermanagement_AcpdCdd_Activation
            // callee-port: from_acpdCdd_AcpdCdd_Activation
            // operation: AcpdCdd_Activation
            // operation-owner: AcpdCdd_Powermanagement
            // payload-type: ActivationRequestPayloadType
            item AcpdCdd_Activation_contract : RuntimeInteractionContract {
                item Payload : ActivationRequestPayloadType;
            }

            // interaction-contract: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // sequence-index: 2
            // from: AcpdCdd_Powermanagement
            // to: RTE
            // caller-port: to_rte_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // callee-port: from_powermanagement_Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // operation: Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation
            // operation-owner: RTE
            // payload-type: ActivationRequestPayloadType
            item Rte_DRead_AcpdCdd_Activation_AcpdCdd_Activation_contract : RuntimeInteractionContract {
                item Payload : ActivationRequestPayloadType;
            }

            // interaction-contract: returnActivationStatus
            // sequence-index: 3
            // from: RTE
            // to: AcpdCdd_Powermanagement
            // caller-port: to_powermanagement_returnActivationStatus
            // callee-port: from_rte_returnActivationStatus
            // operation: returnActivationStatus
            // operation-owner: RTE
            // payload-type: ActivationStatusPayloadType
            item returnActivationStatus_contract : RuntimeInteractionContract {
                item Payload : ActivationStatusPayloadType;
            }

            // interaction-contract: returnFromPowermanagement
            // sequence-index: 4
            // from: AcpdCdd_Powermanagement
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnFromPowermanagement
            // callee-port: from_powermanagement_returnFromPowermanagement
            // operation: returnFromPowermanagement
            // operation-owner: AcpdCdd_Powermanagement
            // payload-type: NoPayloadType
            item returnFromPowermanagement_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: AcpdCdd_CollectInputData
            // sequence-index: 5
            // from: AcpdCdd
            // to: AcpdCdd_Input
            // caller-port: to_input_AcpdCdd_CollectInputData
            // callee-port: from_acpdCdd_AcpdCdd_CollectInputData
            // operation: AcpdCdd_CollectInputData
            // operation-owner: AcpdCdd_Input
            // payload-type: NoPayloadType
            item AcpdCdd_CollectInputData_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: AcpdCdd_AdcNotificationGroup0_1_Supply
            // sequence-index: 6
            // from: ADC
            // to: AcpdCdd_Input
            // caller-port: to_input_AcpdCdd_AdcNotificationGroup0_1_Supply
            // callee-port: from_adc_AcpdCdd_AdcNotificationGroup0_1_Supply
            // operation: AcpdCdd_AdcNotificationGroup0_1_Supply
            // operation-owner: AcpdCdd_Input
            // payload-type: NoPayloadType
            item AcpdCdd_AdcNotificationGroup0_1_Supply_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: returnInputData
            // sequence-index: 7
            // from: AcpdCdd_Input
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnInputData
            // callee-port: from_input_returnInputData
            // operation: returnInputData
            // operation-owner: AcpdCdd_Input
            // payload-type: InputDataType
            item returnInputData_contract : RuntimeInteractionContract {
                item Payload : InputDataType;
            }

            // interaction-contract: AcpdCdd_Process
            // sequence-index: 8
            // from: AcpdCdd
            // to: AcpdCdd_Process
            // caller-port: to_process_AcpdCdd_Process
            // callee-port: from_acpdCdd_AcpdCdd_Process
            // operation: AcpdCdd_Process
            // operation-owner: AcpdCdd_Process
            // payload-type: InputDataType
            item AcpdCdd_Process_contract : RuntimeInteractionContract {
                item Payload : InputDataType;
            }

            // interaction-contract: returnProcessedData
            // sequence-index: 9
            // from: AcpdCdd_Process
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnProcessedData
            // callee-port: from_process_returnProcessedData
            // operation: returnProcessedData
            // operation-owner: AcpdCdd_Process
            // payload-type: ChannelMeansType
            item returnProcessedData_contract : RuntimeInteractionContract {
                item Payload : ChannelMeansType;
            }

            // interaction-contract: AcpdCdd_PowermanagementCalcStatus
            // sequence-index: 10
            // from: AcpdCdd
            // to: AcpdCdd_Powermanagement
            // caller-port: to_powermanagement_AcpdCdd_PowermanagementCalcStatus
            // callee-port: from_acpdCdd_AcpdCdd_PowermanagementCalcStatus
            // operation: AcpdCdd_PowermanagementCalcStatus
            // operation-owner: AcpdCdd_Powermanagement
            // payload-type: NoPayloadType
            item AcpdCdd_PowermanagementCalcStatus_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: returnPowerState
            // sequence-index: 11
            // from: AcpdCdd_Powermanagement
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnPowerState
            // callee-port: from_powermanagement_returnPowerState
            // operation: returnPowerState
            // operation-owner: AcpdCdd_Powermanagement
            // payload-type: NoPayloadType
            item returnPowerState_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: AdcBist_GetVaref1ErrorStatus
            // sequence-index: 12
            // from: AcpdCdd
            // to: AdcBist
            // caller-port: to_adcBist_AdcBist_GetVaref1ErrorStatus
            // callee-port: from_acpdCdd_AdcBist_GetVaref1ErrorStatus
            // operation: AdcBist_GetVaref1ErrorStatus
            // operation-owner: AdcBist
            // payload-type: NoPayloadType
            item AdcBist_GetVaref1ErrorStatus_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: returnVARef1ErrorFlag
            // sequence-index: 13
            // from: AdcBist
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnVARef1ErrorFlag
            // callee-port: from_adcBist_returnVARef1ErrorFlag
            // operation: returnVARef1ErrorFlag
            // operation-owner: AdcBist
            // payload-type: AdcBistStatusPayloadType
            item returnVARef1ErrorFlag_contract : RuntimeInteractionContract {
                item Payload : AdcBistStatusPayloadType;
            }

            // interaction-contract: AdcBist_GetVaref2ErrorStatus
            // sequence-index: 14
            // from: AcpdCdd
            // to: AdcBist
            // caller-port: to_adcBist_AdcBist_GetVaref2ErrorStatus
            // callee-port: from_acpdCdd_AdcBist_GetVaref2ErrorStatus
            // operation: AdcBist_GetVaref2ErrorStatus
            // operation-owner: AdcBist
            // payload-type: NoPayloadType
            item AdcBist_GetVaref2ErrorStatus_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: returnVARef2ErrorFlag
            // sequence-index: 15
            // from: AdcBist
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnVARef2ErrorFlag
            // callee-port: from_adcBist_returnVARef2ErrorFlag
            // operation: returnVARef2ErrorFlag
            // operation-owner: AdcBist
            // payload-type: AdcBistStatusPayloadType
            item returnVARef2ErrorFlag_contract : RuntimeInteractionContract {
                item Payload : AdcBistStatusPayloadType;
            }

            // interaction-contract: AcpdCdd_Monitoring
            // sequence-index: 16
            // from: AcpdCdd
            // to: AcpdCdd_Monitoring
            // caller-port: to_monitoring_AcpdCdd_Monitoring
            // callee-port: from_acpdCdd_AcpdCdd_Monitoring
            // operation: AcpdCdd_Monitoring
            // operation-owner: AcpdCdd_Monitoring
            // payload-type: ChannelMeansType
            item AcpdCdd_Monitoring_contract : RuntimeInteractionContract {
                item Payload : ChannelMeansType;
            }

            // interaction-contract: returnAcceleratorData
            // sequence-index: 17
            // from: AcpdCdd_Monitoring
            // to: AcpdCdd
            // caller-port: to_acpdCdd_returnAcceleratorData
            // callee-port: from_monitoring_returnAcceleratorData
            // operation: returnAcceleratorData
            // operation-owner: AcpdCdd_Monitoring
            // payload-type: NoPayloadType
            item returnAcceleratorData_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: AcpdCdd_Output
            // sequence-index: 18
            // from: AcpdCdd
            // to: AcpdCdd_Output
            // caller-port: to_output_AcpdCdd_Output
            // callee-port: from_acpdCdd_AcpdCdd_Output
            // operation: AcpdCdd_Output
            // operation-owner: AcpdCdd_Output
            // payload-type: NoPayloadType
            item AcpdCdd_Output_contract : RuntimeInteractionContract {
                item Payload : NoPayloadType;
            }

            // interaction-contract: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // sequence-index: 19
            // from: AcpdCdd_Output
            // to: RTE
            // caller-port: to_rte_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // callee-port: from_output_Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // operation: Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc
            // operation-owner: RTE
            // payload-type: ProcessedSensorOutputPayloadType
            item Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc_contract : RuntimeInteractionContract {
                item Payload : ProcessedSensorOutputPayloadType;
            }

        }
    }
}

package AcpdCdd_SysMLv2 {

    package ComponentDataflows {

        private import AcpdCdd_SysMLv2::Types::*;

        // Component-level dataflow/interconnection view.
        // This file is intentionally data-oriented, not sequence-oriented.
        //
        // Purpose:
        // - show which runtime participants exchange which typed payloads
        // - support the interconnection view
        // - keep sequence ordering in 14_ComponentInteractionSequences.sysml
        // - keep runtime contract checking in 17_RuntimeInteractionContracts.sysml


        port def AdcNotificationOutPort {
            out item payload : AdcNotificationPayloadType;
        }

        port def AdcNotificationInPort {
            in item payload : AdcNotificationPayloadType;
        }

        port def InputDataOutPort {
            out item payload : InputDataType;
        }

        port def InputDataInPort {
            in item payload : InputDataType;
        }

        port def ProcessedDataOutPort {
            out item payload : ChannelMeansType;
        }

        port def ProcessedDataInPort {
            in item payload : ChannelMeansType;
        }

        port def MonitoringStatusOutPort {
            out item payload : MonitoringStatusPayloadType;
        }

        port def MonitoringStatusInPort {
            in item payload : MonitoringStatusPayloadType;
        }

        port def ActivationStatusOutPort {
            out item payload : ActivationStatusPayloadType;
        }

        port def ActivationStatusInPort {
            in item payload : ActivationStatusPayloadType;
        }

        port def SensorOutputOutPort {
            out item payload : ProcessedSensorOutputPayloadType;
        }

        port def SensorOutputInPort {
            in item payload : ProcessedSensorOutputPayloadType;
        }

        port def DioCommandOutPort {
            out item payload : DioCommandPayloadType;
        }

        port def DioCommandInPort {
            in item payload : DioCommandPayloadType;
        }

        port def AdcBistStatusOutPort {
            out item payload : AdcBistStatusPayloadType;
        }

        port def AdcBistStatusInPort {
            in item payload : AdcBistStatusPayloadType;
        }

        part def AdcDataflowNode {
            port adcNotificationOut : AdcNotificationOutPort;
        }

        part def AdcBistDataflowNode {
            port adcBistStatusOut : AdcBistStatusOutPort;
        }

        part def RteDataflowNode {
            port activationStatusOut : ActivationStatusOutPort;
            port sensorOutputIn : SensorOutputInPort;
        }

        part def DioDataflowNode {
            port powerCommandIn : DioCommandInPort;
        }

        part def AcpdCddCoordinatorDataflowNode {
            port activationRequestOut : ActivationStatusOutPort;
            port activationStatusIn : ActivationStatusInPort;
            port inputDataIn : InputDataInPort;
            port processedDataIn : ProcessedDataInPort;
            port monitoringStatusIn : MonitoringStatusInPort;
            port sensorOutputOut : SensorOutputOutPort;
        }

        part def AcpdCddInputDataflowNode {
            port adcNotificationIn : AdcNotificationInPort;
            port inputDataOut : InputDataOutPort;
        }

        part def AcpdCddProcessDataflowNode {
            port inputDataIn : InputDataInPort;
            port processedDataOut : ProcessedDataOutPort;
        }

        part def AcpdCddPowermanagementDataflowNode {
            port activationRequestIn : ActivationStatusInPort;
            port activationStatusOut : ActivationStatusOutPort;
            port powerCommandOut : DioCommandOutPort;
        }

        part def AcpdCddMonitoringDataflowNode {
            port processedDataIn : ProcessedDataInPort;
            port adcBistStatusIn : AdcBistStatusInPort;
            port monitoringStatusOut : MonitoringStatusOutPort;
        }

        part def AcpdCddOutputDataflowNode {
            port processedDataIn : ProcessedDataInPort;
            port monitoringStatusIn : MonitoringStatusInPort;
            port sensorOutputOut : SensorOutputOutPort;
        }

        part def AcpdCdd_DataflowInterconnection {

            part adc[1] : AdcDataflowNode;

            part adcBist[1] : AdcBistDataflowNode;

            part rte[1] : RteDataflowNode;

            part dio[1] : DioDataflowNode;

            part acpdCdd[1] : AcpdCddCoordinatorDataflowNode;

            part acpdCddInput[1] : AcpdCddInputDataflowNode;

            part acpdCddProcess[1] : AcpdCddProcessDataflowNode;

            part acpdCddPowermanagement[1] : AcpdCddPowermanagementDataflowNode;

            part acpdCddMonitoring[1] : AcpdCddMonitoringDataflowNode;

            part acpdCddOutput[1] : AcpdCddOutputDataflowNode;

            // ADC notification payloads entering AcpdCdd input handling.
            // payload-type: AdcNotificationPayloadType
            flow adcNotificationData : AdcNotificationPayloadType
                from adc.adcNotificationOut
                to acpdCddInput.adcNotificationIn;

            // Input data produced by input handling and consumed by process.
            // payload-type: InputDataType
            flow inputDataToCoordinator : InputDataType
                from acpdCddInput.inputDataOut
                to acpdCdd.inputDataIn;

            // Input data consumed by processing.
            // payload-type: InputDataType
            flow inputDataToProcess : InputDataType
                from acpdCdd.inputDataIn
                to acpdCddProcess.inputDataIn;

            // Processed sensor values produced by process.
            // payload-type: ChannelMeansType
            flow processedDataToCoordinator : ChannelMeansType
                from acpdCddProcess.processedDataOut
                to acpdCdd.processedDataIn;

            // Processed data consumed by monitoring.
            // payload-type: ChannelMeansType
            flow processedDataToMonitoring : ChannelMeansType
                from acpdCdd.processedDataIn
                to acpdCddMonitoring.processedDataIn;

            // Processed data consumed by output.
            // payload-type: ChannelMeansType
            flow processedDataToOutput : ChannelMeansType
                from acpdCdd.processedDataIn
                to acpdCddOutput.processedDataIn;

            // ADCBIST reference-voltage status consumed by monitoring.
            // payload-type: AdcBistStatusPayloadType
            flow adcBistStatusToMonitoring : AdcBistStatusPayloadType
                from adcBist.adcBistStatusOut
                to acpdCddMonitoring.adcBistStatusIn;

            // Monitoring status consumed by output for qualifier/error reaction.
            // payload-type: MonitoringStatusPayloadType
            flow monitoringStatusToCoordinator : MonitoringStatusPayloadType
                from acpdCddMonitoring.monitoringStatusOut
                to acpdCdd.monitoringStatusIn;

            // Monitoring status consumed by output.
            // payload-type: MonitoringStatusPayloadType
            flow monitoringStatusToOutput : MonitoringStatusPayloadType
                from acpdCdd.monitoringStatusIn
                to acpdCddOutput.monitoringStatusIn;

            // RTE activation status consumed by powermanagement.
            // payload-type: ActivationStatusPayloadType
            flow activationStatusToPowermanagement : ActivationStatusPayloadType
                from rte.activationStatusOut
                to acpdCddPowermanagement.activationStatusOut;

            // Power command from powermanagement to DIO.
            // payload-type: DioCommandPayloadType
            flow powerCommandToDio : DioCommandPayloadType
                from acpdCddPowermanagement.powerCommandOut
                to dio.powerCommandIn;

            // Final processed/qualified signal output to RTE.
            // payload-type: ProcessedSensorOutputPayloadType
            flow sensorOutputToRte : ProcessedSensorOutputPayloadType
                from acpdCddOutput.sensorOutputOut
                to rte.sensorOutputIn;
        }
    }
}

package AcpdCdd_SysMLv2 {

    package ConditionalBehaviorViews {

        private import Types::*;

        // Conditional behavior view.
        // Use this file to visualize decision/merge-style behavior in Eclipse.
        // Sequence ordering remains in 14_ComponentInteractionSequences.sysml.
        // Typed data movement remains in 18_ComponentDataflows.sysml.

        action def AcpdCdd_InputNotificationHandling_Conditional {

            in item notificationPayload : AdcNotificationPayloadType;
            out item inputData : InputDataType;

            action receiveAdcNotification;

            if notificationArrived {
                action updateAdcInputBuffer;
                action updateNotificationTimestamp;
                action clearMissingNotificationCounter;
            }
            else {
                action incrementMissingNotificationCounter;
                action keepPreviousInputBuffer;
            }

            action publishInputData;

            first receiveAdcNotification then notificationArrived;
            first notificationArrived then publishInputData;
        }

        action def AcpdCdd_TimestampSupervision_Conditional {

            in item inputData : InputDataType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            action readNotificationTimestamps;

            if timestampWithinTolerance {
                action markNotificationFresh;
                action keepQualifierCandidateOk;
            }
            else {
                // trlc-satisfies: 28711565
                // trlc-satisfies: 28711591
                action markNotificationStale;
                action requestQualifierErrorReaction;
            }

            action publishMonitoringStatus;

            first readNotificationTimestamps then timestampWithinTolerance;
            first timestampWithinTolerance then publishMonitoringStatus;
        }

        action def AcpdCdd_DeviationCheck_Conditional {

            in item processedData : ChannelMeansType;
            out item monitoringStatus : MonitoringStatusPayloadType;

            action readSensorPairMeans;

            if sensorDeviationWithinLimit {
                action acceptSensorPairPlausible;
                action keepSensorQualifierOk;
            }
            else {
                // trlc-satisfies: 25090543
                action detectSensorPairImplausible;
                action requestSensorQualifierError;
            }

            action publishDeviationCheckResult;

            first readSensorPairMeans then sensorDeviationWithinLimit;
            first sensorDeviationWithinLimit then publishDeviationCheckResult;
        }

        action def AcpdCdd_OutputQualifier_Conditional {

            in item processedData : ChannelMeansType;
            in item monitoringStatus : MonitoringStatusPayloadType;
            out item rteOutput : ProcessedSensorOutputPayloadType;

            action readProcessedDataAndMonitoringStatus;

            if monitoringStatusOk {
                action writeQualifiedSensorValuesToRte;
            }
            else {
                // trlc-satisfies: 28711397
                action forceErrorQualifier;
                action writeErrorQualifiedValuesToRte;
            }

            action publishRteOutput;

            first readProcessedDataAndMonitoringStatus then monitoringStatusOk;
            first monitoringStatusOk then publishRteOutput;
        }

        action def AcpdCdd_Powermanagement_Conditional {

            in item activationStatus : ActivationStatusPayloadType;
            out item dioCommand : DioCommandPayloadType;

            action readActivationStatus;

            if activationRequested {
                action commandPowerOn;
            }
            else {
                action commandPowerOff;
            }

            action publishDioCommand;

            first readActivationStatus then activationRequested;
            first activationRequested then publishDioCommand;
        }

        action def AcpdCdd_Main10ms_ConditionalOverview {

            action collectInputData;
            action checkInputFreshness;
            action computeProcessedSensorValues;
            action checkSensorPlausibility;
            action updateOutputQualifier;
            action writeRteOutput;

            first collectInputData then checkInputFreshness;

            if inputDataFresh {
                action continueWithProcessing;
                first continueWithProcessing then computeProcessedSensorValues;
            }
            else {
                action requestErrorQualifierDueToStaleInput;
                first requestErrorQualifierDueToStaleInput then updateOutputQualifier;
            }

            first computeProcessedSensorValues then checkSensorPlausibility;

            if sensorPairPlausible {
                action keepQualifierOk;
            }
            else {
                action requestErrorQualifierDueToImplausibility;
            }

            first sensorPairPlausible then updateOutputQualifier;
            first updateOutputQualifier then writeRteOutput;
        }
    }
}

package AcpdCdd_SysMLv2 {

    package GoalOrientedSafetyReasoning {

        private import Types::*;

        // Experimental SysML-v2-native FMEA/safety-reasoning model.
        //
        // Main idea:
        //
        // FailureMode is modeled as a part with attributes.
        // The FailureMode assumes the failure condition has happened.
        // The FailureMode has an objective: reach/maintain a safe state.
        // The FailureMode requires one or more ControlMeasures.
        //
        // If required control measures are not present/implemented,
        // the FailureMode exposes a safety gap.
        //
        // This is intentionally one pilot example:
        // AcpdCddSafety.MissingAdcNotification.

        enum def AsilKind {
            enum QM;
            enum ASIL_A;
            enum ASIL_B;
            enum ASIL_C;
            enum ASIL_D;
        }

        enum def FailureModeStateKind {
            enum AssumedOccurred;
            enum Controlled;
            enum Uncontrolled;
        }

        enum def ControlCoverageKind {
            enum NoControlMeasure;
            enum PartialControlMeasure;
            enum FullControlMeasure;
        }

        part def ControlMeasure {
            attribute implemented : boolean;
            attribute verified : boolean;
            attribute description : ScalarValues::String;
        }

        part def FailureMode {
            attribute asil : AsilKind;
            attribute assumedOccurred : boolean;
            attribute controlCoverage : ControlCoverageKind;
            attribute state : FailureModeStateKind;
            attribute hasSafetyGap : boolean;
            attribute localEffect : ScalarValues::String;
            attribute endEffect : ScalarValues::String;
        }

        part def SafetyGap {
            attribute open : boolean;
            attribute reason : ScalarValues::String;
        }

        requirement def Objective_MitigateMissingAdcNotification {
            doc
            /*
            If ADC notification loss/delay is assumed to occur,
            AcpdCdd shall transition to a controlled safe output state.
            */
        }

        requirement def Assume_MissingAdcNotificationOccurred {
            doc
            /*
            ADC Group0, Group1, or Supply notification is missing
            or arrives later than the configured tolerance.
            */
        }

        requirement def Require_TimestampSupervision {
            doc
            /*
            The failure mode requires timestamp/frequency supervision
            as a detection control measure.
            */
        }

        requirement def Require_ErrorQualifierFallback {
            doc
            /*
            The failure mode requires ERROR qualifier fallback
            as a mitigation control measure.
            */
        }

        part def MissingAdcNotification_FailureModeModel {

            // trlc-failure-mode: AcpdCddSafety.MissingAdcNotification

            part missingAdcNotification : FailureMode {
                attribute asil = ASIL_C;
                attribute assumedOccurred = true;
                attribute controlCoverage = FullControlMeasure;
                attribute state = Controlled;
                attribute hasSafetyGap = false;
                attribute localEffect = "ADC input buffer may not be refreshed.";
                attribute endEffect = "Downstream output could use stale sensor information if not mitigated.";
            }

            objective mitigateFailureMode
                : Objective_MitigateMissingAdcNotification;

            assume failureHasOccurred
                : Assume_MissingAdcNotificationOccurred;

            require timestampSupervisionRequired
                : Require_TimestampSupervision;

            require errorQualifierFallbackRequired
                : Require_ErrorQualifierFallback;

            part timestampSupervision : ControlMeasure {
                attribute implemented = true;
                attribute verified = true;
                attribute description = "Detect missing or delayed ADC notifications by timestamp/frequency supervision.";
            }

            part errorQualifierFallback : ControlMeasure {
                attribute implemented = true;
                attribute verified = true;
                attribute description = "Force affected signal qualifier to ERROR when notification freshness is violated.";
            }

            part noControlMeasureGap : SafetyGap {
                attribute open = false;
                attribute reason = "Required control measures are present and implemented.";
            }
        }

        part def MissingAdcNotification_FailureModeGapExample {

            // This second part is intentionally a negative example for checker/demo purposes.
            // It shows the same failure mode if one required control measure were absent.

            part missingAdcNotification : FailureMode {
                attribute asil = ASIL_C;
                attribute assumedOccurred = true;
                attribute controlCoverage = PartialControlMeasure;
                attribute state = Uncontrolled;
                attribute hasSafetyGap = true;
                attribute localEffect = "ADC input buffer may not be refreshed.";
                attribute endEffect = "Stale sensor information may reach output because required mitigation is missing.";
            }

            objective mitigateFailureMode
                : Objective_MitigateMissingAdcNotification;

            assume failureHasOccurred
                : Assume_MissingAdcNotificationOccurred;

            require timestampSupervisionRequired
                : Require_TimestampSupervision;

            require errorQualifierFallbackRequired
                : Require_ErrorQualifierFallback;

            part timestampSupervision : ControlMeasure {
                attribute implemented = true;
                attribute verified = true;
                attribute description = "Detect missing or delayed ADC notifications.";
            }

            part missingErrorQualifierFallbackGap : SafetyGap {
                attribute open = true;
                attribute reason = "ERROR qualifier fallback is required but no implemented ControlMeasure part is present.";
            }
        }

        action def MissingAdcNotification_ControlCoverageBehavior {

            in item notificationPayload : AdcNotificationPayloadType;
            out item monitoringStatus : MonitoringStatusPayloadType;
            out item rteOutput : ProcessedSensorOutputPayloadType;

            action assumeMissingNotificationOccurred;
            action evaluateRequiredControlMeasures;

            if timestampSupervisionImplemented {
                action detectMissingOrDelayedNotification;
            }
            else {
                action exposeDetectionGap;
            }

            if errorQualifierFallbackImplemented {
                action forceErrorQualifier;
            }
            else {
                action exposeMitigationGap;
            }

            if allRequiredControlsImplemented {
                action markFailureModeControlled;
            }
            else {
                action markFailureModeUncontrolled;
            }

            action publishSafetyAnalysisResult;

            first assumeMissingNotificationOccurred
                then evaluateRequiredControlMeasures;

            first evaluateRequiredControlMeasures
                then timestampSupervisionImplemented;

            first timestampSupervisionImplemented
                then errorQualifierFallbackImplemented;

            first errorQualifierFallbackImplemented
                then allRequiredControlsImplemented;

            first allRequiredControlsImplemented
                then publishSafetyAnalysisResult;
        }
    }
}
`;

package AcpdCdd_SysMLv2 {

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
            attribute timestampFresh : boolean;
            attribute group0SampleValid : boolean;
            attribute group1SampleValid : boolean;
            attribute supplySampleValid : boolean;
            attribute sensorPairPlausible : boolean;
            attribute inputDataValid : boolean;
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
            attribute notificationArrived : boolean;
            attribute Group0NotificationArrived : boolean;
            attribute Group1NotificationArrived : boolean;
            attribute SupplyNotificationArrived : boolean;
            item Timestamps : AdcTimestampBufferType;
        }


        // Guard/result semantics for AcpdCdd_AdcGroup0NewData conditional behavior.
        // These Boolean attributes are used directly by guarded successions so visualizers can
        // render dotted conditional arrows with explicit guard labels.
        item def AdcGroup0NewDataDecisionType {
            attribute sampleCountPointerAndRangeValid : boolean;
            attribute group0SampleRangeValid : boolean;
            attribute oldGroup0CacheFilled : boolean;
            attribute bothGroup0AndGroup1Filled : boolean;
            attribute group0SampleAccepted : boolean;
        }


        item def AdcGroupDataReadDecisionType {
            attribute missingEntriesDetected : boolean;
        }

        item def AdcGroup1NewDataDecisionType {
            attribute sampleCountPointerAndRangeValid : boolean;
            attribute group1SampleRangeValid : boolean;
            attribute oldGroup1CacheFilled : boolean;
            attribute bothGroup0AndGroup1Filled : boolean;
            attribute group1SampleAccepted : boolean;
        }

        item def AdcSupplyNewDataDecisionType {
            attribute supplySampleValid : boolean;
            attribute supplySampleRangeValid : boolean;
        }

        item def CollectInputDataDecisionType {
            attribute collectedInputDataValid : boolean;
            attribute collectedInputDataDegraded : boolean;
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

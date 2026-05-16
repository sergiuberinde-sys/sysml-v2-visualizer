package Output {

    private import ScalarValues::*;
    private import Types::*;

    item def CheckAcceleratorDataPointerDecisionType {
        attribute CheckAcceleratorDataPointer_allows_ConvertAcpdCddDataTypeToRteType : Boolean;
        attribute CheckAcceleratorDataPointer_allows_UseDefaultErrorValuesIfNull : Boolean;
    }


    item def OutputReceivesMonitoringStatusDecisionType {
        attribute OutputReceivesAcceleratorData_allows_OutputPreparesRteData : Boolean;
        attribute OutputReceivesAcceleratorData_allows_OutputRequestsSafeDefaultTransmission : Boolean;
    }


    item def ReceiveAcceleratorDataDecisionType {
        attribute ReceiveAcceleratorData_allows_AcpdCdd_UpdateOutput : Boolean;
        attribute ReceiveAcceleratorData_allows_WriteSafeDefaultOutput : Boolean;
    }


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

        action entryStep {
            out item acceleratorData : tAcpdCdd_rc_AccrSnsr;
        }
        first CheckAcceleratorDataPointer;
        action CheckAcceleratorDataPointer {
            out item decision : CheckAcceleratorDataPointerDecisionType;
            in item acceleratorData : tAcpdCdd_rc_AccrSnsr;
            out item validAcceleratorData : tAcpdCdd_rc_AccrSnsr;
            out item invalidAcceleratorData : tAcpdCdd_rc_AccrSnsr;
        }
        action UseDefaultErrorValuesIfNull {
            in item invalidAcceleratorData : tAcpdCdd_rc_AccrSnsr;
            out item defaultRteData : tAcpdCdd_rc_AccrSnsr;
        }
        // trlc-satisfies: 25094059
        action ConvertAcpdCddDataTypeToRteType {
            in item validAcceleratorData : tAcpdCdd_rc_AccrSnsr;
            out item convertedRteData : tAcpdCdd_rc_AccrSnsr;
        }
        action CopySensor1Data;
        action CopySensor2Data;
        action CopySupply1Data;
        action CopySupply2Data;
        action MergeRteData {
            in item convertedRteData : tAcpdCdd_rc_AccrSnsr;
            in item defaultRteData : tAcpdCdd_rc_AccrSnsr;
            out item mergedRteData : tAcpdCdd_rc_AccrSnsr;
        }
        action Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc {
            in item mergedRteData : tAcpdCdd_rc_AccrSnsr;
            out item RteData : tAcpdCdd_rc_AccrSnsr;
        }
        action Return;

        flow from acceleratorData to entryStep.acceleratorData;
first CheckAcceleratorDataPointer then ConvertAcpdCddDataTypeToRteType;
        first CheckAcceleratorDataPointer then UseDefaultErrorValuesIfNull;
        flow from CheckAcceleratorDataPointer.validAcceleratorData to ConvertAcpdCddDataTypeToRteType.validAcceleratorData;
        flow from CheckAcceleratorDataPointer.invalidAcceleratorData to UseDefaultErrorValuesIfNull.invalidAcceleratorData;
        first ConvertAcpdCddDataTypeToRteType then CopySensor1Data;
        first CopySensor1Data then CopySensor2Data;
        first CopySensor2Data then CopySupply1Data;
        first CopySupply1Data then CopySupply2Data;
        first CopySupply2Data then MergeRteData;
        first UseDefaultErrorValuesIfNull then MergeRteData;
        flow from ConvertAcpdCddDataTypeToRteType.convertedRteData to MergeRteData.convertedRteData;
        flow from UseDefaultErrorValuesIfNull.defaultRteData to MergeRteData.defaultRteData;
        first MergeRteData then Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc;
        flow from MergeRteData.mergedRteData to Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc.mergedRteData;
        first Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc then Return;
        flow from Rte_Write_AcpdCdd_rc_AccrSnsrVcc_AcpdCdd_rc_SnsrVcc.RteData to RteData;
    }
    action def AcpdCdd_Output_Behavior {

        first ReceiveAcceleratorData;
        action ReceiveAcceleratorData {
            out item decision : ReceiveAcceleratorDataDecisionType;
        }
        action AcpdCdd_UpdateOutput;
        action WriteSafeDefaultOutput;
        action WriteRteOutput;

        first ReceiveAcceleratorData then AcpdCdd_UpdateOutput;
        first ReceiveAcceleratorData then WriteSafeDefaultOutput;
        first AcpdCdd_UpdateOutput then WriteRteOutput;
        first WriteSafeDefaultOutput then WriteRteOutput;
    }

    part def AcpdCdd_Output {
        port acceleratorDataIn : AcceleratorDataInPort;
        port rteDataOut : RteDataOutPort;

        action updateOutput : AcpdCdd_UpdateOutput;
        action outputBehavior : AcpdCdd_Output_Behavior;
bind rteDataOut.RteData = updateOutput.RteData;
    }

    action def AcpdCdd_Output_Sequence_AsActionFlow {

        first OutputReceivesAcceleratorData;
        action OutputReceivesAcceleratorData;
        action OutputReceivesMonitoringStatus {
            out item decision : OutputReceivesMonitoringStatusDecisionType;
        }
        action OutputPreparesRteData;
        action OutputRequestsSafeDefaultTransmission;
        action OutputRequestsRteTransmission;
        action RtePublishesOutputData;

        first OutputReceivesAcceleratorData then OutputReceivesMonitoringStatus;
        first OutputReceivesMonitoringStatus then OutputPreparesRteData;
        first OutputReceivesMonitoringStatus then OutputRequestsSafeDefaultTransmission;
        first OutputPreparesRteData then OutputRequestsRteTransmission;
        first OutputRequestsSafeDefaultTransmission then OutputRequestsRteTransmission;
        first OutputRequestsRteTransmission then RtePublishesOutputData;
    }


}

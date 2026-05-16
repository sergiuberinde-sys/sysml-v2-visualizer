package Output {

    private import ScalarValues::*;
    private import Types::*;

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

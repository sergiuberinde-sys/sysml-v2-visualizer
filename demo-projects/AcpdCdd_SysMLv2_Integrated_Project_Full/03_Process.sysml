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
            action entry;
            first entry then InitializeProcessWithDefault;
            action InitializeProcessWithDefault;
            action SetProcessingReady;
            first InitializeProcessWithDefault then SetProcessingReady;
        }

        // trlc-satisfies: 44880031
        action def AcpdCdd_Process {
            in item InputData : InputDataType;
            out item ProcessedData : ChannelMeansType;

            action entry {
                out item InputData : InputDataType;
            }
            first entry then CheckInputDataPointer;

            action CheckInputDataPointer {
                in item InputData : InputDataType;
                out item checkedInputData : InputDataType;
                out item invalidInputData : InputDataType;
            }
            attribute CheckInputDataPointer_allows_FetchSensorBuffers : Boolean;
            attribute CheckInputDataPointer_allows_UseDefaultProcessedData : Boolean;

            action FetchSensorBuffers {
                in item InputData : InputDataType;
                out item sensorBuffers : InputDataType;
            }
            // trlc-satisfies: 25094087
            // trlc-satisfies: 28820111
            // trlc-satisfies: 28820750
            action ConvertSensorSamples {
                in item sensorBuffers : InputDataType;
                out item convertedSensorBuffers : InputDataType;
            }
            action SumSensorValues {
                in item convertedSensorBuffers : InputDataType;
                out item summedSensorValues : ChannelMeansType;
            }
            // trlc-satisfies: 28824427
            action ComputeChannelMeans {
                in item summedSensorValues : ChannelMeansType;
                out item computedChannelMeans : ChannelMeansType;
            }
            action UseDefaultProcessedData {
                in item invalidInputData : InputDataType;
                out item defaultProcessedData : ChannelMeansType;
            }
            action MergeProcessedData {
                in item nominalProcessedData : ChannelMeansType;
                in item fallbackProcessedData : ChannelMeansType;
                out item mergedProcessedData : ChannelMeansType;
            }
            action ReturnProcessedData {
                in item mergedProcessedData : ChannelMeansType;
                out item ProcessedData : ChannelMeansType;
            }

            flow from InputData to entry.InputData;
            flow from entry.InputData to CheckInputDataPointer.InputData;

            first CheckInputDataPointer if CheckInputDataPointer_allows_FetchSensorBuffers then FetchSensorBuffers;
            first CheckInputDataPointer if CheckInputDataPointer_allows_UseDefaultProcessedData then UseDefaultProcessedData;

            flow from CheckInputDataPointer.checkedInputData to FetchSensorBuffers.InputData;
            flow from CheckInputDataPointer.invalidInputData to UseDefaultProcessedData.invalidInputData;

            first FetchSensorBuffers then ConvertSensorSamples;
            flow from FetchSensorBuffers.sensorBuffers to ConvertSensorSamples.sensorBuffers;

            first ConvertSensorSamples then SumSensorValues;
            flow from ConvertSensorSamples.convertedSensorBuffers to SumSensorValues.convertedSensorBuffers;

            first SumSensorValues then ComputeChannelMeans;
            flow from SumSensorValues.summedSensorValues to ComputeChannelMeans.summedSensorValues;

            first ComputeChannelMeans then MergeProcessedData;
            first UseDefaultProcessedData then MergeProcessedData;
            flow from ComputeChannelMeans.computedChannelMeans to MergeProcessedData.nominalProcessedData;
            flow from UseDefaultProcessedData.defaultProcessedData to MergeProcessedData.fallbackProcessedData;

            first MergeProcessedData then ReturnProcessedData;
            flow from MergeProcessedData.mergedProcessedData to ReturnProcessedData.mergedProcessedData;
            flow from ReturnProcessedData.ProcessedData to ProcessedData;
        }

        action def AcpdCdd_Process_Behavior {
            action entry;
            first entry then AcpdCdd_StartProcessing;
            attribute StartProcessing_allows_ProcessCycle : Boolean;
            attribute StartProcessing_allows_StopProcessing : Boolean;
            action AcpdCdd_StartProcessing;
            action AcpdCdd_Process;
            action StopProcessing;
            action Return;

            first AcpdCdd_StartProcessing if StartProcessing_allows_ProcessCycle then AcpdCdd_Process;
            first AcpdCdd_StartProcessing if StartProcessing_allows_StopProcessing then StopProcessing;
            first AcpdCdd_Process then Return;
            first StopProcessing then Return;
        }

        part def AcpdCdd_Process {
            port inputDataIn : InputDataInPort;
            port processedDataOut : ChannelMeansOutPort;

            action startProcessing;
            action process;
            action processBehavior;
        }

        action def AcpdCdd_Process_Sequence_AsActionFlow {

            action entry;
            first entry then ProcessReceivesInputData;
            attribute ProcessReceivesInputData_allows_ProcessCalculatesAcceleratorPosition : Boolean;
            attribute ProcessReceivesInputData_allows_ProcessPublishesDefaultProcessedData : Boolean;
            action ProcessReceivesInputData;
            action ProcessCalculatesAcceleratorPosition;
            action ProcessGeneratesProcessedData;
            action ProcessPublishesDefaultProcessedData;
            action ProcessPublishesProcessedData;

            first ProcessReceivesInputData if ProcessReceivesInputData_allows_ProcessCalculatesAcceleratorPosition then ProcessCalculatesAcceleratorPosition;
            first ProcessReceivesInputData if ProcessReceivesInputData_allows_ProcessPublishesDefaultProcessedData then ProcessPublishesDefaultProcessedData;
            first ProcessCalculatesAcceleratorPosition then ProcessGeneratesProcessedData;
            first ProcessGeneratesProcessedData then ProcessPublishesProcessedData;
            first ProcessPublishesDefaultProcessedData then ProcessPublishesProcessedData;
        }


    }
}

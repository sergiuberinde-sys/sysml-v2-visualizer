package AcpdCdd_SysMLv2 {
    package Process {

        private import ScalarValues::*;
        private import AcpdCdd_SysMLv2::Types::*;
	private import ScalarValues::Boolean;

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
flow from InputData to CheckInputDataPointer.InputData;
                first CheckInputDataPointer if CheckInputDataPointer_allows_FetchSensorBuffers then FetchSensorBuffers;
                first CheckInputDataPointer if not CheckInputDataPointer_allows_FetchSensorBuffers then UseDefaultProcessedData;
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
action AcpdCdd_Process;
            action ReturnProcessedData;

            first AcpdCdd_Process then ReturnProcessedData;
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
            action FetchSensorBuffers;
            action ConvertSensorSamples;
            action SumSensorValues;
            action ComputeChannelMeans;
            action ReturnProcessedData;

            first ProcessReceivesInputData then FetchSensorBuffers;
            first FetchSensorBuffers then ConvertSensorSamples;
            first ConvertSensorSamples then SumSensorValues;
            first SumSensorValues then ComputeChannelMeans;
            first ComputeChannelMeans then ReturnProcessedData;
        }



    }
}

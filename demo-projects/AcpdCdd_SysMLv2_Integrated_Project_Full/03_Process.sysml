package Process {

    private import ScalarValues::*;
    private import Types::*;

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

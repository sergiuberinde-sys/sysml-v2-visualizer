package AllocationUsage {
    part def Sensor;
    part def ECU;

    allocation def SensorToECU {
        end sensorEnd : Sensor;
        end ecuEnd : ECU;
    }

    part def System {
        part sensor : Sensor;
        part ecu : ECU;
        allocation alloc1 : SensorToECU;
    }
}

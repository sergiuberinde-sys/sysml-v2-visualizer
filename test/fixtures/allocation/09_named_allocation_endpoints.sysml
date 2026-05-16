package NamedAllocationEndpoints {
    part def Sensor;
    part def ECU;

    allocation def SensorAlloc {
        end sensorEnd : Sensor;
        end ecuEnd : ECU;
    }

    part def System {
        part s : Sensor;
        part e : ECU;

        allocation a1 : SensorAlloc {
            end sensorEnd references s;
            end ecuEnd references e;
        }
    }
}

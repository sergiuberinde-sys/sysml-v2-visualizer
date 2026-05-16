package ReferenceUsageExample {
    part def Sensor;
    part def Controller;

    part def AutomotiveSystem {
        part ctrl : Controller;
        ref part sensorRef : Sensor;
    }
}

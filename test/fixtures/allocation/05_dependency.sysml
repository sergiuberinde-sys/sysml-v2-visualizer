package DependencyExample {
    part def Sensor;
    part def Controller;

    dependency controllerOnSensor from Controller to Sensor;
}

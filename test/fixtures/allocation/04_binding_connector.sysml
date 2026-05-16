package BindingExample {
    attribute def Speed;

    part def WheelSensor {
        attribute speed : Speed;
    }

    part def Controller {
        attribute speed : Speed;
        part sensor : WheelSensor;
        bind speed = sensor.speed;
    }
}

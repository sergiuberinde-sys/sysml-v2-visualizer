package ExecSpecTest {

    part def Controller;
    part def Sensor;
    part def Actuator;

    occurrence def ReadAndActuate {
        part ctrl : Controller;
        part sensor : Sensor;
        part act : Actuator;

        message req   from ctrl   to sensor;
        message resp  from sensor to ctrl;
        message cmd   from ctrl   to act;
        message ack   from act    to ctrl;
    }
}

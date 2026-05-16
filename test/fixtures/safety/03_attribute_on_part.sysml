package AttributeOnPart {
    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    part def BrakeController {
        attribute asil : ASIL;
    }

    part def SteeringController {
        attribute asil : ASIL;
    }
}

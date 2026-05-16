package AttributeValue {
    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    requirement def BrakeResponse {
        attribute asil : ASIL = ASIL::B;
    }

    requirement def SafeStop {
        attribute asil : ASIL = ASIL::D;
    }

    part def BrakeController {
        attribute asil : ASIL = ASIL::B;
    }

    part def Pump {
        attribute asil : ASIL = ASIL::QM;
    }
}

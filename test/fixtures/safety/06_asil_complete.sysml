package ASILComplete {
    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    requirement def BrakeResponse {
        attribute asil : ASIL = ASIL::B;
        doc /* Brake system shall respond within 200ms. */
    }

    requirement def SafeStop {
        attribute asil : ASIL = ASIL::D;
    }

    part def BrakeController {
        attribute asil : ASIL = ASIL::B;
        requirement brakeReq : BrakeResponse;
        requirement stopReq : SafeStop;
    }

    part def Pump {
        attribute asil : ASIL = ASIL::QM;
    }
}

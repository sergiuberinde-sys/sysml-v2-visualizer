package AttributeOnReq {
    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    requirement def BrakeResponse {
        attribute asil : ASIL;
    }

    requirement def SafeStop {
        attribute asil : ASIL;
    }
}

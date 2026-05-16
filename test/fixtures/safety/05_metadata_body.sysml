package MetadataBody {
    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    metadata def SafetyAnnotation {
        attribute asil : ASIL;
    }

    part def BrakeController {
        @SafetyAnnotation { asil = ASIL::D; }
    }

    requirement def BrakeResponse {
        @SafetyAnnotation { asil = ASIL::B; }
    }
}

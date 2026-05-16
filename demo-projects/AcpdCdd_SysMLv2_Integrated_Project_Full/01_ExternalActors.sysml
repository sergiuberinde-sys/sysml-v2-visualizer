package ExternalActors {

    private import Types::*;

    port def AdcNotificationOutPort {
        out item adcSample : AdcNotificationPayloadType;
    }

    port def VARefErrorStatusOutPort {
        out attribute errorPresent;
    }

    port def ActivationOutPort {
        out attribute activation;
    }

    port def RteAcceleratorDataInPort {
        in item acceleratorData : tAcpdCdd_rc_AccrSnsr;
    }

    part def ADC {


    }

    part def AdcBist {


    }

    part def RTE {


    }
}

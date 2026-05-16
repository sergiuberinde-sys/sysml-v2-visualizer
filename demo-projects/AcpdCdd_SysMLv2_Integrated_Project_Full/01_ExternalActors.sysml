
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
        port group0Notification;
        port group1Notification;
        port supplyNotification;
    }

    part def AdcBist {
        port varef1ErrorStatusOut;
        port varef2ErrorStatusOut;
    }

    part def RTE {
        port activationOut;
        port acceleratorDataIn;
    }
}

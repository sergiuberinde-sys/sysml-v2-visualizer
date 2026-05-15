/**
 * AcpdCdd ECU — Automotive Showcase Demo
 *
 * Demonstrates official SysML v2 (Pilot 0.59.0-SNAPSHOT) semantics:
 *   - structural decomposition (part def + port def)
 *   - port-level connections (connect ... to ...)
 *   - behavior flows  (action def + succession)
 *   - safety metadata (enum def ASIL + attribute)
 *   - requirements    (requirement def + attribute + doc)
 *   - requirement usages on components
 *
 * Topology (linear chain):
 *   InputModule ──AdcDataBus──► ProcessingModule ──ProcessingBus──► MonitoringModule ──ActuationBus──► OutputModule
 *
 * Behavior (ADC notification flow, owned by ProcessingModule):
 *   read ──► evaluate ──► monitor ──► activate
 */

package AcpdCdd {

    // ── Safety integrity levels ───────────────────────────────────────────────

    enum def ASIL {
        enum QM;
        enum A;
        enum B;
        enum C;
        enum D;
    }

    // ── Item (data payload) definitions ──────────────────────────────────────

    item def AdcSample;
    item def ProcessedSignal;
    item def HealthReport;
    item def ActuationCommand;

    // ── Interface (bus) definitions ───────────────────────────────────────────

    interface def AdcDataBus;
    interface def ProcessingBus;
    interface def ActuationBus;

    // ── Reusable action definitions ───────────────────────────────────────────

    action def ReadAdcSensor;
    action def EvaluateAdcData;
    action def MonitorSystemHealth;
    action def ActivateOutput;

    // ── Component definitions ─────────────────────────────────────────────────

    part def InputModule {
        port dataOut : AdcDataBus;

        item rawSample : AdcSample;

        attribute asil : ASIL = ASIL::B;

        requirement rawAcqReq : RawDataAcquisition;
    }

    part def ProcessingModule {
        port dataIn  : AdcDataBus;
        port ctrlOut : ProcessingBus;

        item inputData   : AdcSample;
        item outputData  : ProcessedSignal;

        attribute asil : ASIL = ASIL::D;

        requirement procAccReq : ProcessingAccuracy;

        /**
         * ADC notification flow: sequential activation of the signal chain.
         * Reads ADC sample → evaluates data → monitors health → drives output.
         */
        action def AdcNotificationFlow {
            action read     : ReadAdcSensor;
            action evaluate : EvaluateAdcData;
            action monitor  : MonitorSystemHealth;
            action activate : ActivateOutput;

            first read     then evaluate;
            first evaluate then monitor;
            first monitor  then activate;
        }
    }

    part def MonitoringModule {
        port ctrlIn : ProcessingBus;
        port actOut : ActuationBus;

        item signal  : ProcessedSignal;
        item report  : HealthReport;

        attribute asil : ASIL = ASIL::B;

        requirement sysMonReq : SystemMonitoring;
    }

    part def OutputModule {
        port actIn : ActuationBus;

        item command : ActuationCommand;

        attribute asil : ASIL = ASIL::C;

        requirement safeActReq : SafeActuation;
    }

    // ── Top-level ECU system assembly ─────────────────────────────────────────

    part def AcpdECU {
        part inputMod  : InputModule;
        part procMod   : ProcessingModule;
        part monMod    : MonitoringModule;
        part outputMod : OutputModule;

        connect inputMod.dataOut to procMod.dataIn;
        connect procMod.ctrlOut  to monMod.ctrlIn;
        connect monMod.actOut    to outputMod.actIn;
    }

    // ── Requirement definitions ───────────────────────────────────────────────

    requirement def RawDataAcquisition {
        attribute asil : ASIL = ASIL::B;
        doc /* Input module shall acquire raw ADC samples within 1 ms
               under all operating conditions. */
    }

    requirement def ProcessingAccuracy {
        attribute asil : ASIL = ASIL::D;
        doc /* Processing module shall evaluate ADC data with accuracy
               sufficient for safe actuation decisions (ASIL D). */
    }

    requirement def SystemMonitoring {
        attribute asil : ASIL = ASIL::B;
        doc /* Monitoring module shall detect critical system faults
               within 10 ms of occurrence. */
    }

    requirement def SafeActuation {
        attribute asil : ASIL = ASIL::C;
        doc /* Output module shall respond to actuation commands
               within 5 ms and hold the safe state on fault detection. */
    }

    requirement def EndToEndLatency {
        attribute asil : ASIL = ASIL::D;
        doc /* End-to-end latency from ADC sample acquisition to output
               actuation shall not exceed 20 ms under nominal load. */
    }
}

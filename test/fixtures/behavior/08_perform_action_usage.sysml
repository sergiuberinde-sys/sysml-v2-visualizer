// Regression fixture: PerformActionUsage — typed perform in a control sequence
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior:
//   ControlLoop contains: init (ActionUsage), cal (PerformActionUsage), execute (ActionUsage)
//   cal is typed by Calibrate (FeatureTyping child)
//   Succession: init → cal → execute
//   Calibrate internal structure (measure, adjust) is a SEPARATE ActionDefinition scope
//   No cross-definition edges are extracted — cal's internals are NOT in ControlLoop's flow
package PerformFullTest {
    action def Calibrate {
        action measure;
        action adjust;
        succession first measure then adjust;
    }

    action def ControlLoop {
        action init;
        perform action cal : Calibrate;
        action execute;
        succession first init then cal;
        succession first cal then execute;
    }
}

// Regression fixture: IfActionUsage with then and else branches
// Validated against Pilot Implementation 0.59.0-SNAPSHOT
// success: false (ScalarValues::Boolean not resolved) but model present
// Expected behavior:
//   condition: ready (FeatureReference)
//   then branch: action ok
//   else branch: action fault
//   no anonymous ActionUsage nodes rendered
package BehaviorIfTest {
    action def Main {
        attribute ready : ScalarValues::Boolean;

        if ready {
            action ok;
        } else {
            action fault;
        }
    }
}

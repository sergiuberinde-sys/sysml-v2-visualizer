// Regression fixture: WhileLoopActionUsage — loop...until form
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior:
//   condition: done (FeatureReference, at ParameterMembership[2])
//   body action: step
//   no anonymous ActionUsage nodes rendered
package BehaviorLoopTest {
    action def Done;
    action def Main {
        attribute done : Done;
        loop {
            action step;
        } until done;
    }
}

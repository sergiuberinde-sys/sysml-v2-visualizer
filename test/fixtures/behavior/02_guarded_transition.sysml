// Regression fixture: guarded transition (TransitionUsage)
// Validated against Pilot Implementation 0.59.0-SNAPSHOT
// success: false (ScalarValues::Boolean not resolved without std lib) but model present
// Expected behavior: actions a, b; flow a -> b; type: transition; guard: ready
package BehaviorGuardedTransitionTest {
    action def Main {
        action a;
        action b;
        attribute ready : ScalarValues::Boolean;
        first a if ready then b;
    }
}

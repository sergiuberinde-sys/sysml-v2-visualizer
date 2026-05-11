// Regression fixture: unguarded succession
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior: actions a, b; flow a -> b; type: succession; no guard
package BehaviorSuccessionTest {
    action def Main {
        action a;
        action b;
        succession first a then b;
    }
}

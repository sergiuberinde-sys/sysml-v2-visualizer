// Regression fixture: ForkNode and JoinNode
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior: ForkNode and JoinNode rendered as «fork» / «join» nodes
// No implicit edges extracted (control flow is implicit in SysML v2)
package ControlNodeTest {
    action def A; action def B; action def C; action def D;
    action def ForkJoinFlow {
        action a : A;
        fork;
        action b : B;
        action c : C;
        join;
        action d : D;
    }
}

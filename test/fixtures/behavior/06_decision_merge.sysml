// Regression fixture: DecisionNode (named) with incoming succession + MergeNode
// Validated against Pilot Implementation 0.59.0-SNAPSHOT — success: true
// Expected behavior:
//   DecisionNode 'd' rendered as «decide» node
//   MergeNode rendered as «merge» node
//   Incoming succession a -> d: resolved (source: a, target: d)
//   Outgoing successions d -> b, d -> c: unresolved (known Pilot NPE, filtered out)
package DecisionMergeTest {
    action def A; action def B; action def C;
    action def Flow {
        action a : A;
        decide d;
        action b : B;
        action c : C;
        merge;
        succession first a then d;
        succession first d then b;
        succession first d then c;
    }
}

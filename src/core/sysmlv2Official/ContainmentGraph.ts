/**
 * Containment graph derived from the official SysML v2 EMF model tree.
 *
 * Edge types:
 *   'contains'   — EMF eContents() ownership (parent → child)
 *   'typedBy'    — FeatureTyping cross-reference resolved by the adapter
 *                  (usage → definition); only present when the type name can be
 *                  resolved to a named definition node in the same graph.
 *   'connection' — ConnectionUsage endpoint resolved via ReferenceSubsetting
 *                  cross-reference (portA → portB); only present when both
 *                  endpoints resolve to PortUsage nodes in the same graph.
 */
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  direction?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'typedBy' | 'connection';
}

export interface ContainmentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

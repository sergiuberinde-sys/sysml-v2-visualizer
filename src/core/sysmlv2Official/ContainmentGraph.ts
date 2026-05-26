/**
 * Containment graph derived from the official SysML v2 EMF model tree.
 *
 * Edge types:
 *   'contains'       — EMF eContents() ownership (parent → child)
 *   'typedBy'        — FeatureTyping cross-reference resolved by the adapter
 *                      (usage → definition); only present when the type name can
 *                      be resolved to a named definition node in the same graph.
 *   'connection'     — Structural wiring: ConnectionUsage / FlowConnectionUsage /
 *                      structural FlowUsage endpoint resolved to PortUsage nodes.
 *   'message'        — Behavioural message: FlowUsage with message syntax inside
 *                      a PartDefinition scope, resolved to PartUsage participant
 *                      nodes (no ports involved).
 *   'specialization' — Superclassing (`:>`) between PartDefinitions:
 *                      source is the specific/sub def, target is the general/super def.
 *   'subsetting'     — Subsetting (`:>>`) between PartUsages:
 *                      source is the subsetting usage, target is the subsetted usage.
 */
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  direction?: string;
  isComposite?: boolean;
  startLine?: number;
  endLine?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'typedBy' | 'connection' | 'message' | 'specialization' | 'subsetting';
  label?: string;
}

export interface ContainmentGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

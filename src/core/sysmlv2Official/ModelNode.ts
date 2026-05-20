/**
 * Raw EMF containment tree node emitted by the Java parser wrapper.
 *
 * Each node mirrors one EObject: type comes from eClass().getName(),
 * name from the "name" structural feature (null when absent), and
 * children from eContents() — owned containment only, no cross-references.
 */
export interface ModelNode {
  type: string;
  name: string | null;
  direction?: string | null;
  /** false when the feature is declared with 'ref' (non-composite shared aggregation). */
  isComposite?: boolean;
  /** 1-based start line from Xtext parse tree (0 = unavailable). */
  startLine?: number;
  /** 1-based end line from Xtext parse tree (0 = unavailable). */
  endLine?: number;
  children: ModelNode[];
}

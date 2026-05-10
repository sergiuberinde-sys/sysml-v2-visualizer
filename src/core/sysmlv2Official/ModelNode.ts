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
  children: ModelNode[];
}

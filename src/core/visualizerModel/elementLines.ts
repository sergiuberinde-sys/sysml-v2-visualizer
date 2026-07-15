import type { SysMLNode, PackageDefNode } from '../modelTypes';

/**
 * Collect the source line numbers occupied by the element named `name` (and its
 * direct body members) within a VisualizerModel. Pure tree scan over the adapter
 * output — parser-agnostic. Used by the Inspector to highlight related diagnostics.
 */
export function elementLines(
  name: string,
  namespace: string | undefined,
  nodes: SysMLNode[],
  packages: PackageDefNode[],
): Set<number> {
  const lines = new Set<number>();

  function scanNodes(ns: SysMLNode[]) {
    for (const node of ns) {
      if ('name' in node && (node as { name: string }).name === name) {
        lines.add((node as { line: number }).line);
        if ('body' in node) {
          for (const child of (node as { body: SysMLNode[] }).body) {
            if ('line' in child) lines.add((child as { line: number }).line);
          }
        }
      }
      if ('body' in node) scanNodes((node as { body: SysMLNode[] }).body);
    }
  }

  function scanPkgs(pkgs: PackageDefNode[]) {
    for (const pkg of pkgs) {
      if (pkg.name === name && (namespace === undefined || pkg.namespace === namespace)) {
        lines.add(pkg.line);
      }
      scanPkgs(pkg.body.filter((n): n is PackageDefNode => n.kind === 'packageDef'));
    }
  }

  scanNodes(nodes);
  scanPkgs(packages);
  return lines;
}

import type { ASTNode, ASTResult } from '../ast/astTypes';
import type { SysMLNode, PackageDefNode } from '../modelTypes';

export interface SemanticModel {
  nodes: SysMLNode[];
  packages: PackageDefNode[];
}

export function buildModel(astResult: ASTResult): SemanticModel {
  const topSysMLNodes: SysMLNode[] = [];
  for (const node of astResult.nodes) {
    const sysmlNode = astToSysMLNode(node, []);
    if (sysmlNode !== null) {
      topSysMLNodes.push(sysmlNode);
    }
  }
  const { flatNodes, packages } = flattenPackages(topSysMLNodes);
  return { nodes: flatNodes, packages };
}

function astToSysMLNode(node: ASTNode, namespaceStack: string[]): SysMLNode | null {
  const ns = namespaceStack.join('::');

  switch (node.kind) {
    case 'unsupported':
      return null;

    case 'package':
      return { kind: 'package', name: node.name, line: node.line };

    case 'packageDef': {
      const childNs = [...namespaceStack, node.name];
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, childNs);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'packageDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'interfaceDef':
      return { kind: 'interfaceDef', name: node.name, namespace: ns, line: node.line };

    case 'partDef': {
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, namespaceStack);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'partDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'occurrenceDef': {
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, namespaceStack);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'occurrenceDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'behaviorDef': {
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, namespaceStack);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'behaviorDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'stateDef': {
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, namespaceStack);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'stateDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'requirementDef':
      return { kind: 'requirementDef', name: node.name, namespace: ns, reqId: node.reqId, text: node.text, priority: node.priority, line: node.line, endLine: node.endLine };

    case 'port':
      return { kind: 'port', name: node.name, direction: node.direction, portType: node.portType, line: node.line };

    case 'itemDef': {
      const childSysMLNodes: SysMLNode[] = [];
      for (const child of node.children) {
        const sysmlChild = astToSysMLNode(child, namespaceStack);
        if (sysmlChild !== null) childSysMLNodes.push(sysmlChild);
      }
      return { kind: 'itemDef', name: node.name, namespace: ns, body: childSysMLNodes, line: node.line, endLine: node.endLine };
    }

    case 'itemAlias':
      return { kind: 'itemAlias', name: node.name, type: node.type, line: node.line };

    case 'partAlias':
      return { kind: 'partAlias', name: node.name, type: node.type, line: node.line };

    case 'connection':
      return { kind: 'connection', fromPart: node.fromPart, fromPort: node.fromPort, toPart: node.toPart, toPort: node.toPort, line: node.line };

    case 'message':
      return { kind: 'message', name: node.name, from: node.from, to: node.to, occurrence: node.occurrence, fromColumn: node.fromColumn, toColumn: node.toColumn, line: node.line };

    case 'actionDef':
      return { kind: 'actionDef', name: node.name, namespace: ns, line: node.line };

    case 'actionInst':
      return { kind: 'actionInst', name: node.name, actionType: node.actionType, line: node.line };

    case 'flow':
      return { kind: 'flow', from: node.from, to: node.to, line: node.line };

    case 'stateEntry':
      return { kind: 'stateEntry', name: node.name, line: node.line };

    case 'transition':
      return { kind: 'transition', from: node.from, to: node.to, event: node.event, line: node.line };

    case 'traceLink':
      return { kind: 'traceLink', namespace: ns, linkType: node.linkType, source: node.source, target: node.target, line: node.line };
  }
}

function flattenPackages(topNodes: SysMLNode[]): { flatNodes: SysMLNode[]; packages: PackageDefNode[] } {
  const packages = topNodes.filter((n): n is PackageDefNode => n.kind === 'packageDef');
  const flatNodes: SysMLNode[] = [];
  function walk(nodes: SysMLNode[]) {
    for (const n of nodes) {
      if (n.kind === 'packageDef') walk(n.body);
      else flatNodes.push(n);
    }
  }
  walk(topNodes);
  return { flatNodes, packages };
}

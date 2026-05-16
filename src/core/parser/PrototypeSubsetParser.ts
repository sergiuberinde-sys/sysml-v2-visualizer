/**
 * The legacy prototype-subset parser wrapped as an IParser implementation.
 *
 * This is a temporary prototype parser, not SysML v2 compliant.
 *
 * It parses a custom invented language that loosely resembles SysML v2 syntax
 * but does not follow the official OMG specification.  It exists only to keep
 * existing demos, tests, and the VS Code extension working while official SysML
 * v2 integration is in progress.
 *
 * This class is a thin adapter over the frozen `astParser.ts` → `analyzeSysML`
 * → `legacySubsetAdapter` pipeline.  The underlying `astParser.ts` is FROZEN —
 * do not add grammar rules there.
 *
 * See src/core/parserMode.ts and docs/FULL_SYSML_V2_ROADMAP.md.
 */

import { parseAndValidate } from '../modelBuilder';
import { convert } from '../adapters/legacySubsetAdapter';
import type { IParser } from './IParser';
import type { VisualizerModel } from '../visualizerModel';

export class PrototypeSubsetParser implements IParser {
  readonly name = 'legacySubset' as const;

  parse(text: string): VisualizerModel {
    return convert(parseAndValidate(text));
  }
}

/** The active legacy-subset parser instance. */
export const prototypeSubsetParser: IParser = new PrototypeSubsetParser();

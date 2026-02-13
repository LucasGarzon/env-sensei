import * as ts from 'typescript';
import { Detection, DetectorHeuristic, EnvSenseiConfig } from '../types';
import { KeyBasedDetector } from './keyBasedDetector';
import { HeaderBasedDetector } from './headerBasedDetector';
import { PatternBasedDetector } from './patternBasedDetector';
import { ConfigBasedDetector } from './configBasedDetector';
import { toEnvVarName } from '../utils/naming';

export class Detector {
  private heuristics: DetectorHeuristic[];
  private prefix: string;

  constructor(config: EnvSenseiConfig) {
    this.prefix = config.envVarPrefix;
    this.heuristics = [
      new KeyBasedDetector(),
      new HeaderBasedDetector(),
      new PatternBasedDetector(),
      new ConfigBasedDetector(),
    ];
  }

  analyze(sourceFile: ts.SourceFile): Detection[] {
    const detections: Detection[] = [];
    const seenRanges = new Set<string>();

    const visit = (node: ts.Node) => {
      for (const heuristic of this.heuristics) {
        const results = heuristic.detect(sourceFile, node);
        for (const detection of results) {
          const rangeKey = `${detection.range.start.line}:${detection.range.start.character}-${detection.range.end.line}:${detection.range.end.character}`;
          if (!seenRanges.has(rangeKey)) {
            seenRanges.add(rangeKey);
            // Apply prefix if configured
            if (this.prefix) {
              detection.proposedEnvVarName = toEnvVarName(
                detection.proposedEnvVarName,
                this.prefix
              );
            }
            detections.push(detection);
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return detections;
  }
}

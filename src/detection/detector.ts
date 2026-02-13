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
  private ignoredWords: string[];

  constructor(config: EnvSenseiConfig) {
    this.prefix = config.envVarPrefix;
    this.ignoredWords = config.ignoredWords
      .map(word => word.trim().toLowerCase())
      .filter(Boolean);
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
          if (this.shouldIgnoreDetection(detection)) {
            continue;
          }
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

  private shouldIgnoreDetection(detection: Detection): boolean {
    if (this.ignoredWords.length === 0) {
      return false;
    }

    const candidates = [
      detection.identifierHint,
      detection.proposedEnvVarName,
      detection._rawValue,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.toLowerCase());

    return this.ignoredWords.some(word =>
      candidates.some(candidate => candidate.includes(word))
    );
  }
}

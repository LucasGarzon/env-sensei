import * as vscode from 'vscode';
import { Detection, EnvSenseiConfig } from '../types';
import { Detector } from '../detection/detector';
import { parseSource } from '../utils/astHelpers';
import { DIAGNOSTIC_SOURCE } from '../constants';

export class DiagnosticsManager implements vscode.Disposable {
  private collection: vscode.DiagnosticCollection;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private detectionStore: Map<string, Detection[]> = new Map();
  private detector: Detector;
  private config: EnvSenseiConfig;

  constructor(config: EnvSenseiConfig) {
    this.config = config;
    this.detector = new Detector(config);
    this.collection = vscode.languages.createDiagnosticCollection('env-sensei');
  }

  updateConfig(config: EnvSenseiConfig): void {
    this.config = config;
    this.detector = new Detector(config);
  }

  scheduleAnalysis(document: vscode.TextDocument): void {
    const uriKey = document.uri.toString();

    const existing = this.debounceTimers.get(uriKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(uriKey);
      this.analyzeDocument(document);
    }, 300);

    this.debounceTimers.set(uriKey, timer);
  }

  analyzeDocument(document: vscode.TextDocument): Detection[] {
    const sourceFile = parseSource(document.getText(), document.fileName);
    const detections = this.detector.analyze(sourceFile);

    this.detectionStore.set(document.uri.toString(), detections);

    const diagnostics = detections.map(d => {
      const severity = d.category === 'secret'
        ? this.config.severitySecrets
        : this.config.severityConfig;

      const diagnostic = new vscode.Diagnostic(d.range, d.message, severity);
      diagnostic.source = DIAGNOSTIC_SOURCE;
      return diagnostic;
    });

    this.collection.set(document.uri, diagnostics);
    return detections;
  }

  getDetections(uri: vscode.Uri): Detection[] {
    return this.detectionStore.get(uri.toString()) || [];
  }

  clearDocument(uri: vscode.Uri): void {
    const uriKey = uri.toString();
    this.collection.delete(uri);
    this.detectionStore.delete(uriKey);
    const timer = this.debounceTimers.get(uriKey);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(uriKey);
    }
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.detectionStore.clear();
    this.collection.dispose();
  }
}

export { extractNames } from './ast';
export { evaluateCheck, evaluateChecks } from './evaluate';
export { checkTaskReference } from './reference-check';
export { validateTaskChecks } from './validate';
export {
  boundingBox,
  isClosed,
  normalizeSegments,
  shapeContains,
  shapesMatch,
  totalLength
} from './geometry';
export { extractNumbers, lastLine, normalizeText } from './text';
export type {
  Check,
  CheckReport,
  CheckResult,
  Evidence,
  ReferenceArtifacts,
  ShapeNormalization,
  Submission
} from './types';
export { evaluateAgainstOwnRun, evaluatePredictionAgainstOwnRun, evaluateRun } from './reference-check';
export type {
  CheckRunOutcome,
  ReferenceCheckFailure,
  ReferenceCheckOutcome,
  ReferenceCheckTask,
  RunOutcome,
  RunPython
} from './reference-check';
export type { ValidationError, TaskShape } from './validate';

export { evaluateCheck, evaluateChecks } from './evaluate';
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
export type { ValidationError, TaskShape } from './validate';

/** The race board as the room reads it (`GET /api/sessions/[code]/race`). */
import type { OwnStanding } from './race';

export interface RaceBoardRow {
  name: string;
  points: number;
  place: number;
  /** This row is the student asking. */
  me: boolean;
}

export interface RaceBoard {
  /** The finish line: the most points one student can get. */
  possible: number;
  /** Only students who have scored, best first. */
  top: RaceBoardRow[];
  me: OwnStanding | null;
}

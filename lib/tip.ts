// Tip duel: guess which professor the crowd picked. Shared by server and client.
//
// Two students answer the same QUESTIONS duels, one after the other: the first creates the
// match, the next student from another clan plays the same questions later. Nobody waits online.
// Tip duels only run during a league weekend (Friday 18:00 to Sunday 24:00): every match is
// against the weekend opponent's clan and every win counts for your own clan.

import type { Prof } from './types';

export const QUESTIONS = 5;
/** A pair needs this many votes before the crowd's pick means anything */
export const MIN_PAIR_VOTES = 3;
/** Weekend League: each tip-duel win adds this many counted duels for the clan … */
export const TIP_POINTS = 2;
/** … for at most this many wins per member and weekend */
export const TIP_CAP = 3;

export type TipQuestion = { left: Prof; right: Prof };
export type TipReveal = { correct: boolean; answer: number; share: number };

/** expired: a weekend match nobody from the opponent clan answered before the weekend ended */
export type TipStatus = 'playing' | 'waiting' | 'expired' | 'won' | 'lost' | 'draw';
export type TipMatchView = {
  id: number; status: TipStatus; league: boolean;
  myScore: number | null; oppScore: number | null; oppDept: number | null;
};

export type TipGame = TipMatchView & {
  questions: TipQuestion[];
  /** reveals of the questions already answered, in order */
  answered: TipReveal[];
};

export type TipAnswer = TipReveal & { match: TipMatchView };

export type TipState = {
  open: boolean;
  /** ISO times of the current (open) or next weekend */
  opensAt: string; closesAt: string;
  /** your clan's opponent that weekend */
  rival: number | null;
  /** your wins that count this weekend */
  wins: number;
  matches: TipMatchView[];
};

export type Address = `0x${string}`;

export type Move = {
  turn: number;
  word: string;
  result: 'VALID' | 'INVALID_CATEGORY' | 'BAD_LINK' | 'REPEATED' | 'PASS';
  player: 'A' | 'B';
};

export type Game = {
  id: string;
  primary: Address;
  secondary: Address;
  phase: 'INVITED' | 'TURN' | 'FROZEN' | 'UNRESOLVED' | 'EXHAUSTED' | 'DONE';
  revision: string;
  outcome: string;
  base: { category: 'ANIMAL' | 'PLANT' | 'FOOD' | 'TOOL'; initial_letter: string };
  response: { word?: string };
  domain: {
    turn: number;
    score_a: number;
    score_b: number;
    last_letter: string;
    used: string[];
    moves: Move[];
    joined: boolean;
  };
};

export type Eip1193 = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

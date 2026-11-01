/**
 * One structured line per request. Never logs request text, IPs or keys —
 * only the task, outcome, status, models tried and timing.
 */
export interface RequestLog {
  readonly task: string;
  readonly status: number;
  readonly outcome: string;
  readonly ms: number;
  readonly model?: string;
  /** Each model tried, as `model:outcome`, for example `gemini-3.5-flash-lite:guard,gemini-3.8-flash:ok`. */
  readonly attempts?: string;
}

export type Logger = (entry: RequestLog) => void;

/** Writes a JSON line to stdout (collected by Vercel's function logs). O(1). */
export const stdoutLogger: Logger = (entry) => {
  process.stdout.write(
    `${JSON.stringify({ level: 'info', at: new Date().toISOString(), ...entry })}\n`,
  );
};

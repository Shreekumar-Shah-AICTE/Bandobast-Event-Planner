/** Today's date on the user's device, as YYYY-MM-DD. */
import { isoFromLocal, type IsoDate } from './domain/dates.js';

/** Today's date in the user's time zone, as an ISO date. */
export const todayIso = (): IsoDate => isoFromLocal(new Date());

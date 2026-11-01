/** Today's date on the user's device, as YYYY-MM-DD. */
import { isoFromLocal, type IsoDate } from './domain/dates.js';

export const todayIso = (): IsoDate => isoFromLocal(new Date());

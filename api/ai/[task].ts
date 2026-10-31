/**
 * Vercel Function: POST /api/ai/:task (intake | change | quote | ideas | explain).
 * The only place the Gemini key is used; the browser never sees it.
 */
import { createHandler } from '../../server/handler.js';
import { liveDeps } from '../../server/deps.js';

const handle = createHandler(liveDeps(process.env));

export default { fetch: handle };

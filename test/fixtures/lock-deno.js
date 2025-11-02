import { requestLock } from '../../lib/lock.js';

const mode = Deno.args[0] === 'shared' ? 'shared' : 'exclusive';

await requestLock('test-lock', { mode }, async () => {

});

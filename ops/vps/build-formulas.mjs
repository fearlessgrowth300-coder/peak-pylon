// Compile the existing, unchanged deterministic formulas for the VPS worker.
import {stripTypeScriptTypes} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../../src/lib/rankings.ts',import.meta.url),'utf8');
await writeFile(new URL('./api/ranking-formulas.mjs',import.meta.url),stripTypeScriptTypes(source,{mode:'strip'}));

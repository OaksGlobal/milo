import ts from 'typescript';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for(const file of ['types/domain.ts','lib/domain/calculations.ts','lib/domain/workspace.ts','lib/domain/examples.ts','lib/domain/analytics.ts']) {
 const out='.test-build/'+file.replace(/\.ts$/,'.js');
 await mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});
 const source=await readFile(file,'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\.?\/[^']+)'/g,"from '$1.js'");
 await writeFile(out,js);
}
const result=spawnSync(process.execPath,['--test','tests/domain.test.mjs','tests/analytics.test.mjs'],{stdio:'inherit'});
process.exit(result.status??1);

// A fixture-only harness for the actual native renderer. Not a complete React app.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildAssuranceView} from '../src/assurance/index.ts';
import {sample,warning,delivery,NOW,OTHER} from '../tests/assurance-fixtures.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.argv[2]??path.join(root,'.assurance-review'));
const require=createRequire(import.meta.url);
const ts=require(process.env.NOSPOILERS_REVIEW_TYPESCRIPT_PATH||'typescript');
mkdirSync(out,{recursive:true});
const modules={};
for(const name of ['evidence','view','client','render']){
  modules[name]=ts.transpileModule(readFileSync(path.join(root,`src/assurance/${name}.ts`),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS}}).outputText;
}
const bundle=`(()=>{const source=${JSON.stringify(modules)},cache={};function load(name){name=name.split('/').pop().replace('.ts','');if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('require','module','exports',source[name])(load,module,module.exports);return module.exports;}globalThis.assuranceRenderer=load('render');globalThis.assuranceClient=load('client');})();`;
writeFileSync(path.join(out,'renderer.js'),bundle);
const withDrift=sample();withDrift.release.locations=[{...delivery(),lastStatus:'mismatch',lastSha256:OTHER}];
const unknown=sample();unknown.signature='unavailable';
const changed=warning();changed.receipt.manifest.push({path:'<img src=x onerror="window.injected=true">.map',size:42,sha256:OTHER});
const views={ready:buildAssuranceView(sample(),sample(1),NOW),review:buildAssuranceView(changed,sample(1),NOW),unknown:buildAssuranceView(unknown,null,NOW),drift:buildAssuranceView(withDrift,sample(1),NOW)};
writeFileSync(path.join(out,'views.json'),JSON.stringify(views));
writeFileSync(path.join(out,'panel.css'),readFileSync(path.join(root,'src/components/watch/release-assurance.css')));
console.log(out);

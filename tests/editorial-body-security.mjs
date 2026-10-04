// Pure local parsing + actual React server rendering. No network or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const read=p=>fs.readFileSync(p,'utf8');
function load(path,imports={}){
 const loadedModule={exports:{}};
 vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:loadedModule,exports:loadedModule.exports,require:n=>{assert.ok(n in imports,n);return imports[n];}});
 return loadedModule.exports;
}
const model=load('src/lib/editorial-body.ts');
const parse=s=>JSON.parse(JSON.stringify(model.parseEditorialBody(s)));
assert.deepEqual(parse('First paragraph\ncontinued.\n\n\nSecond.'),[{type:'paragraph',text:'First paragraph\ncontinued.'},{type:'paragraph',text:'Second.'}]);
assert.deepEqual(parse('1. Search close to the day you visit\n\n2. Check the brand’s official channels\n99. Final check').map(b=>b.type),['heading','heading','heading']);
assert.deepEqual(parse('## Planning a Seongsu visit?'),[{type:'heading',text:'Planning a Seongsu visit?'}]);
assert.deepEqual(parse('• First\n- Second\n\n- Separate'),[{type:'list',items:['First','Second']},{type:'list',items:['Separate']}]);
assert.deepEqual(parse('Before\n- Item\nAfter').map(b=>b.type),['paragraph','list','paragraph']);
for(const text of ['A better way to experience Seongsu','Planning a Seongsu visit?','Already visited a Seongsu pop-up?','0. Zero','100. Not a heading','1.5 decimal','##','### Not supported','[Link](javascript:alert(1))','**Not bold**']) assert.equal(parse(text)[0].type,'paragraph');
assert.deepEqual(parse('A\r\n\r\n## Title\r\n• Item'),parse('A\n\n## Title\n• Item'));
assert.deepEqual(parse(' \n\n'),[]);
const {EditorialBody}=load('src/components/editorial-body.tsx',{'@/lib/editorial-body':model,'react/jsx-runtime':jsx});
const attack='<script>alert(1)</script><img src=x onerror=alert(1)><style>body{display:none}</style>';
const html=renderToStaticMarkup(jsx.jsx(EditorialBody,{body:`## ${attack}\n\n${attack}\n\n- ${attack}`}));
assert.doesNotMatch(html,/<script|<img|<style|<a\s/i);assert.ok(html.includes('&lt;script&gt;'));
assert.match(html,/<h2\b/);assert.match(html,/<p\b/);assert.match(html,/<ul\b/);assert.match(html,/<li\b/);
assert.ok(!html.includes('## '));
// Existing pre-shoot manuscripts remain renderable without modifying content.
for(const asset of JSON.parse(read('docs/content/launch-1a-seongsu/content-pack.json')).assets){
 const output=renderToStaticMarkup(jsx.jsx(EditorialBody,{body:asset.body}));assert.ok(output.includes('<p '));assert.ok(output.includes('<h2 '));
}
console.log('PASS: numbered/explicit headings, paragraphs, bullet grouping, CRLF, no short-sentence guessing, React HTML escaping and legacy editorial manuscripts. No writes.');

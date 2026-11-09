const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('login failure shows safe Firebase code without reflecting credentials',async()=>{
 const nodes={};const document={getElementById:id=>nodes[id]||(nodes[id]={addEventListener(){}}),querySelectorAll:()=>[]};
 const context={document,initializeApp:()=>({}),getAuth:()=>({}),onAuthStateChanged(){}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../public/app.js','utf8').replace(/^import .*;\n/gm,''),context);
 await context.perform(async()=>{throw {code:'auth/invalid-credential',message:'sensitive detail'}});
 assert.match(nodes.status.textContent,/Email atau password tidak cocok/);
 assert.match(nodes.status.textContent,/auth\/invalid-credential/);
 assert.doesNotMatch(nodes.status.textContent,/sensitive detail/);
 await context.perform(async()=>{throw {code:'<private value>',message:'sensitive detail'}});
 assert.match(nodes.status.textContent,/LOGIN_ERROR/);
 assert.doesNotMatch(nodes.status.textContent,/private|sensitive/);
});

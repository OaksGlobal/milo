import test from 'node:test';
import assert from 'node:assert/strict';
import {readProductContext} from '../.test-build/services/orbia-context.js';
import {prepareOrbiaImport} from '../.test-build/services/orbia-import.js';
import {exampleWorkspace} from '../.test-build/lib/domain/examples.js';
import {recipeCost} from '../.test-build/lib/domain/calculations.js';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',loc='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function fixture(options={}) {
  const calls=[];
  const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_fixture',accessToken:'synthetic-token',fetcher:async(input,init)=>{
    const url=new URL(input);calls.push({url,init});
    if(url.pathname==='/auth/v1/user')return Response.json({id:user},{status:options.authStatus??200});
    assert.equal(url.pathname,'/rest/v1/rpc/orbia_product_context');
    assert.equal(url.searchParams.get('target_product'),'milo');
    assert.equal(url.searchParams.get('organization_id'),'eq.'+org);
    assert.equal(url.searchParams.get('location_id'),'eq.'+loc);
    return Response.json(options.denied?[]:[{organization_id:org,organization_name:'Synthetic',location_id:options.wrongLocation?user:loc,location_name:'Synthetic',timezone:'Europe/Paris',role:options.role??'manager',product_active:options.active??true,expires_at:options.expiresAt??null,can_manage_billing:false}]);
  }};
  return {config,calls};
}
test('Milo revalidates Auth and exact product/location permissions without reading HR',async()=>{
  const f=fixture();const scope=await readProductContext(f.config,'milo',org,loc);
  assert.equal(scope.user_id,user);assert.equal(f.calls.length,2);
  assert.ok(f.calls.every(c=>c.init.method==='GET'&&c.init.cache==='no-store'&&c.init.redirect==='error'));
});
test('expired session, revoked access and a wrong returned scope all fail closed',async()=>{
  for(const options of [{authStatus:401},{denied:true},{wrongLocation:true},{role:'employee'}]){
    const f=fixture(options);await assert.rejects(()=>readProductContext(f.config,'milo',org,loc));
    if(options.authStatus)assert.equal(f.calls.length,1);
  }
});
test('import preparation preserves UUIDs, archived records and frozen costs with no writes',async()=>{
  const state=exampleWorkspace();state.snapshots.push({id:crypto.randomUUID(),at:new Date().toISOString(),recipe_id:state.recipes[0].id,recipe_name:state.recipes[0].name,recipe:structuredClone(state.recipes[0]),cost:recipeCost(state,state.recipes[0])});
  state.recipes[0].deleted_at=new Date().toISOString();
  const source=JSON.stringify(state),f=fixture();
  const first=await prepareOrbiaImport(source,f.config,org,loc),again=await prepareOrbiaImport(source,f.config,org,loc);
  assert.equal(first.sourceSha256,again.sourceSha256);assert.equal(first.sourceSha256.length,64);
  assert.deepEqual(first.workspace,state);assert.equal(JSON.stringify(state),source);
  assert.equal(first.historyOrigin,'local-unverified');assert.deepEqual(first.destination,{organizationId:org,locationId:loc});
  assert.ok(f.calls.every(c=>c.init.method==='GET'));
});
test('reader role or inactive/expired Milo access cannot prepare a write import',async()=>{
  for(const options of [{role:'viewer'},{role:'accountant'},{active:false},{expiresAt:'2000-01-01T00:00:00Z'}]){
    const f=fixture(options);await assert.rejects(()=>prepareOrbiaImport(JSON.stringify(exampleWorkspace()),f.config,org,loc),e=>e.code==='permission');
  }
});
test('import repeats permission checks; a prepared plan is never an authorization credential',async()=>{
  const options={},f=fixture(options),source=JSON.stringify(exampleWorkspace());
  await prepareOrbiaImport(source,f.config,org,loc);options.denied=true;
  await assert.rejects(()=>prepareOrbiaImport(source,f.config,org,loc),e=>e.code==='permission');
});
test('corrupt imports and server keys are rejected without remote writes',async()=>{
  const f=fixture();await assert.rejects(()=>prepareOrbiaImport('{',f.config,org,loc));
  const state=exampleWorkspace();state.items.push({...state.items[0]});
  await assert.rejects(()=>prepareOrbiaImport(JSON.stringify(state),f.config,org,loc));
  await assert.rejects(()=>readProductContext({...f.config,publishableKey:'sb_secret_fixture'},'milo',org,loc),e=>e.code==='configuration');
  assert.equal(f.calls.length,0);
});

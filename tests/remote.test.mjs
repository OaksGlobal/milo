import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteCatalogRepository } from '../.test-build/services/orbia-remote-repository.js';
import { prepareNormalizedImport } from '../.test-build/services/orbia-import-bundle.js';
import { exampleWorkspace } from '../.test-build/lib/domain/examples.js';
import { recipeCost } from '../.test-build/lib/domain/calculations.js';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',loc='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user='cccccccc-cccc-4ccc-8ccc-cccccccccccc',requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
function fixture(options={}) {
  const calls=[],state=exampleWorkspace();
  const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_fixture',accessToken:'synthetic',fetcher:async(input,init)=>{
    const url=new URL(input);calls.push({url,init});
    if(url.pathname==='/auth/v1/user')return Response.json({id:user});
    if(url.pathname.endsWith('orbia_product_context')) return Response.json(options.revoked?[]:[{organization_id:org,location_id:loc,organization_name:'Synthetic',location_name:'Synthetic',timezone:'Europe/Paris',role:options.role??'manager',product_active:options.active??true,expires_at:options.expires??null,can_manage_billing:false}]);
    if(options.network)throw new TypeError('private server details');
    if(options.status)return Response.json({message:'private SQL details'},{status:options.status});
    const scope={contract_version:1,organization_id:options.wrongScope?user:org,location_id:loc,revision:state.revision};
    if(url.pathname.endsWith('milo_catalog_read'))return Response.json({...scope,workspace:state});
    assert.ok(url.pathname.endsWith('milo_catalog_mutate'));
    const body=JSON.parse(init.body);
    return Response.json({...scope,revision:body.expected_revision+1,request_id:options.wrongReceipt?user:body.request_id,replayed:options.replayed??false});
  }};
  let configReads=0;
  const repo=createRemoteCatalogRepository(async()=>{configReads++;return config;},{organization_id:org,location_id:loc});
  const mutation={collection:'suppliers',record:state.suppliers[0]};
  return {repo,config,calls,state,mutation,configReads:()=>configReads};
}
test('remote catalog requires exact scope and never reads local IndexedDB',async()=>{
  const f=fixture();assert.deepEqual(await f.repo.load(),f.state);
  assert.equal(f.calls.length,3);
  assert.ok(f.calls.every(c=>c.init.cache==='no-store'&&c.init.redirect==='error'));
  await assert.rejects(()=>fixture({wrongScope:true}).repo.load(),e=>e.code==='schema');
});
test('remote mutation sends one entity, version and stable idempotency key',async()=>{
  const f=fixture();const result=await f.repo.saveRecord(f.mutation,0,requestId);
  const body=JSON.parse(f.calls[2].init.body);
  assert.equal(body.target_organization,org);assert.equal(body.target_location,loc);
  assert.deepEqual(body.command,f.mutation);assert.equal(body.request_id,requestId);
  assert.equal(result.revision,1);assert.ok(!('workspace' in body));
});
test('commercial expiration permits authorized read but blocks writes',async()=>{
  for(const options of [{active:false},{expires:'2000-01-01T00:00:00Z'}]){
    const f=fixture(options);await f.repo.load();
    await assert.rejects(()=>f.repo.saveRecord(f.mutation,0,requestId),e=>e.code==='permission');
    assert.equal(f.calls.filter(c=>c.url.pathname.endsWith('milo_catalog_mutate')).length,0);
  }
});
test('revocation after successful read is rechecked with fresh session provider',async()=>{
  const options={},f=fixture(options);await f.repo.load();options.revoked=true;
  await assert.rejects(()=>f.repo.load(),e=>e.code==='permission');
  assert.equal(f.configReads(),2);
});
test('financial catalog fails closed for unapproved roles',async()=>{
  for(const role of ['employee','viewer','accountant']) {
    const f=fixture({role});await assert.rejects(()=>f.repo.load(),e=>e.code==='permission');
    await assert.rejects(()=>f.repo.saveRecord(f.mutation,0,requestId),e=>e.code==='permission');
    assert.ok(f.calls.every(c=>c.init.method==='GET'));
  }
});
test('missing backend, conflict and denied access do not fall back to local storage',async()=>{
  for(const [status,code] of [[404,'unavailable'],[409,'conflict'],[403,'permission'],[401,'authentication'],[422,'invalid'],[503,'uncertain']]) {
    const f=fixture({status});await assert.rejects(()=>f.repo.saveRecord(f.mutation,0,requestId),e=>e.code===code&&!e.message.includes('private SQL'));
  }
});
test('ambiguous commit does not retry automatically; explicit retry preserves request',async()=>{
  const options={network:true},f=fixture(options);
  await assert.rejects(()=>f.repo.saveRecord(f.mutation,0,requestId),e=>e.code==='uncertain');
  assert.equal(f.calls.filter(c=>c.init.method==='POST').length,1);
  options.network=false;options.replayed=true;
  assert.equal((await f.repo.saveRecord(f.mutation,0,requestId)).replayed,true);
  const bodies=f.calls.filter(c=>c.init.method==='POST').map(c=>c.init.body);
  assert.equal(bodies[0],bodies[1]);
});
test('receipt for another operation is rejected and invalid input causes no HTTP',async()=>{
  const f=fixture({wrongReceipt:true});await assert.rejects(()=>f.repo.saveRecord(f.mutation,0,requestId),e=>e.code==='uncertain');
  const g=fixture();await assert.rejects(()=>g.repo.saveRecord(g.mutation,-1,requestId));
  await assert.rejects(()=>g.repo.saveRecord(g.mutation,0,'bad-id'));assert.equal(g.calls.length,0);
});
test('normalized import preserves UUIDs, archived recipes, line order and frozen history',async()=>{
  const f=fixture(),state=f.state,recipe=state.recipes[0];
  state.snapshots.push({id:crypto.randomUUID(),at:new Date().toISOString(),recipe_id:recipe.id,recipe_name:recipe.name,recipe:structuredClone(recipe),cost:recipeCost(state,recipe)});
  recipe.deleted_at=new Date().toISOString();
  const source=JSON.stringify(state);
  const result=await prepareNormalizedImport(source,f.config,org,loc,requestId);
  assert.equal(result.status,'requires_catalog_agreement');assert.equal(result.source_sha256.length,64);
  assert.deepEqual(result.recipes.map(r=>r.id),state.recipes.map(r=>r.id));
  assert.equal(result.recipes[0].deleted_at,recipe.deleted_at);
  assert.deepEqual(result.recipe_lines.filter(l=>l.recipe_id===recipe.id).map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['organization_id','location_id','import_id','recipe_id','position'].includes(key)))),recipe.lines);
  assert.deepEqual(result.cost_snapshots[0].cost,state.snapshots[0].cost);
  assert.ok(result.legacy_events.every(e=>e.authenticated_actor_id===null&&e.origin==='local-unverified'));
  assert.equal(JSON.stringify(state),source);assert.ok(f.calls.every(c=>c.init.method==='GET'));
});
test('normalization refuses unknown fields and lossy trimming instead of discarding history',async()=>{
  for(const edit of [s=>{s.unrecognized='keep me';},s=>{s.suppliers[0].name=' '+s.suppliers[0].name;}]){
    const f=fixture();edit(f.state);
    await assert.rejects(()=>prepareNormalizedImport(JSON.stringify(f.state),f.config,org,loc,requestId),/modifierait/);
  }
});
test('normalization refuses corrupt historical identifiers and references',async()=>{
  const f=fixture();const snapshot={id:requestId,at:new Date().toISOString(),recipe_id:requestId,recipe_name:'Synthetic',recipe:f.state.recipes[0],cost:recipeCost(f.state,f.state.recipes[0])};
  f.state.snapshots.push(snapshot);
  await assert.rejects(()=>prepareNormalizedImport(JSON.stringify(f.state),f.config,org,loc,requestId));
  assert.equal(f.calls.length,0);
});

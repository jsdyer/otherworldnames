import test from 'node:test';
import assert from 'node:assert/strict';
import {indexFeatures,matching,project,nearest,namingTheme,coordinate} from '../web/model.mjs';
const records=indexFeatures([
  {id:1,name:'Canso',origin:'Town in Nova Scotia, Canada.',code:'AA',type:'Crater',group:'Canada',lon:-60,lat:30},
  {id:2,name:'Émile B',origin:'Named from nearby crater.',code:'SF',type:'Satellite Feature',group:'France',lon:90,lat:-30}
]);
test('search combines name and origin terms, groups and exact type',()=>{
  assert.deepEqual(matching(records,{query:'scotia CANSO',group:'Canada'}),[records[0]]);
  assert.deepEqual(matching(records,{query:'Canso',type:'Satellite Feature'}),[]);
});
test('lettered features are optional and accent-insensitive',()=>{
  assert.equal(matching(records,{query:'emile'}).length,0);
  assert.equal(matching(records,{query:'emile',satellites:true})[0].id,2);
});
test('east-positive projection agrees with the west-at-left NASA mosaic',()=>{
  assert.deepEqual(project(records[0],360,180),[120,60]);
  assert.equal(nearest(records,120,60,360,180).id,1);
  assert.equal(nearest(records,0,0,360,180),undefined);
  assert.equal(coordinate(-12,false),'12.00° W');
});
test('feature theme depends on both body and code',()=>{
  assert.match(namingTheme('Mars','AA'),/towns/); assert.match(namingTheme('Moon','AA'),/explorers/);
});

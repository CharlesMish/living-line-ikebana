import assert from 'node:assert/strict';
import test from 'node:test';
import { stemOverlapPreview } from '../../src/app/stemOverlapPreview.ts';
import { findStemOverlaps } from '../../src/core/stemOverlaps.ts';
import { previewPrune } from '../../src/core/prune.ts';
import { TransactionCoordinator } from '../../src/input/TransactionCoordinator.ts';
import { createDomainAdapters } from '../../src/app/domainAdapters.ts';
import { canonicalCameraPose } from '../../src/app/camera.ts';
import { stem } from '../fixtures/stemOverlapFixture.ts';
const p=(x:number,y:number,z=0)=>({x,y,z});
const a=()=>stem('a',[p(0,0),p(0,2)]);
const b=()=>stem('b',[p(-1,1),p(1,1)]);

test('presentation adapter replaces live graph, excludes hidden ghosts, and previews exact remaining prune material',()=>{
 const plants=new Map([['a',a()],['b',b()]]);
 const shifted=stem('a',[p(2,0),p(2,2)]);
 const count=(active:any,visible=true)=>findStemOverlaps(stemOverlapPreview(plants,active,visible)).length;
 assert.equal(count(null),1);
 for(const kind of ['aim','bend','base']) assert.equal(count({kind,graph:shifted,plantId:'a'}),0);
 assert.equal(count({kind:'prune',plantId:'a',plan:previewPrune(plants.get('a')!,'a:trunk',.7)}),0);
 assert.equal(count(null),1,'cancel restores committed contact');
 const pending=stem('c',[p(-1,1),p(1,1)]);
 const one=new Map([['a',plants.get('a')!]]);
 assert.equal(findStemOverlaps(stemOverlapPreview(one,{kind:'insert',graph:pending},false)).length,0);
 assert.equal(findStemOverlaps(stemOverlapPreview(one,{kind:'insert',graph:pending},true)).length,1);
 assert.equal(plants.size,2);assert.equal(plants.get('a')!.branches.get('a:trunk')!.activeLength,2);
});

test('real prune/cancel/commit/Undo lifecycle changes diagnostics without preview writes or consuming history',()=>{
 let saves=0;
 const coordinator=new TransactionCoordinator(createDomainAdapters(),{
  plants:new Map([['a',a()],['b',b()]]),selectedPlantId:'a',successfulPlantOrdinal:2,camera:canonicalCameraPose('front'),
 },{onAutosave:()=>saves++});
 const inspect=()=>{const s=coordinator.getPresentationState();return findStemOverlaps(stemOverlapPreview(s.document.plants,s.active,true)).length;};
 const cut=()=>{coordinator.commandTool('prune');return coordinator.beginPrune(1,{plantId:'a',branchId:'a:trunk',acquiredMaterialDistance:.7,context:{}},{distance:.7});};
 assert.equal(inspect(),1);assert.equal(cut().ok,true);assert.equal(inspect(),0);assert.equal(saves,0);
 coordinator.pointerCancel(1);assert.equal(inspect(),1);assert.equal(saves,0);
 cut();coordinator.release(1);assert.equal(inspect(),0);assert.equal(saves,1);
 coordinator.commandUndo();assert.equal(inspect(),1);assert.equal(saves,2);assert.equal(coordinator.canUndo(),false);
 inspect();inspect();assert.equal(saves,2);
});

test('app inspection refreshes immediately on toggle, restores hover state, and never writes', async()=>{
 const { IkebanaApp }=await import('../../src/app/IkebanaApp.ts');
 const state={showStemOverlaps:false,stemOverlapCount:0};
 const plants=new Map([['a',a()],['b',b()]]);
 let saves=0,cancels=0,reads=0;
 const coordinator=new TransactionCoordinator(createDomainAdapters(),{
  plants,selectedPlantId:'a',successfulPlantOrdinal:2,camera:canonicalCameraPose('front'),
 },{onAutosave:()=>saves++});
 const app=Object.assign(Object.create(IkebanaApp.prototype),{
  coordinator,gesture:null,workingSession:null,hovering:false,
  sound:{unlock(){}},ui:{state,setState:(patch:object)=>Object.assign(state,patch),setStatus(){}},
  studio:{setStemOverlapGraphs:(graphs:any)=>{reads++;return graphs?findStemOverlaps(graphs).length:0}},
  interruptActive:()=>{cancels++;coordinator.interrupt('view-command')},
 });
 app.syncPresentation=()=>app.syncStemOverlaps();
 app.handleUICommand({kind:'set-stem-overlaps',visible:true},{});
 assert.equal(state.stemOverlapCount,1);assert.equal(state.showStemOverlaps,true);assert.equal(cancels,1);
 app.syncStemOverlaps({plantId:'a',plan:previewPrune(plants.get('a')!,'a:trunk',.7)});
 assert.equal(state.stemOverlapCount,0);
 app.syncStemOverlaps();assert.equal(state.stemOverlapCount,1);
 coordinator.commandTool('prune');coordinator.beginPrune(1,{plantId:'a',branchId:'a:trunk',acquiredMaterialDistance:.7,context:{}},{distance:.7});
 app.handleUICommand({kind:'set-stem-overlaps',visible:false},{});
 assert.equal(coordinator.getDebugState().active,null);assert.equal(state.stemOverlapCount,0);
 assert.equal(coordinator.release(1).ok,false);assert.equal(saves,0);assert.ok(reads>=4);
});

import './pieces.css';
import {Check} from 'lucide-react';
import type {ReactNode} from 'react';
import {carrierPath,type FileMapModel} from '@/watch/release-pieces';

export type FileMapFact={label:string;value:ReactNode};

/** Every file in the release as a tile, with the files that carry a recorded finding lit. */
export function FileMap({model,facts,selectedPath,onSelect}:{model:FileMapModel;facts:FileMapFact[];selectedPath?:string|null;onSelect?:(findingIndex:number)=>void}){
  const selected=selectedPath?carrierPath(selectedPath):null;
  const shown=model.marked.slice(0,4);
  return <section className="np np-filemap" aria-label="File map">
    <div className={`np-filemap-body${facts.length?'':' is-solo'}`}>
      <div>
        <div className={`np-fgrid${model.tiles.length<=36?' is-few':''}`}>
          {model.tiles.map((tile,index)=>tile.tone&&tile.findingIndex!=null&&onSelect
            ?<button key={index} type="button" className={`np-ft is-${tile.tone}`} aria-pressed={selected!==null&&tile.path===selected} aria-label={`Open the finding in ${tile.path}`} title={tile.path??undefined} onClick={()=>onSelect(tile.findingIndex!)}/>
            :<i key={index} className={`np-ft${tile.tone?` is-${tile.tone}`:''}`} aria-hidden/>)}
        </div>
        <div className="np-fkey">
          {shown.map(mark=><span key={mark.path}><i className={`is-${mark.tone}`} aria-hidden/>{mark.path}</span>)}
          {model.marked.length>shown.length?<span>+{model.marked.length-shown.length} more</span>:null}
          <em>{model.perTile===1?'Each tile is one file':`Each tile is about ${model.perTile} files`}</em>
        </div>
      </div>
      {facts.length?<dl className="np-facts">{facts.map(fact=><div key={fact.label} style={{display:'contents'}}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>:null}
    </div>
  </section>;
}

/** The count of files that came back with no recorded finding. */
export function FileMapClear({model}:{model:FileMapModel}){
  if(!model.clear)return null;
  return <div className="np"><p className="np-okline"><Check aria-hidden/><span>Checked, nothing found</span><em>{model.clear.toLocaleString('en-GB')} file{model.clear===1?'':'s'}</em></p></div>;
}

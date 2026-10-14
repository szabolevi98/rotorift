// All timing queries are asynchronous. Never gl.finish(), never wait for a GPU
// result. Opening the panel enables recording; closing it releases all queries.
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
  }
  poll() {
    if (!this.ext) return;
    const gl = this.gl, disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    this.pending = this.pending.filter(({query, sample}) => {
      if (disjoint || gl.isContextLost()) { gl.deleteQuery(query); return false; }
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return true;
      const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      if (Number.isFinite(ms) && ms >= 0) sample.gpuMs = ms;
      gl.deleteQuery(query);
      return false;
    });
  }
  begin(sample) {
    this.poll();
    if (!this.ext || this.gl.isContextLost() || this.pending.length >= 4) return;
    const query = this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.current = {query, sample};
  }
  end() {
    if (!this.current) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.current);
    this.current = null;
  }
  dispose() {
    this.end();
    for (const {query} of this.pending) this.gl.deleteQuery(query);
    this.pending = [];
  }
}

export function summarizeFrames(samples) {
  samples=samples.filter(s=>Number.isFinite(s.frameMs)&&s.frameMs>0);
  const values = key => samples.map(s => s[key]).filter(Number.isFinite);
  const mean = key => { const a=values(key); return a.length ? a.reduce((s,v)=>s+v,0)/a.length : null; };
  const frames=values('frameMs').sort((a,b)=>a-b);
  return {
    count:samples.length, fps:mean('frameMs')>0?1000/mean('frameMs'):null,
    frameMs:mean('frameMs'), p95Ms:frames.length?frames[Math.ceil(frames.length*.95)-1]:null,
    worst:samples.reduce((worst,s)=>!worst||s.frameMs>worst.frameMs?s:worst,null),
    cpuMs:mean('cpuMs'), physicsMs:mean('physicsMs'), worldMs:mean('worldMs'),
    renderMs:mean('renderMs'), gpuMs:mean('gpuMs'), otherMs:mean('otherMs'),
    steps:mean('steps'), calls:mean('calls'), triangles:mean('triangles'),
    droppedMs:values('droppedMs').reduce((sum,v)=>sum+v,0),
  };
}

export class FrameDiagnostics {
  constructor(panel, toggle, renderer, t) {
    this.panel=panel; this.toggle=toggle; this.renderer=renderer; this.t=t;
    this.samples=[]; this.longTasks=[]; this.open=false;
    this.rows=panel.querySelector('[data-performance-rows]');
    this.localize();
    window.addEventListener('languagechange',()=>this.localize());
    toggle.onclick=()=>this.setOpen(!this.open);
    panel.querySelector('[data-performance-close]').onclick=()=>this.setOpen(false);
    panel.querySelector('[data-performance-reset]').onclick=()=>this.reset();
    panel.querySelector('[data-performance-export]').onclick=()=>this.download();
  }
  localize() {
    this.toggle.setAttribute('aria-label',this.toggle.textContent+' · '+this.t('perf.open'));
    this.toggle.title=this.t('perf.open');
    this.panel.querySelector('[data-performance-close]').setAttribute('aria-label',this.t('perf.close'));
  }
  reset() {
    this.timer?.dispose(); this.samples=[]; this.longTasks=[];
    this.previousAt=null; this.previousSample=null; this.updatedAt=0;
  }
  setOpen(open) {
    this.open=open; this.reset();
    this.panel.classList.toggle('hidden',!open);
    this.toggle.setAttribute('aria-expanded',String(open));
    this.observer?.disconnect();
    if (open) {
      this.timer ??= new GpuTimer(this.renderer.getContext());
      if (typeof PerformanceObserver!=='undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        this.observer=new PerformanceObserver(list=>{
          for(const e of list.getEntries())this.longTasks.push({at:e.startTime,durationMs:e.duration});
          this.longTasks=this.longTasks.slice(-30);
        });
        this.observer.observe({type:'longtask'});
      }
      this.render();
    }
  }
  begin(at) {
    if (!this.open) return null;
    this.timer.poll();
    // The interval ending now belongs to the work submitted on the preceding
    // frame. Keep its CPU/GPU costs and position attached to that interval.
    if(this.previousSample)this.previousSample.frameMs=at-this.previousAt;
    const sample={at,frameMs:null,
      physicsMs:0,worldMs:0,renderMs:0,steps:0,droppedMs:0};
    this.previousAt=at;this.previousSample=sample;
    return sample;
  }
  record(sample, cpuMs, context) {
    if (!sample) return;
    Object.assign(sample,context,{cpuMs,otherMs:Math.max(0,cpuMs-sample.physicsMs-sample.worldMs-sample.renderMs),
      calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles});
    // Do not count a pause, background-tab gap, or a new aircraft load as FPS.
    this.samples.push(sample);
    this.samples=this.samples.filter(s=>s.at>=sample.at-10000).slice(-2000);
    if (sample.at-this.updatedAt>=500) {this.updatedAt=sample.at;this.render();}
  }
  idle() { this.previousAt=null;this.previousSample=null; }
  render() {
    const summary=summarizeFrames(this.samples),t=this.t;
    const ms=v=>Number.isFinite(v)?v.toFixed(2)+' ms':'—';
    const rows=[
      [t('perf.frame'),ms(summary.frameMs)+' / '+ms(summary.p95Ms)],
      [t('perf.worst'),ms(summary.worst?.frameMs)],
      ['CPU',ms(summary.cpuMs)],
      [t('perf.physics'),ms(summary.physicsMs)],
      [t('perf.world'),ms(summary.worldMs)],
      [t('perf.render'),ms(summary.renderMs)],
      ['GPU',summary.gpuMs===null?t(this.timer?.ext?'perf.pending':'perf.unavailable'):ms(summary.gpuMs)],
      [t('perf.other'),ms(summary.otherMs)],
      [t('perf.steps'),Number.isFinite(summary.steps)?summary.steps.toFixed(1):'—'],
      [t('perf.draws'),Number.isFinite(summary.calls)?Math.round(summary.calls).toLocaleString():'—'],
      [t('perf.triangles'),Number.isFinite(summary.triangles)?Math.round(summary.triangles).toLocaleString():'—'],
      [t('perf.skipped'),ms(summary.droppedMs)],
    ];
    this.rows.replaceChildren(...rows.map(([label,value])=>{
      const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=label;dd.textContent=value;row.append(dt,dd);return row;
    }));
  }
  download() {
    const report={version:1,createdAt:new Date().toISOString(),windowSeconds:10,
      resolution:{width:this.renderer.domElement.width,height:this.renderer.domElement.height,pixelRatio:this.renderer.getPixelRatio()},
      gpuTimerSupported:!!this.timer?.ext,summary:summarizeFrames(this.samples),samples:this.samples.filter(s=>Number.isFinite(s.frameMs)),
      longTasks:this.longTasks.filter(e=>e.at>=(this.samples[0]?.at??Infinity))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='rotorift-performance-'+Date.now()+'.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}

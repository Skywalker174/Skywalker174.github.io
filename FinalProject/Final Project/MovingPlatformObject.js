//  MovingPlatformObject.js  –– a single rectangle that can slide down smoothly
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class MovingPlatformObject extends SceneObject {
  /**  @param {GPUDevice} device
   *   @param {GPUTextureFormat} canvasFmt
   *   @param {{x:number,y:number,w:number,h:number}} rect   initial rectangle
   *   @param {Float32Array} color  RGBA
   *   @param {number} targetY      Y-coordinate (top-edge) to stop at
   */
  constructor(device, canvasFmt, rect, color, targetY){
    super(device, canvasFmt);

    if(!Array.isArray(color) && !(color instanceof Float32Array))
      throw new Error('color must be Float32Array or array');

    this._rect      = {...rect};            // mutable copy
    this._colArr    = new Float32Array(color);
    this._targetY   = targetY;
    this._speed     = 0.6;                  // units / second  (tweak!)
    this._dropping  = false;

    /* uniforms that change each frame --------------------------------*/
    this._offsetArr = new Float32Array([0,0]);   // X unused, only Y slides
  }

  startDrop(){
    if (!this._dropping){                 // trigger only once
      console.log('[LIFT] startDrop() called');
      this._dropping = true;
      this._lastTime = performance.now(); // ← reset timer so dt ≈ 1 frame
    }
  }

  bbox(){       return this._rect; }        // let game logic query live AABB

  /*───────── GPU resources ─────────*/
  async createGeometry(){
    const {x,y,w,h} = this._rect;
    const v = new Float32Array([
      x,   y,
      x+w, y,
      x,   y-h,
      x+w, y-h
    ]);
    this._vbuf = this._device.createBuffer({
      size: v.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, v);

    this._cbuf = this._device.createBuffer({size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._cbuf, 0, this._colArr);

    this._ubuf = this._device.createBuffer({size:8, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._ubuf, 0, this._offsetArr);

    /* keep time stamp for smooth dt */
    this._lastTime = performance.now();
  }

  async createShaders(){
    const code = /* wgsl */`
      struct Off { off : vec2<f32>, };

      @group(0) @binding(0) var<uniform> uCol : vec4<f32>;
      @group(0) @binding(1) var<uniform> uOff : Off;

      @vertex
      fn vMain(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32>{
        return vec4<f32>(pos + uOff.off, 0.0, 1.0);
      }

      @fragment
      fn fMain() -> @location(0) vec4<f32>{ return uCol; }
    `;
    this._mod = this._device.createShaderModule({code});
  }

  async createRenderPipeline(){
    const bgl = this._device.createBindGroupLayout({
      entries:[
        { binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{} },
        { binding:1, visibility:GPUShaderStage.VERTEX  , buffer:{} }
      ]
    });
    this._bindGroup = this._device.createBindGroup({
      layout:bgl,
      entries:[
        {binding:0, resource:{buffer:this._cbuf}},
        {binding:1, resource:{buffer:this._ubuf}}
      ]
    });

    this._pipe = this._device.createRenderPipeline({
      layout: this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{
        module:this._mod, entryPoint:'vMain',
        buffers:[{arrayStride:8, attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]
      },
      fragment:{module:this._mod, entryPoint:'fMain', targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }

  async createComputePipeline(){}

  /*──────── per-frame update (called by Renderer) ────────*/
  updateGeometry(){
    if(!this._dropping) return;
    console.log(`[LIFT] y=${this._rect.y.toFixed(3)}  off=${this._offsetArr[1].toFixed(3)}`);

    const tNow  = performance.now();
    const dt    = (tNow - this._lastTime)*0.001;   // ms → s
    this._lastTime = tNow;

    /* move down but clamp at target */
    const maxStep = this._speed * dt;
    const desired = Math.max(0, this._rect.y - this._targetY);
    const step    = Math.min(maxStep, desired);

    if(step > 0){
      this._rect.y -= step;                 // update AABB
      this._offsetArr[1] -= step;           // update GPU offset
      this._device.queue.writeBuffer(this._ubuf, 0, this._offsetArr);
    }else{                                  // reached destination
      this._dropping = false;
    }
  }

  /*──────── draw ────────*/
  render(pass){
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);
  }
  compute(){}
}

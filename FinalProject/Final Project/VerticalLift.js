//  VerticalLift.js –– bidirectional moving platform (down & up)
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class VerticalLift extends SceneObject {
  /**
   * @param {GPUDevice}         device
   * @param {GPUTextureFormat}  canvasFmt
   * @param {{x:number,y:number,w:number,h:number}} rect   initial rectangle
   * @param {Float32Array}      color      RGBA
   * @param {number}            targetY    Y (top-edge) to stop at when dropping
   */
  constructor(device, canvasFmt, rect, color, targetY){
    super(device, canvasFmt);

    this._rect     = { ...rect };                 // mutable copy
    this._colArr   = new Float32Array(color);
    this._startY   = rect.y;                      // home (upper) positon
    this._targetY  = targetY;                     // lower stop
    this._speed    = 0.6;                         // units / sec – tweak
    this._moveDir  = 0;                           //  0 = idle, -1 = down, +1 = up

    this._offsetArr = new Float32Array([0, 0]);   // GPU offset (only Y changes)
  }

  /* ---------------- API the game uses ---------------- */
  startDrop(){                 // begin moving down
    if (this._moveDir === -1) return;             // already dropping
    this._moveDir = -1;
    this._lastTime = performance.now();
  }
  startRise(){                 // begin moving up
    if (this._moveDir === +1) return;             // already rising
    this._moveDir = +1;
    this._lastTime = performance.now();
  }

  /** current AABB, so the collision code can treat it like a solid rect */
  bbox(){ return this._rect; }

  /* ---------------- GPU resources -------------------- */
  async createGeometry(){
    const {x,y,w,h} = this._rect;
    const verts = new Float32Array([ x,y,  x+w,y,  x,y-h,  x+w,y-h ]);
    this._vbuf = this._device.createBuffer({
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, verts);

    this._cbuf = this._device.createBuffer({size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._cbuf, 0, this._colArr);

    this._ubuf = this._device.createBuffer({size:8, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._ubuf, 0, this._offsetArr);

    this._lastTime = performance.now();
  }

  async createShaders(){
    const code = /* wgsl */`
      struct Off { off : vec2<f32>, };

      @group(0) @binding(0) var<uniform> uCol : vec4<f32>;
      @group(0) @binding(1) var<uniform> uOff : Off;

      @vertex
      fn vMain(@location(0) pos: vec2<f32>) -> @builtin(position) vec4f{
        return vec4f(pos + uOff.off, 0.0, 1.0);
      }

      @fragment
      fn fMain() -> @location(0) vec4f{ return uCol; }
    `;
    this._mod = this._device.createShaderModule({code});
  }

  async createRenderPipeline(){
    const bgl = this._device.createBindGroupLayout({
      entries:[
        {binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{}},
        {binding:1, visibility:GPUShaderStage.VERTEX  , buffer:{}}
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
      layout:this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{
        module:this._mod, entryPoint:'vMain',
        buffers:[{arrayStride:8, attributes:[{shaderLocation:0, offset:0, format:'float32x2'}]}]
      },
      fragment:{module:this._mod, entryPoint:'fMain', targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }
  async createComputePipeline(){}

  /* ---------------- per-frame update ----------------- */
  updateGeometry(){
    if (this._moveDir === 0) return;          // idle

    const now   = performance.now();
    const dt    = (now - this._lastTime) * 0.001;
    this._lastTime = now;

    const maxStep = this._speed * dt * this._moveDir;     // signed step
    let   newY    = this._rect.y + maxStep;

    /* clamp to limits and stop if reached */
    if (this._moveDir < 0 && newY <= this._targetY){      // finished dropping
      newY = this._targetY;  this._moveDir = 0;
    }
    if (this._moveDir > 0 && newY >= this._startY){       // finished rising
      newY = this._startY;   this._moveDir = 0;
    }

    const dy = newY - this._rect.y;
    if (Math.abs(dy) > 1e-6){
      this._rect.y       = newY;         // update AABB for collision
      this._offsetArr[1] = newY - this._startY;
      this._device.queue.writeBuffer(this._ubuf, 0, this._offsetArr);
    }
  }

  /* ---------------- draw ----------------------------- */
  render(pass){
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);
  }
  compute(){}
}

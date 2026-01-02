//  HiddenBridge.js — retractable horizontal platform toggled by switches
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

/**
 * A bridge that can instantly appear / disappear.  Collision is enabled only
 * when the bridge is visible so the AABB helper can stay unchanged.
 */
export default class HiddenBridge extends SceneObject {
  /**
   * @param {GPUDevice}        device
   * @param {GPUTextureFormat} canvasFmt
   * @param {{x:number,y:number,w:number,h:number}} rect   rectangle (top-left origin)
   * @param {Float32Array}     color    RGBA
   */
  constructor(device, canvasFmt, rect, color){
    super(device, canvasFmt);

    this._rect    = { ...rect };               // mutable copy for collisions
    this._colArr  = new Float32Array(color);
    this._offArr  = new Float32Array([0, 0]);  // not animated, but keep the same layout
    this._visArr  = new Float32Array([0]);     // 0 = hidden, 1 = visible
    this._visible = false;
  }

  /* ───────── public helpers used by the game ───────── */
  isVisible(){ return this._visible; }

  /** Toggle the bridge.
    * @param {boolean} flag  true = show, false = hide */
  setVisible(flag){
    const v = !!flag;
    if (v === this._visible) return;         // no change
    this._visible = v;
    this._visArr[0] = v ? 1 : 0;
    // buffer might not be created yet if called too early
    if (this._vbufVis) this._device.queue.writeBuffer(this._vbufVis, 0, this._visArr);
  }

  /** Return AABB only when visible so the player can walk on it. */
  bbox(){ return this._visible ? this._rect : { x:0, y:0, w:0, h:0 }; }

  /* ───────── GPU resources ───────── */
  async createGeometry(){
    const { x, y, w, h } = this._rect;
    const verts = new Float32Array([
      x,   y,
      x+w, y,
      x,   y-h,
      x+w, y-h
    ]);
    this._vbuf = this._device.createBuffer({
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, verts);

    this._cbuf = this._device.createBuffer({size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._cbuf, 0, this._colArr);

    this._offBuf = this._device.createBuffer({size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._offBuf, 0, this._offArr);

    this._vbufVis = this._device.createBuffer({size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._vbufVis, 0, this._visArr);
  }

  async createShaders(){
    const code = /* wgsl */`
      struct Off  { off : vec2<f32>, };
      struct Flag { vis : f32,       };

      @group(0) @binding(0) var<uniform> uCol  : vec4<f32>;
      @group(0) @binding(1) var<uniform> uOff  : Off;
      @group(0) @binding(2) var<uniform> uFlag : Flag;

      @vertex
      fn vMain(@location(0) pos : vec2<f32>) -> @builtin(position) vec4f {
        return vec4f(pos + uOff.off, 0.0, 1.0);
      }

      @fragment
      fn fMain() -> @location(0) vec4f {
        return uCol * uFlag.vis;   // multiply alpha by 0 or 1
      }
    `;
    this._mod = this._device.createShaderModule({code});
  }

  async createRenderPipeline(){
    const bgl = this._device.createBindGroupLayout({
      entries:[
        {binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{}},
        {binding:1, visibility:GPUShaderStage.VERTEX  , buffer:{}},
        {binding:2, visibility:GPUShaderStage.FRAGMENT, buffer:{}},
      ]
    });
    this._bindGroup = this._device.createBindGroup({
      layout:bgl,
      entries:[
        {binding:0, resource:{buffer:this._cbuf}},
        {binding:1, resource:{buffer:this._offBuf}},
        {binding:2, resource:{buffer:this._vbufVis}},
      ]
    });

    this._pipe = this._device.createRenderPipeline({
      layout: this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{
        module:this._mod, entryPoint:'vMain',
        buffers:[{arrayStride:8, attributes:[{shaderLocation:0, offset:0, format:'float32x2'}]}]
      },
      fragment:{ module:this._mod, entryPoint:'fMain', targets:[{format:this._canvasFormat}] },
      primitive:{ topology:'triangle-strip' }
    });
  }
  async createComputePipeline(){}

  updateGeometry(){}                   // bridge does not animate

  render(pass){
    if (!this._visible) return;        // skip drawing when hidden
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);
  }
  compute(){}
}
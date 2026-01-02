/*  SwitchObject.js  ── a two–part floor button
 *  - base (static, brown) + button cap (red→green once pressed)
 */
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';
const BTN_W     = 0.40;   // total width of the switch
const BTN_H     = 0.06;   // height of one plate  (matches WALL_THK)
const POP_UP    = BTN_H;  // how far the red plate sticks up at rest

export default class SwitchObject extends SceneObject {
  constructor(device, canvasFmt, /*[x ,y ] = TOP-LEFT of base*/ topLeft,
              w = 0.12, hBase = 0.04, hBtn = 0.02) {
    super(device, canvasFmt);
    this.tl     = topLeft;          // [x, y] in NDC
    this.w      = w;
    this.hBase  = hBase;
    this.hBtn   = hBtn;

    this._pressed = false;
    this._btnYOffset = 0;           // slides down when pressed

    /* colours */
    this._baseCol = new Float32Array([0.26, 0.18, 0.13, 1]); // dark brown
    this._btnCol  = new Float32Array([1, 0, 0, 1]);          // red (changes to green)
  }

  /* ────────────────── Geometry ────────────────── */
  async createGeometry() {
    /* two quads, one after another in the same vertex buffer
       v0-v1-v2-v3  (base)   then   v4-v5-v6-v7  (button)             */
    const [x0, y0] = this.tl;
    const x1 = x0 + this.w;
    const y1 = y0 - this.hBase;
    const yBtn0 = y0;                       // top of button sits flush with base
    const yBtn1 = yBtn0 - this.hBtn;

    this._verts = new Float32Array([
      // base
      x0, y0,  x1, y0,  x0, y1,  x1, y1,
      // button cap
      x0, yBtn0,  x1, yBtn0,  x0, yBtn1,  x1, yBtn1
    ]);
    this._vbuf = this._device.createBuffer({
      size: this._verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, this._verts);

    /* two uniform colour buffers (base + button) */
    this._cBase = this._device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this._cBtn  = this._device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this._device.queue.writeBuffer(this._cBase, 0, this._baseCol);
    this._device.queue.writeBuffer(this._cBtn , 0, this._btnCol);

    /* small translation buffer just for the button Y-offset */
    this._btnOffset = new Float32Array([0, this._btnYOffset]);
    this._tBtnBuf = this._device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this._device.queue.writeBuffer(this._tBtnBuf, 0, this._btnOffset);
  }

  /* ────────────────── Shader ────────────────── */
  async createShaders() {
    const code = `
      struct Off { off : vec2<f32>, };

      @group(0) @binding(0) var<uniform> uCol : vec4<f32>;
      @group(0) @binding(1) var<uniform> uOff : Off;

      @vertex
      fn vMain(@location(0) pos : vec2<f32>) -> @builtin(position) vec4<f32> {
        return vec4<f32>(pos + uOff.off, 0.0, 1.0);
      }

      @fragment
      fn fMain() -> @location(0) vec4<f32> { return uCol; }
    `;
    this._mod = this._device.createShaderModule({ code });
  }

  /* ────────────────── Pipeline / Bind groups ────────────────── */
  async createRenderPipeline() {
    const bgl = this._device.createBindGroupLayout({
      entries: [
        { binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{} },
        { binding:1, visibility:GPUShaderStage.VERTEX  , buffer:{} }
      ]
    });
    const pipLayout = this._device.createPipelineLayout({ bindGroupLayouts:[bgl] });

    this._pipe = this._device.createRenderPipeline({
      layout : pipLayout,
      vertex : {
        module:this._mod, entryPoint:'vMain',
        buffers:[{ arrayStride:8,
                   attributes:[{ shaderLocation:0, offset:0, format:'float32x2'}] }]
      },
      fragment:{ module:this._mod, entryPoint:'fMain',
                 targets:[{ format:this._canvasFormat }] },
      primitive:{ topology:'triangle-strip' }
    });

    /* two bind groups share same layout but different buffers */
    this._bgBase = this._device.createBindGroup({
      layout:bgl,
      entries:[
        { binding:0, resource:{ buffer:this._cBase }},
        { binding:1, resource:{ buffer:this._tBtnBuf }}   // offset = 0 for base
      ]
    });
    this._bgBtn  = this._device.createBindGroup({
      layout:bgl,
      entries:[
        { binding:0, resource:{ buffer:this._cBtn }},
        { binding:1, resource:{ buffer:this._tBtnBuf }}
      ]
    });
  }

  async createComputePipeline() {}
  compute() {}

  /* ────────────────── Runtime helpers ────────────────── */
  bbox(){   // used by game.js for overlap test
    return { x:this.tl[0], y:this.tl[1], w:this.w, h:this.hBase };
  }

  press(){
    if(this._pressed) return;          // already green
    this._pressed   = true;
    this._btnYOffset = -this.hBtn;     // slide down one cap-height
    this._btnCol    = new Float32Array([0,1,0,1]);   // turn green

    this._device.queue.writeBuffer(this._cBtn,  0, this._btnCol);
    this._btnOffset[1] = this._btnYOffset;
    this._device
    .queue.writeBuffer(this._tBtnBuf, 0, this._btnOffset);
  }

  release(){              // ← add this
       if(!this._pressed) return;
       this._pressed = false;
       this._btnYOffset = 0;
       this._btnCol = new Float32Array([1,0,0,1]);   // red again
       this._device.queue.writeBuffer(this._cBtn,0,this._btnCol);
       this._btnOffset[1] = 0;
      this._device.queue.writeBuffer(this._tBtnBuf,0,this._btnOffset);
     }

  render(pass){
    pass.setPipeline(this._pipe);

    /* draw base quad (first 4 verts) */
    pass.setBindGroup(0, this._bgBase);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);

    /* draw button quad (next 4 verts) */
    pass.setBindGroup(0, this._bgBtn);
    pass.setVertexBuffer(0, this._vbuf, 32);   // skip first 4 verts (4*2*4 bytes)
    pass.draw(4);
  }
}

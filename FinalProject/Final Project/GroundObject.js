// /FinalProject/Final Project/GroundObject.js
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

/* Draws one axis‑aligned rectangle.
 *
 * width, height : size in NDC units (‑1 … +1)
 * topLeft       : [x, y] of the rectangle’s upper‑left corner
 * color         : Float32Array([r,g,b,a])
 */
export default class GroundObject extends SceneObject {
  constructor(device,
              canvasFormat,
              width    = 2.0,
              height   = 0.05,
              topLeft  = [-1.0, -1.0 + 0.05],     // default = a floor strip
              color    = new Float32Array([0.26, 0.18, 0.13, 1])) {
    super(device, canvasFormat);
    this.tl   = topLeft;
    this.w    = width;
    this.h    = height;
    this.color = color;
  }
 
  /* ---------- geometry ---------- */
  async createGeometry() {
    const [x0, y0] = this.tl;
    const x1 = x0 + this.w;
    const y1 = y0 - this.h;                   // remember NDC Y is up

    // triangle‑strip : v0‑v1‑v2‑v3
    this._verts = new Float32Array([
      x0, y0,   x1, y0,   x0, y1,   x1, y1
    ]);

    this._vbuf = this._device.createBuffer({
      size: this._verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, this._verts);

    this._cbuf = this._device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._cbuf, 0, this.color);
  }

  /* ---------- shaders ---------- */
  async createShaders() {
    const code = `
      @group(0) @binding(0) var<uniform> uCol : vec4<f32>;

      @vertex
      fn vMain(@location(0) pos : vec2<f32>) -> @builtin(position) vec4<f32> {
        return vec4<f32>(pos, 0.0, 1.0);
      }

      @fragment
      fn fMain() -> @location(0) vec4<f32> { return uCol; }
    `;
    this._mod = this._device.createShaderModule({code});
  }

  /* ---------- pipeline & bind group ---------- */
  async createRenderPipeline() {
    const bgl = this._device.createBindGroupLayout({
      entries:[{binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{}}]
    });
    this._bindGroup = this._device.createBindGroup({
      layout:bgl,
      entries:[{binding:0, resource:{buffer:this._cbuf}}]
    });
    this._pipe = this._device.createRenderPipeline({
      layout:this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{
        module:this._mod, entryPoint:'vMain',
        buffers:[{
          arrayStride:8,
          attributes:[{shaderLocation:0, offset:0, format:'float32x2'}]
        }]
      },
      fragment:{module:this._mod, entryPoint:'fMain',
                targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }

  async createComputePipeline() {}
  compute() {}

  render(pass){
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);
  }
}

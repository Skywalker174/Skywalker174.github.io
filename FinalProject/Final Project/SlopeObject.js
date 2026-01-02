// /FinalProject/Final Project/SlopeObject.js
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class SlopeObject extends SceneObject {
  constructor(device, canvasFormat,
              points,      // 4 × [x,y] CCW order
              color = new Float32Array([0.26,0.18,0.13,1])) {
    super(device, canvasFormat);
    this.pts  = points.flat();      // flatten array
    this.color = color;
  }

  async createGeometry() {
    this._verts = new Float32Array(this.pts);
    this._vbuf  = this._device.createBuffer({
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

  async createShaders() {
    const code = `
      @group(0) @binding(0) var<uniform> uCol: vec4<f32>;
      @vertex fn vMain(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32>{
        return vec4<f32>(p,0,1);
      }
      @fragment fn fMain() -> @location(0) vec4<f32>{ return uCol; }
    `;
    this._mod = this._device.createShaderModule({code});
  }

  async createRenderPipeline() {
    const bgl = this._device.createBindGroupLayout({
      entries:[{binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{}}]
    });
    this._bindGroup = this._device.createBindGroup({
      layout:bgl, entries:[{binding:0, resource:{buffer:this._cbuf}}]
    });
    this._pipe = this._device.createRenderPipeline({
      layout:this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{module:this._mod, entryPoint:'vMain',
              buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]},
      fragment:{module:this._mod, entryPoint:'fMain',
                targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }

  async createComputePipeline() {}
  compute() {}
  render(pass){
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0,this._bindGroup);
    pass.setVertexBuffer(0,this._vbuf);
    pass.draw(4);
  }
}

//  DiamondObject.js –– little shiny pick-ups ---------------------------------
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

/*  Simple 2-D diamond (a 45°-rotated square) drawn with a triangle-strip.
 *  The “size” argument is half the width measured from tip to tip.        */
export default class DiamondObject extends SceneObject {
  constructor(device, canvasFmt,
              center     = [0,0],
              size       = 0.04,
              colorRGBA  = [1,0.9,0.2,1]         // gold-yellow
  ){
    super(device, canvasFmt);
    this._cx = center[0];               // centre X in NDC
    this._cy = center[1];               // centre Y in NDC
    this._rad= size;
    this._col= new Float32Array(colorRGBA);
    this.collected = false;             // game checks this flag
  }

  /* ------------ GPU buffers ------------ */
  async createGeometry(){
    const r=this._rad, x=this._cx, y=this._cy;
    /* V0 top  V1 right  V2 left  V3 bottom – triangle-strip order */
    this._verts = new Float32Array([
      x,     y+r,
      x+r,   y,
      x-r,   y,
      x,     y-r
    ]);
    this._vbuf = this._device.createBuffer({
      size:this._verts.byteLength,
      usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf,0,this._verts);

    this._cbuf = this._device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._cbuf,0,this._col);
  }
  async createShaders(){
    const code = /* wgsl */`
      @group(0) @binding(0) var<uniform> uCol : vec4<f32>;

      @vertex  fn vMain(@location(0) pos: vec2<f32>)
                -> @builtin(position) vec4<f32> {
        return vec4<f32>(pos,0.0,1.0);
      }
      @fragment fn fMain() -> @location(0) vec4<f32> { return uCol; }
    `;
    this._mod=this._device.createShaderModule({code});
  }
  async createRenderPipeline(){
    const bgl=this._device.createBindGroupLayout({
      entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{}}]
    });
    this._bind=this._device.createBindGroup({
      layout:bgl, entries:[{binding:0,resource:{buffer:this._cbuf}}]
    });
    this._pipe=this._device.createRenderPipeline({
      layout:this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{
        module:this._mod,entryPoint:'vMain',
        buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]
      },
      fragment:{module:this._mod,entryPoint:'fMain',
                targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }
  async createComputePipeline(){}
  updateGeometry(){}                               // static

  /* --------- draw only if not collected -------- */
  render(pass){
    if(this.collected) return;
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0,this._bind);
    pass.setVertexBuffer(0,this._vbuf);
    pass.draw(4);
  }

  bbox(){  // square AABB for quick collision
    return {x:this._cx-this._rad, y:this._cy+this._rad,
            w:this._rad*2,         h:this._rad*2};
  }
  /* mark collected and make invisible */
  pickUp(){ this.collected=true; }
  compute(){}
}

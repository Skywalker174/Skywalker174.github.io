// DoorObject.js  – static 2‑colour “portal” for each hero
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class DoorObject extends SceneObject {
  /** side = 'red' | 'blue'  (symbol colour) */
  constructor(device, canvasFmt, rect, side){
    super(device, canvasFmt);
    this._rect = {...rect};
    this._baseCol = new Float32Array([0.30,0.25,0.15,1]);  // brownish door
    this._symCol  = side === 'red'
                    ? new Float32Array([1.0,0.2,0.2,1])
                    : new Float32Array([0.2,0.8,1.0,1]);
  }
  bbox(){ return this._rect; }

  /* geometry = door quad + tiny line‑strip symbol */
  async createGeometry(){
    const {x,y,w,h} = this._rect;
    const rim = 0.015;           // border inset for symbol
    /* V0..V3 = door, V4..V… = gender symbol (circle+arrow/cross) */
    const sx = x + rim;            // symbol quad inset
    const sy = y - rim;
    const sw = w - rim*2.0;
    const sh = h - rim*2.0;
    const verts = [
       /* door */   x,  y,      x+w,  y,     x,  y-h,     x+w,  y-h,
      /* symbol */ sx, sy,     sx+sw, sy,   sx, sy-sh,   sx+sw, sy-sh,
     ];
    this._vbuf = this._device.createBuffer(
      {size: verts.length*4, usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._vbuf, 0, new Float32Array(verts));

    /* colours: door uses entry 0, symbol uses entry 1 */
    this._cbuf = this._device.createBuffer({size:32, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this._device.queue.writeBuffer(this._cbuf, 0,   this._baseCol, 0);
    this._device.queue.writeBuffer(this._cbuf, 16,  this._symCol , 0);
  }
  async createShaders(){
    const code = /* wgsl */`
    struct Colors {
      col0 : vec4<f32>,
      col1 : vec4<f32>,
    };
    
    @group(0) @binding(0)
    var<uniform> u : Colors;
    
    struct VSOut {
      @builtin(position) pos  : vec4<f32>,
      @location(0) @interpolate(flat) flag : u32,   // <- NEW!
    };
    
    @vertex
    fn vMain(@location(0) pos : vec2<f32>,
             @builtin(vertex_index) i : u32) -> VSOut {
      var out : VSOut;
      out.pos  = vec4f(pos, 0.0, 1.0);
      out.flag = select(0u, 1u, i >= 4u);            // verts 0‑3 = door, 4+ = icon
      return out;
    }
    
    @fragment
    fn fMain(in : VSOut) -> @location(0) vec4<f32> {
      return select(u.col0, u.col1, in.flag == 1u);  // same select trick
    }
    `;
    
    this._mod = this._device.createShaderModule({code});
  }
  
  async createRenderPipeline(){
    const bgl = this._device.createBindGroupLayout({
      entries:[{binding:0, visibility:GPUShaderStage.FRAGMENT, buffer:{}}]});
    this._bindGroup = this._device.createBindGroup({
      layout:bgl, entries:[{binding:0, resource:{buffer:this._cbuf}}]});
    this._pipe = this._device.createRenderPipeline({
      layout:this._device.createPipelineLayout({bindGroupLayouts:[bgl]}),
      vertex:{module:this._mod, entryPoint:'vMain',
              buffers:[{arrayStride:8, attributes:[{shaderLocation:0,offset:0,format:'float32x2'}]}]},
      fragment:{module:this._mod, entryPoint:'fMain',
                targets:[{format:this._canvasFormat}]},
      primitive:{topology:'triangle-strip'}
    });
  }
  async createComputePipeline(){}
  updateGeometry(){}
  render(pass){
    pass.setPipeline(this._pipe);
    pass.setBindGroup(0,this._bindGroup);
    pass.setVertexBuffer(0,this._vbuf);
  
    pass.draw(4);        // door
    pass.draw(4, 1, 4);  // symbol (4 verts, 1 instance, firstVertex = 4)
  }
  
  compute(){}
}

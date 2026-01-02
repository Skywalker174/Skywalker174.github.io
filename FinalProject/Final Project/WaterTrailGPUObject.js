// WaterTrailGPUObject.js – compact, steady bubble plume with faster centre rise
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class WaterTrailGPUObject extends SceneObject {
  constructor(device, fmt, count = 60) {              // similar density to fire
    super(device, fmt);
    this.N    = count;
    this.dt   = 1 / 60;
    this.seed = Math.random() * 1e4;
  }

  /* ─────────── buffers ─────────── */
  async createGeometry() {
    const storage = new Float32Array(this.N * 6);     // pos,vel,life,size
    for (let i = 0; i < this.N; i++) {
      storage[i*6 + 4] = Math.random();               // staggered life
      storage[i*6 + 5] = 0.003 + Math.random()*0.003; // tiny bubble size
    }
    this.pBuf = this._device.createBuffer({
      size: storage.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.pBuf.getMappedRange()).set(storage);
    this.pBuf.unmap();

    this.uParam = this._device.createBuffer({ size:16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    this.uCol = this._device.createBuffer({ size:32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    // bright‑cyan → deep‑blue
    this._device.queue.writeBuffer(
      this.uCol, 0,
      new Float32Array([0.4,0.8,1.1,0,  0.05,0.15,0.3,0])
    );
  }

  /* ─────────── shaders ─────────── */
  async createShaders() {
    this.csMod = this._device.createShaderModule({ code: this.#csWGSL() });
    this.vfMod = this._device.createShaderModule({ code: this.#vsfsWGSL() });
  }

  #csWGSL() { return /* wgsl */`
struct Particle { pos:vec2<f32>, vel:vec2<f32>, life:f32, size:f32, };
struct Params   { origin:vec2<f32>, dt:f32, seed:f32, };

@group(0) @binding(0) var<storage, read_write> P : array<Particle>;
@group(0) @binding(1) var<uniform>             U : Params;

fn hash(n:f32)->f32 { return fract(sin(n)*43758.5453); }
fn noise(p:vec2<f32>)->f32 { return hash(dot(p, vec2<f32>(127.1,311.7))); }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let i = gid.x;
  if (i >= arrayLength(&P)) { return; }

  var p = P[i];

  if (p.life <= 0.0) {                          // ── respawn bubble ──
    let h  = hash(U.seed + f32(i));
    let vx = (hash(h+1.0) - 0.5) * 0.06;        // −0.06 … 0.06 lateral
    /* centreFactor: 1 at centre, 0 at edge */
    let centre = 1.0 - clamp(abs(vx)/0.06, 0.0, 1.0);

    /* upward speed & lifetime scale with centre */
    let vy     = 0.02 + centre * 0.04 + hash(h+2.0)*0.01; // centre up to ~0.07
    p.vel      = vec2<f32>(vx, vy);

    p.pos  = U.origin;
    p.size = 0.0025 + hash(h+3.0)*0.003;
    p.life = mix(0.40, 0.80, centre);            // centre bubbles live longer
  } else {                                       // ── update ──
    // gentle swirl for meandering
    let swirl = vec2<f32>(
      noise(p.pos.yx + 0.25) - 0.5,
      noise(p.pos.xy - 0.18) - 0.5) * 0.12;
    p.vel += swirl * U.dt;
    p.vel.y += 0.03 * U.dt;                      // buoyancy
    p.pos += p.vel * U.dt;
    p.life -= 0.70 * U.dt;                       // fade
  }
  P[i] = p;
}`;}

  #vsfsWGSL() { return /* wgsl */`
struct Particle { pos:vec2<f32>, vel:vec2<f32>, life:f32, size:f32, };
struct Colours  { bright:vec4<f32>, dark:vec4<f32> };

@group(0) @binding(0) var<storage, read> particles : array<Particle>;
@group(0) @binding(1) var<uniform>       C         : Colours;

struct VSOut { @builtin(position) pos:vec4<f32>, @location(0) life:f32 };

@vertex
fn vs(@builtin(vertex_index) v:u32,
      @builtin(instance_index) i:u32) -> VSOut {
  let p = particles[i];
  let c = vec2<f32>( select(-1.0,1.0,(v&1u)==1u),
                     select(-1.0,1.0,(v&2u)==2u) );
  var o:VSOut;
  o.pos  = vec4<f32>(p.pos + c * p.size, 0.0, 1.0);
  o.life = p.life;
  return o;
}

@fragment
fn fs(@location(0) life:f32) -> @location(0) vec4<f32> {
  let col = mix(C.dark.rgb, C.bright.rgb, life);
  return vec4<f32>(col, life);
}`;}

  /* ─────────── pipelines (same skeleton) ─────────── */
  async createComputePipeline() {
    const bglC = this._device.createBindGroupLayout({
      entries:[
        { binding:0, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'} },
        { binding:1, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'} }
      ]});
    this.bgC = this._device.createBindGroup({
      layout:bglC,
      entries:[
        { binding:0, resource:{ buffer:this.pBuf } },
        { binding:1, resource:{ buffer:this.uParam } }
      ]});
    this.cPipe = this._device.createComputePipeline({
      layout: this._device.createPipelineLayout({ bindGroupLayouts:[bglC] }),
      compute:{ module:this.csMod, entryPoint:'main' }
    });
  }

  async createRenderPipeline() {
    const bglR = this._device.createBindGroupLayout({
      entries:[
        { binding:0, visibility:GPUShaderStage.VERTEX,   buffer:{type:'read-only-storage'} },
        { binding:1, visibility:GPUShaderStage.FRAGMENT, buffer:{type:'uniform'} }
      ]});
    this.bgR = this._device.createBindGroup({
      layout:bglR,
      entries:[
        { binding:0, resource:{ buffer:this.pBuf } },
        { binding:1, resource:{ buffer:this.uCol } }
      ]});
    this.rPipe = this._device.createRenderPipeline({
      layout: this._device.createPipelineLayout({ bindGroupLayouts:[bglR] }),
      vertex:{ module:this.vfMod, entryPoint:'vs', buffers:[] },
      fragment:{ module:this.vfMod, entryPoint:'fs',
        targets:[{ format:this._canvasFormat,
          blend:{ color:{srcFactor:'src-alpha', dstFactor:'one', operation:'add'},
                  alpha:{srcFactor:'one', dstFactor:'one-minus-src-alpha', operation:'add'} } }] },
      primitive:{ topology:'triangle-strip' }
    });
  }

  /* ─────────── per‑frame uniform update ─────────── */
  setOrigin(x, y) {
    this._device.queue.writeBuffer(this.uParam, 0,
      new Float32Array([x, y, this.dt, this.seed]));
  }

  /* ─────────── simulate & draw ─────────── */
  compute(pass) {
    pass.setPipeline(this.cPipe);
    pass.setBindGroup(0, this.bgC);
    pass.dispatchWorkgroups((this.N + 63) >> 6);
  }
  render(pass) {
    pass.setPipeline(this.rPipe);
    pass.setBindGroup(0, this.bgR);
    pass.draw(4, this.N);
  }
}

//  ProceduralBackgroundObject.js
import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class ProceduralBackgroundObject extends SceneObject {
  constructor(device, canvasFormat,
              // gray‑brown with a whisper of green (top & darker bottom)
              topRGB = new Float32Array([0.28, 0.29, 0.27]),
              botRGB = new Float32Array([0.18, 0.20, 0.18])) {
    super(device, canvasFormat);
    this._top = topRGB;
    this._bot = botRGB;
  }

  /* ---------- geometry (full‑screen quad) ---------- */
  async createGeometry() {
    const verts = new Float32Array([
      -1,  1,   0, 0,
       1,  1,   1, 0,
      -1, -1,   0, 1,
       1, -1,   1, 1
    ]);
    this._vbuf = this._device.createBuffer({
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._vbuf, 0, verts);

    /* two vec4<f32> = 8 floats = 32 bytes */
    const uData = new Float32Array([
      ...this._top, 1.0,      // vec4 top
      ...this._bot, 1.0       // vec4 bottom
    ]);
    this._ubuf = this._device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._ubuf, 0, uData);
  }

  /* ---------- shaders ---------- */
  async createShaders() {
    const code = /* wgsl */`
struct Colours {
  top : vec4<f32>,
  bot : vec4<f32>,
};

@group(0) @binding(0) var<uniform> uCol : Colours;

/* ───── helpers: value‑noise → 4‑octave FBM ───── */
fn hash(p : vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453123);
}

fn noise(p : vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));

  let mixX1 = mix(a, b, u.x);
  let mixX2 = mix(c, d, u.x);
  return mix(mixX1, mixX2, u.y);
}

fn fbm(p : vec2<f32>) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var freq = 1.0;

  v = v + amp * noise(p * freq);
  amp = amp * 0.5;   freq = freq * 2.0;
  v = v + amp * noise(p * freq);
  amp = amp * 0.5;   freq = freq * 2.0;
  v = v + amp * noise(p * freq);
  amp = amp * 0.5;   freq = freq * 2.0;
  v = v + amp * noise(p * freq);

  return v;
}

/* ───── vertex ↔ fragment payload ───── */
struct VSOut {
  @builtin(position) pos : vec4<f32>,
  @location(0)       uv  : vec2<f32>,
};

@vertex
fn vMain(@location(0) pos : vec2<f32>,
         @location(1) uvIn: vec2<f32>) -> VSOut {
  var o : VSOut;
  o.pos = vec4<f32>(pos, 0.0, 1.0);
  o.uv  = uvIn;
  return o;
}

@fragment
fn fMain(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  /* rocky value‑noise */
  let n = fbm(uv * 10.0);           // 0‥1
  /* shade base colour by noise (0.4‥1.0) */
  let shade = 0.4 + 0.6 * n;
  let col   = mix(uCol.bot.rgb, uCol.top.rgb, shade);
  return vec4<f32>(col, 1.0);
}`;
    this._mod = this._device.createShaderModule({ code });
  }

  /* ---------- pipeline ---------- */
  async createRenderPipeline() {
    const bgl = this._device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }]
    });

    this._bindGroup = this._device.createBindGroup({
      layout: bgl,
      entries: [{ binding: 0, resource: { buffer: this._ubuf } }]
    });

    this._pipeline = this._device.createRenderPipeline({
      layout: this._device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex: {
        module: this._mod,
        entryPoint: 'vMain',
        buffers: [{
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // pos
            { shaderLocation: 1, offset: 8, format: 'float32x2' }  // uv
          ]
        }]
      },
      fragment: {
        module: this._mod,
        entryPoint: 'fMain',
        targets: [{ format: this._canvasFormat }]
      },
      primitive: { topology: 'triangle-strip' }
    });
  }
  async createComputePipeline() {}          // none needed

  /* ---------- draw & stub compute ---------- */
  render(pass) {
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vbuf);
    pass.draw(4);
  }
  compute(_pass) {}                         // background has no compute step
}

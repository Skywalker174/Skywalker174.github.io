import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js'

export default class ParticleSystemObject extends SceneObject {
  constructor(device, canvasFormat, numParticles = 102400) {
    super(device, canvasFormat);
    this._numParticles = numParticles;
    this._step = 0;
    // Create a uniform buffer for mouse: [x, y, active]
    this._mouseUniformBuffer = this._device.createBuffer({
      size: 3 * 4, // 3 floats (x, y, active)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  
  async createGeometry() { 
    await this.createParticleGeometry();
  }
  
  async createParticleGeometry() {
    // Each particle now uses 7 floats:
    // [pos.x, pos.y, initPos.x, initPos.y, vel.x, vel.y, life]
    // life = 0.0 means waterfall particle; life > 0 means firework particle.
    this._particleStride = 7;
    this._particles = new Float32Array(this._numParticles * this._particleStride);
    const bufferSize = this._particles.byteLength;
    this._particleBuffers = [
      this._device.createBuffer({
         size: bufferSize,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      }),
      this._device.createBuffer({
         size: bufferSize,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      })
    ];
    this.resetParticles();
  }
    
  resetParticles() {
    // Initialize all particles as waterfall particles.
    for (let i = 0; i < this._numParticles; i++) {
      const base = i * this._particleStride;
      // Waterfall emitter: x in [-0.25, 0.25], y = 1.0.
      const x = -0.25 + Math.random() * 0.5;
      const y = 1.0;
      this._particles[base + 0] = x;  // current x
      this._particles[base + 1] = y;  // current y
      this._particles[base + 2] = x;  // initial x (emitter)
      this._particles[base + 3] = y;  // initial y (emitter)
      // Waterfall initial velocity:
      this._particles[base + 4] = 0.005;  // vx constant rightward
      this._particles[base + 5] = -(0.005 + Math.random() * 0.015); // vy downward
      // life = 0 means waterfall.
      this._particles[base + 6] = 0.0;
    }
    this._step = 0;
    this._device.queue.writeBuffer(this._particleBuffers[this._step % 2], 0, this._particles);
  }
  
  // Spawn firework particles at the given (x,y) in NDC.
  spawnFirework(x, y) {
    // For example, we'll override the first 100 particles in the array.
    const numFirework = 100;
    for (let i = 0; i < numFirework; i++) {
      const base = i * this._particleStride;
      // Set the particle's position and emitter to the clicked location.
      this._particles[base + 0] = x;  // pos.x
      this._particles[base + 1] = y;  // pos.y
      this._particles[base + 2] = x;  // initPos.x
      this._particles[base + 3] = y;  // initPos.y
      // Set velocity: upward with some horizontal randomness.
      this._particles[base + 4] = (Math.random() - 0.5) * 0.01;
      this._particles[base + 5] = 0.001 + Math.random() * 0.002;
      // Set life to a positive value to mark it as a firework particle.
      this._particles[base + 6] = 128.0;
    }
    // Write updated particles to the current ping-pong buffer.
    this._device.queue.writeBuffer(this._particleBuffers[this._step % 2], 0, this._particles);
  }
  
  updateGeometry() { }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/particles.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: "Particles Shader " + this.getName(),
      code: shaderCode,
    });
    // Create the bind group layout.
    this._bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ]
    });
    
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Particles Pipeline Layout",
      bindGroupLayouts: [ this._bindGroupLayout ],
    });
  }
  
  async createRenderPipeline() { 
    await this.createParticlePipeline();
  }
  
  async createParticlePipeline() {
    this._particlePipeline = this._device.createRenderPipeline({
      label: "Particles Render Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule, 
        entryPoint: "vertexMain",
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this._canvasFormat }]
      },
      primitives: { typology: 'line-strip' }
    });
    this._bindGroups = [
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[0] } },
          { binding: 1, resource: { buffer: this._particleBuffers[1] } },
          { binding: 2, resource: { buffer: this._mouseUniformBuffer } },
        ]
      }),
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[1] } },
          { binding: 1, resource: { buffer: this._particleBuffers[0] } },
          { binding: 2, resource: { buffer: this._mouseUniformBuffer } },
        ]
      })
    ];
  }
  
  render(pass) { 
    pass.setPipeline(this._particlePipeline); 
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.draw(128, this._numParticles);
  }
  
  async createComputePipeline() { 
    this._computePipeline = this._device.createComputePipeline({
      label: "Particles Compute Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain",
      }
    });
  }
  
  compute(pass) { 
    pass.setPipeline(this._computePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 256));
    ++this._step;
  }
  
  // Method to update the mouse uniform.
  updateMouseState(x, y, active) {
    console.log("updateMouseState called:", x, y, active);
    let data = new Float32Array([x, y, active ? 1 : 0]);
    this._device.queue.writeBuffer(this._mouseUniformBuffer, 0, data);
  }
}

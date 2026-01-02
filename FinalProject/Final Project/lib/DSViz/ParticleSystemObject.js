/*!
 * Copyright (c) 2025 SingChun LEE @ Bucknell University. CC BY-NC 4.0.
 * 
 * This code is provided mainly for educational purposes at Bucknell University.
 *
 * This code is licensed under the Creative Commons Attribution-NonCommerical 4.0
 * International License. To view a copy of the license, visit 
 *   https://creativecommons.org/licenses/by-nc/4.0/
 * or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
 *
 * You are free to:
 *  - Share: copy and redistribute the material in any medium or format.
 *  - Adapt: remix, transform, and build upon the material.
 *
 * Under the following terms:
 *  - Attribution: You must give appropriate credit, provide a link to the license,
 *                 and indicate if changes were made.
 *  - NonCommerical: You may not use the material for commercial purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */

import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js'

export default class ParticleSystemObject extends SceneObject {
  constructor(device, canvasFormat, numParticles = 4096) {
    super(device, canvasFormat);
    this._numParticles = numParticles;
    this._step = 0;
  }
  
  async createGeometry() { 
    await this.createParticleGeometry();
  }
  
  async createParticleGeometry() {
    // Each particle now uses 6 floats:
    // [pos.x, pos.y, vel.x, vel.y, _pad, flag]
    // The _pad is used for alignment so that the flag is correctly aligned.
    this._particleStride = 6;
    this._particles = new Float32Array(this._numParticles * this._particleStride);
    
    // Create ping-pong buffers for particle data.
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
    
    // Initialize particles.
    this.resetParticles();
  }
    
  resetParticles() {
    for (let i = 0; i < this._numParticles; i++) {
      const base = i * this._particleStride;
      // Random position in [-1, 1]
      const x = -1 + Math.random() * 2;
      const y = -1 + Math.random() * 2;
      this._particles[base + 0] = x;          // pos.x
      this._particles[base + 1] = y;          // pos.y
      // Initialize velocity with small random values.
      this._particles[base + 2] = (Math.random() - 0.5) * 0.005; // vel.x
      this._particles[base + 3] = (Math.random() - 0.5) * 0.005; // vel.y
      // _pad is not used – set to 0.
      this._particles[base + 4] = 0;
      // Set the color flag: even indices red (1.0), odd indices blue (0.0)
      this._particles[base + 5] = (i % 2 === 0) ? 1.0 : 0.0;
    }
    this._step = 0;
    this._device.queue.writeBuffer(this._particleBuffers[this._step % 2], 0, this._particles);
  }
  
  updateGeometry() { }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/particles.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: "Particles Shader " + this.getName(),
      code: shaderCode,
    });
    // Create a bind group layout for the two ping-pong buffers.
    // For rendering, the vertex shader only reads from binding 0.
    // For the compute stage, we use both; set binding 0 as read-only and binding 1 as compute-only.
    this._bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        { 
          binding: 0, 
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, 
          buffer: { type: "read-only-storage" } 
        },
        { 
          binding: 1, 
          visibility: GPUShaderStage.COMPUTE, // Only visible to compute shader.
          buffer: { type: "storage" }
        }
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
        targets: [{
          format: this._canvasFormat
        }]
      },
      primitives: {
        topology: 'line-strip'
      }
    }); 
    // Create bind groups for ping-pong swapping.
    this._bindGroups = [
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this._particleBuffers[0] }
          },
          {
            binding: 1,
            resource: { buffer: this._particleBuffers[1] }
          }
        ],
      }),
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: this._particleBuffers[1] }
          },
          {
            binding: 1,
            resource: { buffer: this._particleBuffers[0] }
          }
        ],
      })
    ];
  }
  
  render(pass) { 
    pass.setPipeline(this._particlePipeline); 
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    // Draw 128 vertices per particle instance.
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
    // Dispatch workgroups: assume 256 particles per workgroup.
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 256));
    ++this._step;
  }
}

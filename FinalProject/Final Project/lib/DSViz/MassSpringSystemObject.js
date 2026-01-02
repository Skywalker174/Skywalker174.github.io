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
 *                 and indicate if changes where made.
 *  - NonCommerical: You may not use the material for commerical purposes.
 *  - No additional restrictions: You may not apply legal terms or technological 
 *                                measures that legally restrict others from doing
 *                                anything the license permits.
 */

import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';

export default class MassSpringSystemObject extends SceneObject {
  constructor(device, canvasFormat, size = 16) {
    // Here, size is the number of particles per row/column.
    super(device, canvasFormat);
    this._size = size;
    this._numParticles = size * size;
    // For a grid, horizontal springs: size*(size-1) and vertical springs: size*(size-1).
    this._numSpringsTotal = this._size * (this._size - 1) * 2;
    this._step = 0;
    
    // Create a uniform buffer for wind control (1.0 = enabled, 0.0 = off)
    this._windUniformBuffer = this._device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  
  async createGeometry() {
    await this.createParticleGeometry();
    await this.createSpringGeometry();
  }
  
  async createParticleGeometry() {
    // Each particle uses 8 floats: [p.x, p.y, v.x, v.y, dv.x, dv.y, m, dummy]
    this._particles = new Float32Array(this._numParticles * 8);
    const bufferSize = this._particles.byteLength;
    this._particleBuffers = [
      this._device.createBuffer({
        label: "Particles Buffer 1 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this._device.createBuffer({
        label: "Particles Buffer 2 " + this.getName(),
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
    ];
    this.resetParticles();
  }
  
  resetParticles() {
    // Arrange particles in a square grid in a 0.7×0.7 region.
    let edgeLength = 0.7;
    let delta = edgeLength / this._size;
    for (let j = 0; j < this._size; ++j) {
      for (let i = 0; i < this._size; ++i) {
        let idx = j * this._size + i;
        let base = idx * 8;
        // According to scroll: p.x = -0.25 + delta * i; p.y = 0.5 - delta * j.
        this._particles[base + 0] = -0.25 + delta * i;
        this._particles[base + 1] = 0.5 - delta * j;
        this._particles[base + 2] = 0; // initial velocity x
        this._particles[base + 3] = 0; // initial velocity y
        this._particles[base + 4] = 0; // dv.x
        this._particles[base + 5] = 0; // dv.y
        // Mass scaled relative to number of particles.
        this._particles[base + 6] = 0.0001 * this._numParticles;
        // Pin the top row (as in scroll) so that they remain fixed.
        this._particles[base + 7] = (j == 0) ? 1 : 0;
      }
    }
    this._step = 0;
    this._device.queue.writeBuffer(this._particleBuffers[this._step % 2], 0, this._particles);
  }
  
  async createSpringGeometry() {
    this._springGroups = [[], [], [], []];
    let edgeLength = 0.7;
    let delta = edgeLength / this._size; // expected rest length for adjacent particles.
    let stiffness = 4.0;
    // Horizontal springs:
    for (let j = 0; j < this._size; j++) {
      for (let i = 0; i < this._size - 1; i++) {
        // Group index based on parity (for example: group = (j mod 2)*2 + (i mod 2)).
        let groupIndex = (j % 2) * 2 + (i % 2);
        let particleA = j * this._size + i;
        let particleB = j * this._size + i + 1;
        this._springGroups[groupIndex].push(particleA, particleB, delta, stiffness);
      }
    }
    // Vertical springs:
    for (let i = 0; i < this._size; i++) {
      for (let j = 0; j < this._size - 1; j++) {
        let groupIndex = (j % 2) * 2 + (i % 2);
        let particleA = j * this._size + i;
        let particleB = (j + 1) * this._size + i;
        this._springGroups[groupIndex].push(particleA, particleB, delta, stiffness);
      }
    }
    // Now combine each group into a Float32Array and create a GPU buffer for each.
    this._springBuffers = [];
    this._numSpringsGroups = [];
    for (let g = 0; g < 4; g++) {
      let groupArray = new Float32Array(this._springGroups[g]);
      this._numSpringsGroups[g] = groupArray.length / 4;
      let buffer = this._device.createBuffer({
        label: "Spring Buffer Group " + g + " " + this.getName(),
        size: groupArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(buffer, 0, groupArray);
      this._springBuffers.push(buffer);
    }
    this._step = 0;
  }
  
  updateGeometry() { }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/massspring.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: "MassSpring Shader " + this.getName(),
      code: shaderCode,
    });
    // Create a bind group layout for 4 buffers:
    // Binding 0: particlesIn (read-only-storage) visible in VERTEX and COMPUTE.
    // Binding 1: particlesOut (storage) visible in COMPUTE.
    // Binding 2: springsIn (read-only-storage) visible in VERTEX and COMPUTE.
    // Binding 3: windEnabled (uniform) visible in COMPUTE.
    this._bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this._pipelineLayout = this._device.createPipelineLayout({
      label: "MassSpring Pipeline Layout",
      bindGroupLayouts: [ this._bindGroupLayout ],
    });
  }
  
  async createRenderPipeline() {
    await this.createParticlePipeline();
    await this.createSpringPipeline();
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
    // Create two bind groups for ping-pong for the particle buffers.
    this._bindGroups = [
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[0] } },
          { binding: 1, resource: { buffer: this._particleBuffers[1] } },
          // For particle render, we use a temporary springs binding.
          { binding: 2, resource: { buffer: this._springBuffers[0] } },
          { binding: 3, resource: { buffer: this._windUniformBuffer } }
        ]
      }),
      this._device.createBindGroup({
        layout: this._particlePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[1] } },
          { binding: 1, resource: { buffer: this._particleBuffers[0] } },
          { binding: 2, resource: { buffer: this._springBuffers[0] } },
          { binding: 3, resource: { buffer: this._windUniformBuffer } }
        ]
      })
    ];
  }
  
  async createSpringPipeline() {
    this._springPipeline = this._device.createRenderPipeline({
      label: "Spring Render Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: "vertexSpringMain",
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: "fragmentSpringMain",
        targets: [{ format: this._canvasFormat }]
      },
      primitives: { typology: 'line-list' }
    });
  }
  
  render(pass) {
    // Draw springs by iterating over each of the 4 spring groups.
    for (let g = 0; g < 4; g++) {
      let springBindGroup = this._device.createBindGroup({
        layout: this._springPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[this._step % 2] } },
          { binding: 1, resource: { buffer: this._particleBuffers[(this._step + 1) % 2] } },
          { binding: 2, resource: { buffer: this._springBuffers[g] } },
          { binding: 3, resource: { buffer: this._windUniformBuffer } }
        ]
      });
      pass.setPipeline(this._springPipeline);
      pass.setBindGroup(0, springBindGroup);
      pass.draw(12, this._numSpringsGroups[g]);
    }
    // Draw particles.
    pass.setPipeline(this._particlePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.draw(128, this._numParticles);
  }
  
  async createComputePipeline() {
    this._computePipeline = this._device.createComputePipeline({
      label: "MassSpring Compute Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain",
      }
    });
    this._updatePipeline = this._device.createComputePipeline({
      label: "MassSpring Update Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._shaderModule,
        entryPoint: "updateMain",
      }
    });
  }
  
  compute(pass) {
    // For each spring group, compute the delta velocities.
    for (let g = 0; g < 4; g++) {
      let springBindGroup = this._device.createBindGroup({
        layout: this._computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this._particleBuffers[this._step % 2] } },
          { binding: 1, resource: { buffer: this._particleBuffers[(this._step + 1) % 2] } },
          { binding: 2, resource: { buffer: this._springBuffers[g] } },
          { binding: 3, resource: { buffer: this._windUniformBuffer } }
        ]
      });
      pass.setPipeline(this._computePipeline);
      pass.setBindGroup(0, springBindGroup);
      pass.dispatchWorkgroups(Math.ceil(this._numSpringsGroups[g] / 256));
    }
    // Update particle positions.
    pass.setPipeline(this._updatePipeline);
    pass.setBindGroup(0, this._bindGroups[this._step % 2]);
    pass.dispatchWorkgroups(Math.ceil(this._numParticles / 256));
    ++this._step;
  }
  
  // Method to update the wind uniform flag.
  setWindEnabled(enabled) {
    let data = new Float32Array([enabled ? 1.0 : 0.0]);
    this._device.queue.writeBuffer(this._windUniformBuffer, 0, data);
  }
}

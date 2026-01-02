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

import SceneObject from "/FinalProject/Final Project/lib/DSViz/SceneObject.js"

export default class CameraLineStrip2DVertexObject extends SceneObject {
  constructor(device, canvasFormat, cameraPose, vertices) {
    super(device, canvasFormat);
    // This assume each vertex has (x, y)
    this._cameraPose = cameraPose;
    if (typeof this._vertices === Float32Array) this._vertices = vertices; 
    else this._vertices = new Float32Array(vertices);
  }
  
  async createGeometry() {
    // Create vertex buffer to store the vertices in GPU
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices " + this.getName(),
      size: this._vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    // Copy from CPU to GPU
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this._vertices);
    // Defne vertex buffer layout - how the GPU should read the buffer
    this._vertexBufferLayout = {
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [{ 
        // position 0 has two floats
        shaderLocation: 0,   // position in the vertex shader
        format: "float32x2", // two coordiantes
        offset: 0,           // no offset in the vertex buffer
      }],
    };
    // Create camera pose buffer to store the uniform color in GPU
    this._cameraPoseBuffer = this._device.createBuffer({
      label: "Camera Pose " + this.getName(),
      size: this._cameraPose.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }); 
    // Copy from CPU to GPU
    this._device.queue.writeBuffer(this._cameraPoseBuffer, 0, this._cameraPose);
  }
  
  updateCameraPose() {
    this._device.queue.writeBuffer(this._cameraPoseBuffer, 0, this._cameraPose);
  }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/camera2d.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: " Shader " + this.getName(),
      code: shaderCode,
    }); 
  }
  
  async createRenderPipeline() {
    this._renderPipeline = this._device.createRenderPipeline({
      label: "Render Pipeline " + this.getName(),
      layout: "auto",
      vertex: {
        module: this._shaderModule,         // the shader code
        entryPoint: "vertexMain",           // the shader function
        buffers: [this._vertexBufferLayout] // the binded buffer layout
      },
      fragment: {
        module: this._shaderModule,    // the shader code
        entryPoint: "fragmentMain",    // the shader function
        targets: [{
          format: this._canvasFormat   // the target canvas format
        }]
      },
      primitive: {                     // instead of drawing triangles
        topology: 'line-strip'         // draw line strip
      }
    }); 
    // create bind group to bind the uniform buffer
    this._bindGroup = this._device.createBindGroup({
      label: "Renderer Bind Group " + this.getName(),
      layout: this._renderPipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this._cameraPoseBuffer }
      }],
    });
  }
  
  render(pass) {
    // add to render pass to draw the object
    pass.setPipeline(this._renderPipeline);      // which render pipeline to use
    pass.setVertexBuffer(0, this._vertexBuffer); // how the buffer are binded
    pass.setBindGroup(0, this._bindGroup);       // bind the uniform buffer
    pass.draw(this._vertices.length / 2);        // number of vertices to draw
  }
  
  async createComputePipeline() {}
  
  compute(pass) {}
}
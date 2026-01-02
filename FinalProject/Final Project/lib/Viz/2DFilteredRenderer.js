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

import Renderer from "/FinalProject/Final Project/lib/Viz/2DRenderer.js"

export default class FilteredRenderer extends Renderer{
  constructor(canvas) {
    super(canvas);
    this._filters = [];
  }
  
  async init() {
    // Check if it supports WebGPU
    if (!navigator.gpu) {
      throw Error("WebGPU is not supported in this browser.");
    }
    // Get an GPU adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw Error("Couldn't request WebGPU adapter.");
    }
    // Get a GPU device
    this._device = await adapter.requestDevice();
    // Get and set the context
    this._context = this._canvas.getContext("webgpu");
    //this._canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this._canvasFormat = "rgba8unorm";
    this._context.configure({
      device: this._device,
      format: this._canvasFormat,
    });
    this._shaderModule = this._device.createShaderModule({
      label: "Image Filter Renderer Shader",
      code: `
      @vertex
      fn vertexMain(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 6>(
          vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
          vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1)
        );
        return vec4f(pos[vIdx], 0, 1);
      }
      
      @group(0) @binding(0) var inTexture: texture_2d<f32>;
      @group(0) @binding(1) var inSampler: sampler;
      
      @fragment
      fn fragmentMain(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
        let uv = fragCoord.xy / vec2f(textureDimensions(inTexture, 0));
        return textureSample(inTexture, inSampler, uv);
      }
      `
    });
    this._pipeline = this._device.createRenderPipeline({
      label: "Image Filter Renderer Pipeline",
      layout: "auto",
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
      }
    });
    this._sampler = this._device.createSampler({
      label: "Image Filter Renderer Sampler",
      magFilter: "linear",
      minFilter: "linear"
    });
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }
  
  resizeCanvas() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth * devicePixelRatio;
    const height = window.innerHeight * devicePixelRatio;
    let imgSize = { width: width, height: height};
    // resize screen images
    this._textures = [];
    this._textures.push (
      this._device.createTexture({
        size: imgSize,
        format: this._canvasFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      }),
      this._device.createTexture({
        size: imgSize,
        format: this._canvasFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      }),
    );
    for (const obj of this._filters) {
      obj._imgWidth = this._textures[0].width;
      obj._imgHeight = this._textures[0].height;
      obj.updateGeometry();
    }
    super.resizeCanvas();
  }
  
  async appendFilterObject(obj) {
    await obj.init();
    obj._imgWidth = this._textures[0].width;
    obj._imgHeight = this._textures[0].height;
    obj.updateGeometry();
    this._filters.push(obj);
  }
  
  render() {
    // First, instead of the canvas view, render to a texture view
    super.renderToSelectedView(this._textures[0].createView());
    // Then, apply the fitlers to each texture
    for (let i = 0; i < this._filters.length; ++i) { // iterate to apply filter one after another
      // Create a gpu command encoder
      let encoder = this._device.createCommandEncoder();
      // add compute pass to compute
      const computePass = encoder.beginComputePass();
      this._filters[i].createBindGroup(this._textures[i % 2], this._textures[(i + 1) % 2]);
      this._filters[i].compute(computePass);
      computePass.end(); // end the pass
      const commandBuffer = encoder.finish();
      // Submit to the device to compute
      this._device.queue.submit([commandBuffer]);
    }
    // Last, attach the output view to see the result on the canvas
    let encoder = this._device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this._context.getCurrentTexture().createView(),
        clearValue: this._clearColor,
        loadOp: "clear",
        storeOp: "store",
      }]
    });
    const bindGroup = this._device.createBindGroup({
      label: "Image Filter Renderer Bind Group",
      layout: this._pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: this._textures[this._filters.length % 2].createView()
      }, 
      {
        binding: 1,
        resource: this._sampler
      }],
    });
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6); // Draw a quad with two triangles
    pass.end();
    const commandBuffer = encoder.finish();
    this._device.queue.submit([commandBuffer]);
  }
}
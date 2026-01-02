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

export default class Renderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._objects = [];
    this._clearColor = { r: 0, g: 56/255, b: 101/255, a: 1 }; // Bucknell Blue
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
    this._canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._canvasFormat,
    });
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }
  
  resizeCanvas() {
    // Resize the canvas to match the window size
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth * devicePixelRatio;
    const height = window.innerHeight * devicePixelRatio;
    this._canvas.width = width;
    this._canvas.height = height; 
    // Scale the canvas using CSS
    this._canvas.style.width = `${window.innerWidth}px`;
    this._canvas.style.height = `${window.innerHeight}px`;
    // Apply the Y-axis flip using CSS transform
    //this.canvas.style.transform = "scaleY(-1)";
    this._canvas.style.transformOrigin = "center"; // Optional, ensures the flip is centered
    this.render();
  }
  
  async appendSceneObject(obj) {
    await obj.init();
    this._objects.push(obj);
  }
  
  renderToSelectedView(outputView) {
    // update cpu geometry if needed
    for (const obj of this._objects) {
      obj?.updateGeometry();
    }
    // Create a gpu command encoder
    let encoder = this._device.createCommandEncoder();
    // Use the encoder to begin render pass
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: outputView,
        clearValue: this._clearColor,
        loadOp: "clear",
        storeOp: "store",
      }]
    });
    // add more render pass to draw
    for (const obj of this._objects) {
      obj?.render(pass);
    }
    pass.end(); // end the pass
    const computePass = encoder.beginComputePass();
    // add compute pass to compute
    for (const obj of this._objects) {
      obj?.compute(computePass);
    }
    computePass.end(); // end the pass
    // Create the command buffer
    const commandBuffer = encoder.finish();
    // Submit to the device to render
    this._device.queue.submit([commandBuffer]);
  }
  
  render() {
    this.renderToSelectedView(this._context.getCurrentTexture().createView());
  }
}

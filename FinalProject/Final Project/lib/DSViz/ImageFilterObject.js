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

export default class ImageFilterObject extends SceneObject {
  async createGeometry() {}
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/computenothing.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: " Shader " + this.getName(),
      code: shaderCode,
    }); 
  }
  
  updateGeometry() {}
  
  async createRenderPipeline() {}
  
  render(pass) {}
  
  async createComputePipeline() {
    // Create a compute pipeline that updates the image.
    this._computePipeline = this._device.createComputePipeline({
      label: "Image Filter Pipeline " + this.getName(),
      layout: "auto",
      compute: {
        module: this._shaderModule,
        entryPoint: "computeMain",
      }
    });
  }
  
  createBindGroup(inTexture, outTexture) {
    // Create a bind group
    this._bindGroup = this._device.createBindGroup({
      label: "Image Filter Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: inTexture.createView()
      },
      {
        binding: 1,
        resource: outTexture.createView()
      }],
    });
    this._wgWidth = Math.ceil(inTexture.width);
    this._wgHeight = Math.ceil(inTexture.height);
  }
  
  compute(pass) {
    // add to compute pass
    pass.setPipeline(this._computePipeline);                // set the compute pipeline
    pass.setBindGroup(0, this._bindGroup);                  // bind the buffer
    pass.dispatchWorkgroups(this._wgWidth, this._wgHeight); // dispatch
  }
}
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

import ImageFilterObject from "/FinalProject/Final Project/lib/DSViz/ImageFilterObject.js"

export default class ImageNosifyFilterObject extends ImageFilterObject {
  async createGeometry() {
    this.updateGeometry(); 
  }
  
  async createShaders() {
    let shaderCode = await this.loadShader("/FinalProject/Final Project/shaders/computenosify.wgsl");
    this._shaderModule = this._device.createShaderModule({
      label: " Shader " + this.getName(),
      code: shaderCode,
    }); 
  }
  
  updateGeometry() {
    if (this._imgWidth && this._imgHeight) {
      // update the random number
      this._randomArray = new Float32Array(this._imgWidth * this._imgHeight);
      // create a buffer for the random number
      this._randomBuffer = this._device.createBuffer({
        label: "Random Buffer " + this.getName(),
        size: this._randomArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      // fill in the random values
      for (let i = 0; i < this._imgWidth * this._imgHeight; ++i) {
        this._randomArray[i] = Math.random() * 2 - 1; // range from [-1, 1]
      }
      // Copy from CPU to GPU
      this._device.queue.writeBuffer(this._randomBuffer, 0, this._randomArray);
    }
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
      },
      {
        binding: 2,
        resource: { buffer: this._randomBuffer }
      }],
    });
    this._wgWidth = Math.ceil(inTexture.width);
    this._wgHeight = Math.ceil(inTexture.height);
  }
}
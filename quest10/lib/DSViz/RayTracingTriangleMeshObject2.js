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

import RayTracingObject from "/quest10/lib/DSViz/RayTracingObject.js";
import TriangleMesh from "/quest10/lib/DS/TriangleMesh.js";
import {
  laplacianInterpolationUniform,
  laplacianInterpolationEdgeLength,
  laplacianInterpolationArea
} from "/quest10/lib/DSViz/LaplacianInterpolation.js"; // Import Laplacian interpolation functions

export default class RayTracingTriangleMeshObject extends RayTracingObject {
  constructor(device, canvasFormat, filename, camera) {
    super(device, canvasFormat);
    this._mesh = new TriangleMesh(filename);
    this._camera = camera;
  }

  async createGeometry() {
    // Ensure that the mesh initialization completes first
    await this._mesh.init();

    if (!this._mesh._vertices || !this._mesh._triangles) {
      console.error("Vertices or triangles are not properly initialized.");
      return;
    }

    this._numV = this._mesh._numV;
    this._numT = this._mesh._numT;
    this._vProp = this._mesh._vProp;

    // Flatten to 1D arrays for GPU upload
    this._vertices = this._mesh._vertices.flat();
    this._triangles = this._mesh._triangles.flat();

    if (!this._vertices || !this._triangles) {
      console.error("Vertices or triangles are still undefined.");
      return;
    }

    // ----------------------------
    // Create GPU buffers
    // ----------------------------

    // Create vertex buffer to store vertex data in GPU
    this._vertexBuffer = this._device.createBuffer({
      label: "Vertices " + this.getName(),
      size: this._vertices.length * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // Copy from CPU to GPU
    new Float32Array(this._vertexBuffer.getMappedRange()).set(this._vertices);
    this._vertexBuffer.unmap();

    // Define vertex buffer layout - how the GPU should read the buffer
    this._vertexBufferLayout = {
      arrayStride: this._vProp.length * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          // vertices
          format: "float32x3",
          offset: 0,
          shaderLocation: 0,
        },
        {
          // normals
          format: "float32x3",
          offset: 3 * Float32Array.BYTES_PER_ELEMENT,
          shaderLocation: 1,
        },
      ],
    };

    // Create index buffer to store the triangle indices in GPU
    this._indexBuffer = this._device.createBuffer({
      label: "Indices " + this.getName(),
      size: this._triangles.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // Copy from CPU to GPU
    new Uint32Array(this._indexBuffer.getMappedRange()).set(this._triangles);
    this._indexBuffer.unmap();

    // Create camera buffer to store the camera pose and scale in GPU
    this._cameraBuffer = this._device.createBuffer({
      label: "Camera " + this.getName(),
      size:
        this._camera._pose.byteLength +
        this._camera._focal.byteLength +
        this._camera._resolutions.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Copy from CPU to GPU - pose, focal, and resolutions
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
    this._device.queue.writeBuffer(
      this._cameraBuffer,
      this._camera._pose.byteLength,
      this._camera._focal
    );
    this._device.queue.writeBuffer(
      this._cameraBuffer,
      this._camera._pose.byteLength + this._camera._focal.byteLength,
      this._camera._resolutions
    );
  }

  // Compute the neighbors for each vertex based on the triangles
  computeNeighbors() {
    const neighbors = Array(this._numV).fill(null).map(() => []);

    for (let i = 0; i < this._triangles.length; i += 3) {
      const v0 = this._triangles[i];
      const v1 = this._triangles[i + 1];
      const v2 = this._triangles[i + 2];

      neighbors[v0].push(v1, v2);
      neighbors[v1].push(v0, v2);
      neighbors[v2].push(v0, v1);
    }

    return neighbors;
  }

  updateGeometry() {
    // Update the geometry (e.g., camera size)
    this._camera.updateSize(this._imgWidth, this._imgHeight);
    this._device.queue.writeBuffer(
      this._cameraBuffer,
      this._camera._pose.byteLength + this._camera._focal.byteLength,
      this._camera._resolutions
    );
  }

  updateCameraPose() {
    this._device.queue.writeBuffer(this._cameraBuffer, 0, this._camera._pose);
  }

  updateCameraFocal() {
    this._device.queue.writeBuffer(
      this._cameraBuffer,
      this._camera._pose.byteLength,
      this._camera._focal
    );
  }

  async createShaders() {
    const shaderCode = await this.loadShader("/quest10/shaders/tracemesh2.wgsl");
    this._meshShaderModule = this._device.createShaderModule({
      label: "Ray Trace Mesh Shader",
      code: shaderCode,
    });

    // Create the bind group layout
    this._bindGroupLayout = this._device.createBindGroupLayout({
      label: "Ray Trace Mesh Layout " + this.getName(),
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: {}, // Camera uniform buffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // input vertices
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // input triangle indices
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { format: this._canvasFormat }, // output texture
        },
      ],
    });

    this._pipelineLayout = this._device.createPipelineLayout({
      label: "Ray Trace Mesh Pipeline Layout",
      bindGroupLayouts: [this._bindGroupLayout],
    });
  }

  async createRenderPipeline() {}

  render(pass) {}

  createBindGroup(outTexture) {
    // Create a bind group
    this._bindGroup = this._device.createBindGroup({
      label: "Ray Trace Mesh Bind Group",
      layout: this._computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._cameraBuffer } },
        { binding: 1, resource: { buffer: this._vertexBuffer } },
        { binding: 2, resource: { buffer: this._indexBuffer } },
        { binding: 3, resource: outTexture.createView() },
      ],
    });

    this._wgWidth = Math.ceil(outTexture.width);
    this._wgHeight = Math.ceil(outTexture.height);
  }

  async createComputePipeline() {
    // Orthogonal pipeline
    this._computePipeline = this._device.createComputePipeline({
      label: "Ray Trace Mesh Orthogonal Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._meshShaderModule,
        entryPoint: "computeOrthogonalMain",
      },
    });

    // Projective pipeline
    this._computeProjectivePipeline = this._device.createComputePipeline({
      label: "Ray Trace Mesh Projective Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      compute: {
        module: this._meshShaderModule,
        entryPoint: "computeProjectiveMain",
      },
    });
  }

  compute(pass) {
    if (this._camera?._isProjective) {
      pass.setPipeline(this._computeProjectivePipeline);
    } else {
      pass.setPipeline(this._computePipeline);
    }

    pass.setBindGroup(0, this._bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this._wgWidth / 16),
      Math.ceil(this._wgHeight / 16)
    );
  }
}

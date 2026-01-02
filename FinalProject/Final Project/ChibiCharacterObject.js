import SceneObject from '/FinalProject/Final Project/lib/DSViz/SceneObject.js';
import { createChibiCharacterPolygon } from '/FinalProject/Final Project/createChibiCharacterPolygon.js';

export default class ChibiCharacterObject extends SceneObject {
  constructor(device, canvasFormat, color = new Float32Array([1, 1, 1, 1]), initialState = {}) {
    super(device, canvasFormat);
    this.position = initialState.position || [0, 0];
    this.velocity = initialState.velocity || [0, 0];
    this.characterColor = color;

    this.vertices = createChibiCharacterPolygon();

    this._translation = new Float32Array([this.position[0], this.position[1]]);

    this._aspect = new Float32Array([1.0]);
  }

  async createGeometry() {
    this._vertexBuffer = this._device.createBuffer({
      size: this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._vertexBuffer, 0, this.vertices);

    this._colorBuffer = this._device.createBuffer({
      size: 4 * 4, 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._colorBuffer, 0, this.characterColor);

    this._translationBuffer = this._device.createBuffer({
      size: 2 * 4, 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._translationBuffer, 0, this._translation);

    this._aspectBuffer = this._device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this._device.queue.writeBuffer(this._aspectBuffer, 0, this._aspect);
  }

  async createShaders() {
    const shaderCode = `
      @group(0) @binding(0) var<uniform> uColor: vec4<f32>;
      @group(0) @binding(1) var<uniform> uTranslate: vec2<f32>;
      @group(0) @binding(2) var<uniform> uAspect: f32;

      @vertex
      fn vertexMain(@location(0) pos: vec2<f32>) -> @builtin(position) vec4f {
        // Multiply x by (1.0 / uAspect) to "compress" horizontally 
        // if the canvas is wide.
        let correctedX = pos.x * (1.0 / uAspect);
        let shiftedPos = vec2f(correctedX + uTranslate.x, pos.y + uTranslate.y);
        return vec4f(shiftedPos, 0.0, 1.0);
      }

      @fragment
      fn fragmentMain() -> @location(0) vec4f {
        return uColor;
      }
    `;
    this._shaderModule = this._device.createShaderModule({
      code: shaderCode,
      label: "ChibiCharacter Shader " + this.getName(),
    });
  }

  async createRenderPipeline() {
    const vertexBufferLayout = {
      arrayStride: 2 * 4,
      attributes: [{
        shaderLocation: 0,
        offset: 0,
        format: 'float32x2'
      }],
    };

    this._bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}
        },
      ]
    });

    this._pipelineLayout = this._device.createPipelineLayout({
      bindGroupLayouts: [this._bindGroupLayout],
    });

    this._renderPipeline = this._device.createRenderPipeline({
      label: "ChibiCharacter Render Pipeline " + this.getName(),
      layout: this._pipelineLayout,
      vertex: {
        module: this._shaderModule,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: this._shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this._canvasFormat
        }]
      },
      primitive: {
        topology: 'triangle-strip',
      }
    });

    this._bindGroup = this._device.createBindGroup({
      layout: this._bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._colorBuffer } },
        { binding: 1, resource: { buffer: this._translationBuffer } },
        { binding: 2, resource: { buffer: this._aspectBuffer } },
      ],
    });
  }

  async createComputePipeline() {}
  compute(pass) {}

  updateGeometry() {
  }

  render(pass) {
    pass.setPipeline(this._renderPipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(this.vertices.length / 2);
  }

  setColor(newColorArray) {
    this.characterColor = newColorArray;
    this._device.queue.writeBuffer(this._colorBuffer, 0, this.characterColor);
  }

  setPosition(x, y) {
    this._translation[0] = x;
    this._translation[1] = y;
    this._device.queue.writeBuffer(this._translationBuffer, 0, this._translation);
  }

  setAspect(ratio) {
    this._aspect[0] = ratio; 
    this._device.queue.writeBuffer(this._aspectBuffer, 0, this._aspect);
  }
}

/* 
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

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) texCoords: vec2f
};

@vertex
fn vertexMain(@builtin(vertex_index) vIdx: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
    vec2f(1, -1), vec2f(1, 1), vec2f(-1, 1)
  );
  var texCoords = array<vec2f, 6>(
    vec2f(0, 1), vec2f(1, 1), vec2f(0, 0),
    vec2f(1, 1), vec2f(1, 0), vec2f(0, 0)
  );
  var out: VertexOutput;
  out.pos = vec4f(pos[vIdx], 0, 1);
  out.texCoords = texCoords[vIdx];
  return out;
}

@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var inSampler: sampler;

@fragment
fn fragmentMain(@location(0) texCoords: vec2f) -> @location(0) vec4f {
  return textureSample(inTexture, inSampler, texCoords);
}

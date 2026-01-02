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
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex // this compute the scene coordinate of each input vertex and its color information
fn vertexMain(@location(0) pos: vec2f, @location(1) color: vec4f) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4f(pos, 0, 1); // (pos, Z, W) = (X, Y, Z, W)
  out.color = color;
  return out;
}

@fragment // this compute the color of each pixel
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
  return color; // (R, G, B, A)
}
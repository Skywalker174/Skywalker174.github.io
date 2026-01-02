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

@group(0) @binding(0) var inTexture: texture_2d<f32>;
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage> randValues: array<f32>;

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let uv = vec2i(global_id.xy);
  let color = textureLoad(inTexture, uv, 0);
  let size = textureDimensions(inTexture);
  let i = uv.y * i32(size.x) + uv.x;
  // Nosify the image by adding salt and peper noise
  var out = color;
  if (abs(randValues[i]) < 0.3) { // add at 30%
    out.r = max(min(color.r + randValues[i], 1), 0);
    out.g = max(min(color.g + randValues[i], 1), 0);
    out.b = max(min(color.b + randValues[i], 1), 0);
  }
  out.a = color.a;
  textureStore(outTexture, uv, out);
}
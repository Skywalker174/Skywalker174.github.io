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

// struct to store 2D GA pose
struct Pose {
  rotor: vec2f,
  translator: vec2f,
  scale: vec2f,
  r_center: vec2f
};

@group(0) @binding(0) var<uniform> pose: Pose;

fn applyRotor(p: vec2f, r: vec2f) -> vec2f {
  // ref: https://geometricalgebratutorial.com/ga-basics/
  // Note: e0e0 = 1, e1e1 = 1, and e01=-e10, denote the scalar term as S
  // The multiplication table is:
  //   SS   = S   , Se0            = e0   , Se1   = e1  , Se01             = e01
  //   e0S  = e0  , e0e0           = S    , e0e1  = e01 , e0e01  =  1e1    = e1
  //   e1S  = e1  , e1e0           = -e01 , e1e1  = S   , e1e01  = -e1e10  = -e0
  //   e01S = e01 , e01e0 = -e10e0 = -e1  , e01e1 = e0  , e01e01 = -e01e10 = -S
  // So S   terms are: SS, e0e0, e1e1, e01e01
  //    e0  terms are: Se0, e0S, e1e01, e01e1
  //    e1  terms are: Se1, e1S, e0e01, e01e0
  //    e01 terms are: Se01, e01S, e0e1, e1e0
  // p = x e0 + y e1
  // r = c S - s e01
  // i.e. r * p = (0)S + (c*x - s*y)e0 + (c*y + s*x)e1 + (0)e01
  //            = (c*x - s*y)e0 + (c*y + s*x)e1
  // rv = c S + s e01
  // (r*p)*rv = (0)S + (c*c*x - c*s*y - c*s*y - s*s*x)e0 + (c*c*y + c*s*x + c*s*x - s*s*y)e1 + (0)e01
  //          = (c*c*x - 2*c*s*y - s*s*x) e0 + (c*c*y + 2*c*s*x - s*s*y) e1
  let c = r.x;
  let s = r.y;
  let rotated = vec2f( c * c * p.x - 2.0 * c * s * p.y - s * s * p.x, 2.0 * c * s * p.x + c * c * p.y - s * s * p.y );
  return rotated;
}

fn rotateAroundCenter(p: vec2f, c: vec2f, r: vec2f) -> vec2f {
  let translated = p - c;
  let rotated = applyRotor(translated, r);
  return rotated + c;
}

fn geometricProduct(a: vec4f, b: vec4f) -> vec4f {
  // each input is p is p[0] S + p[1] e0 + p[2] e1 + p[3] e01
  // ref: https://geometricalgebratutorial.com/ga-basics/
  // Note: e0e0 = 1, e1e1 = 1, and e01=-e10, denote the scalar term as S
  // The multiplication table is:
  //   SS   = S   , Se0            = e0   , Se1   = e1  , Se01             = e01
  //   e0S  = e0  , e0e0           = S    , e0e1  = e01 , e0e01  =  1e1    = e1
  //   e1S  = e1  , e1e0           = -e01 , e1e1  = S   , e1e01  = -e1e10  = -e0
  //   e01S = e01 , e01e0 = -e10e0 = -e1  , e01e1 = e0  , e01e01 = -e01e10 = -S
  // So S   terms are: SS, e0e0, e1e1, e01e01
  //    e0  terms are: Se0, e0S, e1e01, e01e1
  //    e1  terms are: Se1, e1S, e0e01, e01e0
  //    e01 terms are: Se01, e01S, e0e1, e1e0
  return vec4f(
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2] - a[3] * b[3], // S
    a[0] * b[1] + a[1] * b[0] - a[2] * b[3] + a[3] * b[2], // e0
    a[0] * b[2] + a[1] * b[3] + a[2] * b[0] - a[3] * b[1], // e1
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]  // e2
  );
};

fn reverse(a: vec4f) -> vec4f {
  return vec4f(a[0], a[1], a[2], -a[3]); // [S, e0, e1, -e01]
}

fn applyRotorToPoint(p: vec2f, r: vec2f) -> vec2f{
  // p = x e0 + y e1
  // r = c S - s e01
  // r * p * rv
  let rotated = geometricProduct(vec4f(r[0], 0, 0, r[1]), geometricProduct(vec4f(0, p[0], p[1], 0), reverse(vec4f(r[0], 0, 0, r[1]))));
  // to extract 2d point from the multivector, we take the e0, e1 coeeficients
  return vec2f(rotated[1], rotated[2]);
};

fn applyRotorToRotor(r: vec2f, dr: vec2f) -> vec2f {
  // to acc rotation, we only need to multiply the two rotors
  let rotated = geometricProduct(vec4f(r[0], 0, 0, r[1]), vec4f(dr[0], 0, 0, dr[1]));
  // to extract 2d rotor from the multivector, we take the S, e01 coeeficients
  return vec2f(rotated[0], rotated[3]);
}

fn rotateAroundCenterUsingGeometricProduct(p: vec2f, c: vec2f, r: vec2f) -> vec2f {
  let translated = p - c;
  let rotated = applyRotorToPoint(translated, r);
  return rotated + c;
}

@vertex // this compute the scene coordinate of each input vertex
fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  // Apply rotor
  //let rotated = rotateAroundCenter(pos, pose.r_center, pose.rotor);
  let rotated = rotateAroundCenterUsingGeometricProduct(pos, pose.r_center, pose.rotor);
  // Apply translator
  let transformed = rotated + pose.translator;
  // Apply scale
  let scaled = transformed * pose.scale;
  return vec4f(scaled, 0, 1); // (pos, Z, W) = (X, Y, Z, W)
}

@fragment // this compute the color of each pixel
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(238.f/255, 118.f/255, 35.f/255, 1); // (R, G, B, A)
}
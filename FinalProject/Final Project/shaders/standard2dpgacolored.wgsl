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

// struct to store a multi vector
struct MultiVector {
  s: f32,
  exey: f32,
  eoex: f32,
  eoey: f32
};

// struct to store 2D PGA pose
struct Pose {
  motor: MultiVector,
  scale: vec2f
};


@group(0) @binding(0) var<uniform> pose: Pose;

fn geometricProduct(a: MultiVector, b: MultiVector) -> MultiVector {
  // Note, both points and motors are using scalar (1), exey, eoex, eoey
  // We don't need a full geometric product (all other coefficients are zeros)
  // ref: https://geometricalgebratutorial.com/pga/
  // The geometric product rules are:
  //   1. eoeo = 0, exex = 1 and eyey = 1
  //   2. eoex + exeo = 0, eoey + eyeo = 0 exey + eyex = 0
  // Then, we have the below product table
  // ss    = scalar , sexey                        = exey    , seoex                                  = eoex  , seoey                        = eoey
  // exeys = exey   , exeyexey = -eyexexey = -eyey = -scalar , exeyeoex = -exeyexeo = eyexexeo = eyeo = -eoey , exeyeoey = -exeoeyey = -exeo = eoex
  // eoexs = eoex   , eoexexey                     = eoey    , eoexeoex = -exeoeoex                   = 0     , eoexeoey = -exeoeoey         = 0
  // eoeys = eoey   , eoeyexey = -eoexeyey         = -eoex   , eoeyeoex = -eyeoeoex                   = 0     , eoeyeoey = -eyeoeoey         = 0
  // i.e. group by terms, when we multiple two multivectors, the coefficients of each term are:
  // scalar term: a.s * b.s - a.exey * b.exey
  // exey term: a.s * b.exey + a.exey * b.s
  // eoex term: a.s * b.eoex + a.exey * b.eoey + a.eoex * b.s - a.eoey * b.exey
  // eoey term: a.s * b.eoey - a.exey * b.eoex + a.eoex * b.exey + a.eoey * b.s
  return MultiVector(
    a.s * b.s - a.exey * b.exey , // scalar
    a.s * b.exey + a.exey * b.s , // exey
    a.s * b.eoex + a.exey * b.eoey + a.eoex * b.s - a.eoey * b.exey, // eoex
    a.s * b.eoey - a.exey * b.eoex + a.eoex * b.exey + a.eoey * b.s  // eoey
  );
}
fn reverse(a: MultiVector) -> MultiVector {
  // The reverse is the reverse order of the basis elements
  // e.g. the reverse of exey is eyex = -exey
  //      the reverse of eoex is exeo = -exeo
  //      the reverse of eoey is eyeo = -eyeo
  //      the reverse of a scalar is the scalar
  // So, for an input a as an array storing the coefficients of [s, exey, eoex, eoey],
  // Its reverse is [s, -exey, -eoex, -eoey].
  return MultiVector( a.s, -a.exey, -a.eoex, -a.eoey );
}

fn applyMotor(p: MultiVector, m: MultiVector) -> MultiVector {
  // To apply a motor to a point, we use the sandwich operation
  // The formula is m * p * reverse of m
  return geometricProduct(m, geometricProduct(p, reverse(m)));
}

fn createPoint(p: vec2f) -> MultiVector {
  // A point is given by exey + x eyeo + y eoex
  return MultiVector(0, 1, p.y, -p.x);
}

fn extractPoint(p: MultiVector) -> vec2f {
  // to extract the 2d pont from a exey + b eyeo + c eoex
  // we have x = -b/a and y = c/a
  return vec2f(-p.eoey / p.exey, p.eoex / p.exey);
}

fn applyMotorToPoint(p: vec2f, m: MultiVector) -> vec2f {
  let new_p = applyMotor(createPoint(p), m);
  return extractPoint(new_p);
}

// A structure to store the vertex outpupt
struct VertexOutput {
  @builtin(position) position: vec4f, // a builtin position to store the output screen position
  @location(0) color: vec4f,          // color, return to the location(0) of the fragment shader
};

@vertex // this compute the scene coordinate of each input vertex and its color information
fn vertexMain(@location(0) pos: vec2f, @location(1) color: vec4f) -> VertexOutput {
  var out: VertexOutput;
  // Apply motor
  let transformed = applyMotorToPoint(pos, pose.motor);
  // Apply scale
  let scaled = transformed * pose.scale;
  out.position = vec4f(scaled, 0, 1); // (pos, Z, W) = (X, Y, Z, W)
  out.color = color;
  return out;
}

@fragment // this compute the color of each pixel
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
  return color; // (R, G, B, A)
}

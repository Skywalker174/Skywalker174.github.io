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
 
export default class PGA2D {
  static geometricProduct(a, b) { 
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
    // In code, the coefficients are in the array, 
    // we have s in [0], exey in [1], eoex in [2], eoey in [3]
    // So, we have the below implementation:
    return [
      a[0] * b[0] - a[1] * b[1] , // scalar
      a[0] * b[1] + a[1] * b[0] , // exey
      a[0] * b[2] + a[1] * b[3] + a[2] * b[0] - a[3] * b[1], // eoex
      a[0] * b[3] - a[1] * b[2] + a[2] * b[1] + a[3] * b[0]  // eoey
    ];
  }
  
  static reverse(a) {
    // The reverse is the reverse order of the basis elements
    // e.g. the reverse of exey is eyex = -exey
    //      the reverse of eoex is exeo = -exeo
    //      the reverse of eoey is eyeo = -eyeo
    //      the reverse of a scalar is the scalar
    // So, for an input a as an array storing the coefficients of [s, exey, eoex, eoey],
    // Its reverse is [s, -exey, -eoex, -eoey].
    return [ a[0], -a[1], -a[2], -a[3] ];
  }
  
  static applyMotor(p, m) {
    // To apply a motor to a point, we use the sandwich operation
    // The formula is m * p * reverse of m
    return PGA2D.geometricProduct(m, PGA2D.geometricProduct(p, PGA2D.reverse(m)));
  }
  
  static motorNorm(m) {
    // The norm of a mortor is square root of the sum of square of the terms:
    // for s + exey + eoex + eoey, we have the sum of sequare
    return Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2] + m[3] * m[3]);
  }
  
  static createTranslator(dx, dy) {
    // Given dx and dy describing the moveming in the x and y directions,
    // the translator is given by 1 + 0 exey + dx/2 exeo + dy/2 eyeo
    // In code, we always store the coefficents of scalar, exey, eoex, and eoey
    // Hence the implementation is as below
    return [1, 0, -dx / 2, -dy / 2]
  }
  
  static createRotor(angle, cx = 0, cy = 0) {
    // Given an angle and a center of rotation,
    // the rotor is given by cos(angle / 2 ) + sin(angle / 2 ) p
    // where p is exey + cx eyeo + cy eoex
    let p = PGA2D.createPoint(cx, cy);
    return [Math.cos(angle / 2), Math.sin(angle / 2) * p[1], Math.sin(angle / 2) * p[2], Math.sin(angle / 2) * p[3]];
  }
  
  static createPoint(x, y) {
    // A point is given by exey + x eyeo + y eoex
    return [0, 1, y, -x];
  }
  
  static extractPoint(p) {
    // to extract the 2d pont from a exey + b eyeo + c eoex
    // we have x = -b/a and y = c/a
    return [-p[3] / p[1], p[2] / p[1]];
  }
  
  static normaliozeMotor(m) {
    // To normalize a motor, we divide each coefficient by its norm
    let mnorm = PGA2D.motorNorm(m);
    if (mnorm == 0.0) {
      return [1, 0, 0, 0];
    }
    return [m[0] / mnorm, m[1] / mnorm, m[2] / mnorm, m[3] / mnorm];
  }
  
  static applyMotorToPoint(p, m) {
    let new_p = PGA2D.applyMotor(PGA2D.createPoint(p[0], p[1]), m);
    return PGA2D.extractPoint(new_p);
  };

}

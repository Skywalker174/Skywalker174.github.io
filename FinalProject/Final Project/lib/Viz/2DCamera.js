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
 
import PGA2D from '/FinalProject/Final Project/lib/Math/PGA2D.js'
 
export default class Camera {
  constructor() {
    this._pose = new Float32Array([1, 0, 0, 0, 1, 1]);
  }
  
  resetPose() {
    this._pose[0] = 1;
    this._pose[1] = 0;
    this._pose[2] = 0;
    this._pose[3] = 0;
    this._pose[4] = 1;
    this._pose[5] = 1;
  }
  
  updatePose(newpose) {
    this._pose[0] = newpose[0];
    this._pose[1] = newpose[1];
    this._pose[2] = newpose[2];
    this._pose[3] = newpose[3];
  }
  
  moveLeft(d) {
    let dt = PGA2D.createTranslator(-d, 0);
    let newpose = PGA2D.normaliozeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }
  
  moveRight(d) {
    let dt = PGA2D.createTranslator(d, 0);
    let newpose = PGA2D.normaliozeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }
  
  moveUp(d) {
    let dt = PGA2D.createTranslator(0, d);
    let newpose = PGA2D.normaliozeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }
  
  moveDown(d) {
    let dt = PGA2D.createTranslator(0, -d);
    let newpose = PGA2D.normaliozeMotor(PGA2D.geometricProduct(dt, [this._pose[0], this._pose[1], this._pose[2], this._pose[3]]));
    this.updatePose(newpose);
  }
  
  zoomIn() {
    this._pose[4] *= 1.1;
    this._pose[5] *= 1.1;
  }
  
  zoomOut() {
    this._pose[4] /= 1.1;
    this._pose[5] /= 1.1;
  }
}
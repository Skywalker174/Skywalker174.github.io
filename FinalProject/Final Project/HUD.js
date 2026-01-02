//  HUD.js –– on-screen frame-rate / timer / help text ------------------------
import StandardTextObject from '/FinalProject/Final Project/lib/DSViz/StandardTextObject.js';

export default class HUD extends StandardTextObject{
  constructor(){
    super("loading…");
    this._t0 = performance.now();
    this._fps = 0;
  }
  /** call once every animation-frame */
  update(dt, score){
    // low-pass filter FPS for readability
    this._fps = this._fps*0.9 + (1/dt)*0.1;
    const t   = (performance.now()-this._t0)*0.001;
    const text =
`W / ↑   jump
A,D / ←,→   move
Hold switches to use lifts / bridge

Diamonds: ${score}
Time    : ${t.toFixed(1)} s
FPS     : ${this._fps.toFixed(0)}`;
    this.updateText(text);
  }
}

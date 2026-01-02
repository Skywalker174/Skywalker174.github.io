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

export default class StandardTextObject {
  constructor(inputText, spacing = 5, textFont = '18px Arial') {
    // a temp 2d canvas to draw text as an image
    this._textFont = textFont;
    this._lineSpacing = spacing;
    this._textCanvas = document.createElement('canvas'); 
    this._textContext = this._textCanvas.getContext('2d');
    this.updateTextRegion(inputText);
    this.updateText(inputText);
    // add it to the document
    this._textCanvas.style.position = 'absolute';
    this._textCanvas.style.top = '10px';
    this._textCanvas.style.left = '10px';
    this._textCanvas.style.border = '1px solid red';
    document.body.appendChild(this._textCanvas);
  }
  
  toggleVisibility() {
    this._textCanvas.hidden = !this._textCanvas.hidden;
  }
  
  updateTextRegion(newText) {
    // get the text region width
    this._textContext.font = this._textFont;
    this._lines = newText.split('\n');
    this._width = Math.max(...this._lines.map(line => this._textContext.measureText(line).width));
    // get the text region height
    const match = this._textFont.match(/(\d+)px/);
    if (match) {
      this._fontSize = parseInt(match[1], 10);
    }
    else {
      this._fontSize = 18;
      this._textFont = "18px Arial";
    }
    this._height = this._lines.length * (this._fontSize + this._lineSpacing);
    // set padding to the text area
    this._paddingx = 5;
    this._paddingtop = 3;
    this._canvasWidth = Math.ceil(this._width + this._paddingx * 2);
    this._canvasHeight = Math.ceil(this._height + this._paddingtop);
    // set the text canvas width and height
    this._textCanvas.width = this._canvasWidth;
    this._textCanvas.height = this._canvasHeight;
    // need to reset the font after resizing the canvas
    this._textContext.font = this._textFont;
    this._textContext.textBaseline = 'top';
  }
  init() {
    return Promise.resolve();
  }
  
  
  updateText(newText) {
    this._lines = newText.split('\n');
    // fill a rectangle as a background
    this._textContext.fillStyle = 'rgba(1, 1, 1, 0.5)';
    this._textContext.clearRect(0, 0, this._canvasWidth, this._canvasHeight);
    this._textContext.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
    // draw the text
    this._textContext.fillStyle = 'white';
    this._lines.forEach((line, idx) => {
      const x = this._paddingx;
      const y = this._paddingtop + idx * (this._fontSize + this._lineSpacing);
      this._textContext.fillText(line, x, y);
    });
  }
}
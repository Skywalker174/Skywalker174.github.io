import Renderer from '/FinalProject/Final Project/lib/Viz/2DRenderer.js';
import ParticleSystemObject from '/FinalProject/Final Project/lib/DSViz/ParticleSystemObject.js';

window.onload = async function () {
  const startGameButton = document.getElementById("startGameButton");
  startGameButton.addEventListener("click", function () {
    window.location.href = "/FinalProject/Final Project/game.html";
  });

  const toggleInstructionsButton = document.getElementById("toggleInstructionsButton");
  const instructionOverlay = document.getElementById("instructionOverlay");
  const closeInstructionsButton = document.getElementById("closeInstructionsButton");

  toggleInstructionsButton.addEventListener("click", function () {
    instructionOverlay.style.display = "block";
  });
  if (closeInstructionsButton) {
    closeInstructionsButton.addEventListener("click", function () {
      instructionOverlay.style.display = "none";
    });
  }

  const canvas = document.getElementById("renderCanvas");
  const renderer = new Renderer(canvas);
  await renderer.init();

  const particleSystem = new ParticleSystemObject(renderer._device, renderer._canvasFormat, 1000);
  await particleSystem.createGeometry();
  await particleSystem.createShaders();
  await particleSystem.createRenderPipeline();
  await particleSystem.createComputePipeline();
  
  await renderer.appendSceneObject(particleSystem);

  canvas.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (-e.clientY / window.innerHeight) * 2 + 1;
    //particleSystem.updateMouseState(x, y, true);
  });
  canvas.addEventListener('mouseleave', () => {
    //particleSystem.updateMouseState(0, 0, false);
  });

  function frame() {
    const encoder = renderer._device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    particleSystem.compute(computePass);
    computePass.end();

    const textureView = renderer._context.getCurrentTexture().createView();
    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    };
    const renderPass = encoder.beginRenderPass(renderPassDescriptor);
    particleSystem.render(renderPass);
    renderPass.end();

    renderer._device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

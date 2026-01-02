Fire & Water — A Two‑Character Co‑op Puzzle‑Platformer
A WebGPU capstone for CSCI 379 (Spring 2025)

PLAY THE GAME
https://Skywalker174.github.io/FinalProject/

WHY THIS PROJECT MATTERS
Our game project is an attempt to reproduce the traditional game fireboy and watergirl on the webgpu. This attempt demonstrates that a modern, visually rich, real‑time game can run in the browser on top of raw WebGPU with no external 3‑D engine. Two elemental siblings must cooperate to leave a four‑storey laboratory, timing jumps, operating lifts and retractable bridges, and avoiding pools of the element that kills them. The game shows how far open‑web graphics and vanilla JavaScript have come.

TECHNOLOGY OVERVIEW
Rendering is built directly on the WebGPU API with shaders written in WGSL.
The game engine is hand‑rolled in ES Modules and provides physics, AABB plus slope collision, state machines for movable objects, and a HUD.
Development workflow relies on Vite for hot‑reload and ESLint for static checking.

RUNNING THE GAME LOCALLY

git clone https://github.com/Skywalker174/FinalProject
run the simple_server.py, and server starts on http://localhost:8087

Chrome or Edge (or later) are required, with the WebGPU flag enabled.

CONTROLS
Red hero: move with the A and D keys and jump with W.
Blue hero: move with the left and right arrow keys and jump with the up arrow key.

SYSTEM ARCHITECTURE
The Renderer owns a list of SceneObjects. SceneObject is an abstract base that supplies geometry, a render pipeline, and a draw method. Concrete SceneObjects include ground segments, slopes, moving platforms, vertical lifts, a hidden bridge, switches, two chibi characters, collectible diamonds, a GPU‑driven particle system, and a HUD text overlay. Game logic and the fixed‑time physics loop live in game.js.

NOTABLE ALGORITHMS
Slope collision snaps a character’s feet or head by linearly interpolating the upper and lower edges of every ramp segment.
Particle trails are updated by a WGSL compute shader that walks a 1024‑element storage buffer every frame.
The hidden bridge fades in and out by monitoring two floor‑four switches and toggling the bridge’s opacity and collision flag whenever either switch is pressed.

FUTURE WORK
Potential extensions include online cooperative play via WebRTC DataChannels, a JSON‑driven level editor with live preview, fixed‑timestep sub‑stepping for smoother physics on high‑refresh monitors, and full game‑pad and touch‑screen support.

VIDEO DEMO
The video is inside the assets/Demo.mp4


https://.com/user-attachments/assets/e659c8c1-c19e-434b-8991-ff19987b82a2




INDIVIDUAL REFLECTIONS

Aiden Ren (zr002@bucknell.edu):
During the project, I contributed mostly about making start menu and ending menu, adding floors to the game, doing collision detection, adding diamonds and score counting, creating switches and moving platform and related logic. I think we did less than what we expect, but part of the reason is that some of the planned functionalities at the beginning are actually not necessary like camera pose. The project helped me improving my skills and experience in making art and shapes using WebGPU especially about how to draw polygons and using particle effects. I did not have much experience using html files and making websites before the course, and the game did require me to do things like that, so I got some experience now. I think we spent too much time on just game logic so the graphics doesn't look that great, if we planned differently we could balance it better.

Titus Weng (tw013@bucknell.edu):
Writing this game forced me to understand bind groups versus pipelines and to learn how to debug GPU conditions with buffer downloads. I did the github setups and built ground object and ceiling object and added the flame-like effect and make it really look like a flame following the chibi characters as well as bug fixes to other parts such as character fall from slope; respawn occasionally on the floor below to the floor above, etc. Given another week I would refactor physics and fix some minor bugs and add more rendering to the texture of the floors, chibi characters themselves and adding other effects. I feel like we didn't do some of the things that were planned at the beginning, and then focused more on rebuilding the game logic itself, resulting in other aspects looking rougher. Maybe in the future we can fill the skeleton with more effects to make it look like a real game, as well as adding new levels and level select screens, death animations, different interchangeable looks for characters, etc. to make the game more playable. Overall this project helped me understand 2D WebGPU programming a lot. 

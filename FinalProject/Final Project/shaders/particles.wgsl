// particles.wgsl

// The particle structure – now with 6 floats per particle.
// Layout: [pos.x, pos.y, vel.x, vel.y, _pad, flag]
// _pad is used for alignment purposes; flag is the color flag: 1.0 = fire (red), 0.0 = ice (blue).
struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
  _pad: f32,
  flag: f32,
};

// Bindings: Two storage buffers for ping-pong updates.
@group(0) @binding(0)
var<storage, read> particlesIn: array<Particle>;
@group(0) @binding(1)
var<storage, read_write> particlesOut: array<Particle>;

// Uniforms (declared for compatibility even if not used).
@group(0) @binding(2)
var<uniform> mouse: vec3<f32>;  // (mouse.x, mouse.y, mouse.active)
@group(0) @binding(3)
var<uniform> windEnabled: f32;  // Unused

////////////////////////////////
// Vertex Shader
////////////////////////////////
struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) flag: f32,    // Pass the color flag to the fragment shader.
  @location(1) radius: f32,  // Particle draw radius.
};

@vertex
fn vertexMain(@builtin(instance_index) idx: u32,
              @builtin(vertex_index) vIdx: u32) -> VertexOutput {
  let particle = particlesIn[idx];
  // Use a constant size for all particles.
  let size: f32 = 0.005;
  // Draw a circle using 8 segments.
  let segments: u32 = 8u;
  let angle: f32 = 2.0 * 3.14159265 * f32(vIdx % segments) / f32(segments);
  let offset: vec2<f32> = vec2<f32>(cos(angle), sin(angle)) * size;
  
  var out: VertexOutput;
  out.pos = vec4f(particle.pos + offset, 0.0, 1.0);
  out.flag = particle.flag;
  out.radius = size;
  return out;
}

@fragment
fn fragmentMain(@location(0) flag: f32,
                @location(1) radius: f32) -> @location(0) vec4f {
  if (flag > 0.5) {
    // If flag > 0.5, use the fiery orange (red) color.
    return vec4f(1.0, 100.0/255.0, 0.0, 0.8);
  } else {
    // Otherwise, use the cool blue color.
    return vec4f(100.0/255.0, 200.0/255.0, 1.0, 0.8);
  }
}

////////////////////////////////
// Compute Shader
////////////////////////////////
@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let idx: u32 = global_id.x;
  if (idx >= arrayLength(&particlesIn)) { 
    return; 
  }
  
  var particle: Particle = particlesIn[idx];
  
  // Clamp velocities.
  let maxVel: f32 = 0.005;
  particle.vel.x = clamp(particle.vel.x, -maxVel, maxVel);
  particle.vel.y = clamp(particle.vel.y, -maxVel, maxVel);
  
  // If velocity is nearly zero, give a small random push.
  let epsilon: f32 = 0.0001;
  if (abs(particle.vel.x) < epsilon && abs(particle.vel.y) < epsilon) {
      particle.vel.x = (f32(idx) * 0.001 % 1.0 - 0.5) * 0.005;
      particle.vel.y = (f32(idx) * 0.007 % 1.0 - 0.5) * 0.005;
  }
  
  // Update the particle's position.
  particle.pos = particle.pos + particle.vel;
  
  // Wrap-around horizontally.
  if (particle.pos.x >= 1.0) {
    particle.pos.x = particle.pos.x - 2.0;
  } else if (particle.pos.x <= -1.0) {
    particle.pos.x = particle.pos.x + 2.0;
  }
  
  // Wrap-around vertically.
  if (particle.pos.y >= 1.0) {
    particle.pos.y = particle.pos.y - 2.0;
  } else if (particle.pos.y <= -1.0) {
    particle.pos.y = particle.pos.y + 2.0;
  }
  
  particlesOut[idx] = particle;
}

// particles.wgsl for mass-spring system

// Particle structure: 8 floats per particle.
// [p.x, p.y, v.x, v.y, dv.x, dv.y, m, dummy]
struct Particle {
  p: vec2<f32>,   // particle position
  v: vec2<f32>,   // particle velocity
  dv: vec2<f32>,  // velocity update (accumulated spring corrections)
  m: f32,         // particle mass
  dummy: f32      // dummy for memory alignment
};

// Spring structure: 4 floats per spring.
// [pts.x, pts.y, l, s]
// pts.x and pts.y are used to store the indices (as floats) of the two connected particles.
struct Spring {
  pts: vec2<f32>, // indices of two connected particles (as floats)
  l: f32,         // rest length
  s: f32          // stiffness coefficient
}

// --- Bindings ---
// Bind the storage buffer variables.
@group(0) @binding(0)
var<storage, read> particlesIn: array<Particle>;

@group(0) @binding(1)
var<storage, read_write> particlesOut: array<Particle>;

@group(0) @binding(2)
var<storage, read> springsIn: array<Spring>;

// -------- Vertex Shader for Particles --------
@vertex
fn vertexMain(@builtin(instance_index) idx: u32,
              @builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4f {
  // Draw circles to represent a particle.
  let particle = particlesIn[idx];
  // Use mass as a proxy for radius.
  let r: f32 = particle.m;
  let pi: f32 = 3.14159265;
  let theta: f32 = 2.0 * pi / 8.0 * f32(vIdx);
  let x: f32 = cos(theta) * r;
  let y: f32 = sin(theta) * r;
  return vec4f(vec2f(x + particle.p.x, y + particle.p.y), 0.0, 1.0);
}

// -------- Fragment Shader for Particles --------
@fragment
fn fragmentMain() -> @location(0) vec4f {
  // Output a constant color (orange) for particles.
  return vec4f(238.0/255.0, 118.0/255.0, 35.0/255.0, 1.0);
}

// -------- Vertex Shader for Springs --------
@vertex
fn vertexSpringMain(@builtin(instance_index) idx: u32,
                    @builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4f {
  // Draw lines to represent a spring.
  // Use the two indices stored in spring.pts to fetch particle positions.
  // We use an offset (0.001 * f32(vIdx/2)) as a hack to create a slight offset.
  let particleIndex: u32 = u32(springsIn[idx].pts[vIdx % 2]);
  return vec4f(particlesIn[particleIndex].p + 0.001 * f32(vIdx / 2), 0.0, 1.0);
}

// -------- Fragment Shader for Springs --------
@fragment
fn fragmentSpringMain() -> @location(0) vec4f {
  // Output a fixed color (orange) for springs.
  return vec4f(255.0/255.0, 163.0/255.0, 0.0/255.0, 1.0);
}

// -------- Compute Shader: Compute Spring Forces --------
@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3u) {
  let idx: u32 = global_id.x;
  // Process only if idx is within the springs array.
  if (idx >= arrayLength(&springsIn)) { return; }
  
  // Get the spring corresponding to this invocation.
  var spring = springsIn[idx];
  // Convert the indices from float to u32.
  let aIdx: u32 = u32(spring.pts.x);
  let bIdx: u32 = u32(spring.pts.y);
  
  let ptA: vec2<f32> = particlesIn[aIdx].p;
  let ptB: vec2<f32> = particlesIn[bIdx].p;
  let massA: f32 = particlesIn[aIdx].m;
  let massB: f32 = particlesIn[bIdx].m;
  
  // Compute the difference and its length.
  let diff: vec2<f32> = ptB - ptA;
  let dist: f32 = length(diff);
  // Compute spring force magnitude using Hooke's Law:
  // F = -s * (currentLength - restLength)
  // (We ignore the negative here and apply the direction manually.)
  let force: f32 = spring.s * (dist - spring.l);
  
  // Compute the normalized direction from A to B.
  let dir: vec2<f32> = normalize(diff);
  
  // Compute delta velocities using Newton's law.
  // dv = F/m. We include a factor (1/1000) for scaling.
  if (abs(massA) > 1e-6) {
    // Accumulate the delta velocity for particle A.
    particlesOut[aIdx].dv = particlesOut[aIdx].dv + (force * dir) / (massA * 1000.0);
  }
  if (abs(massB) > 1e-6) {
    // For particle B, the force is in the opposite direction.
    particlesOut[bIdx].dv = particlesOut[bIdx].dv - (force * dir) / (massB * 1000.0);
  }
}

@compute @workgroup_size(256)
fn updateMain(@builtin(global_invocation_id) global_id: vec3u) {
  let idx: u32 = global_id.x;
  if (idx < arrayLength(&particlesIn)) {
    var particle = particlesIn[idx];
    // Check if the particle is pinned.
    if (particle.dummy > 0.5) {
      particlesOut[idx] = particle;
      return;
    }
    
    // Define gravity and wind forces.
    let gravity: vec2<f32> = vec2<f32>(0.0, -0.0005);  // gravity pulls downward
    let wind: vec2<f32> = vec2<f32>(0.0003, 0.0);        // wind pushes to the right

    // Add gravity and wind to the particle's velocity.
    particle.v = particle.v + gravity + wind;
    
    // Update the position by adding the velocity and the accumulated delta velocity.
    particlesOut[idx].p = particle.p + particle.v + particlesOut[idx].dv;
    // Update the velocity with damping (multiplied by 0.95).
    particlesOut[idx].v = (particle.v + particlesOut[idx].dv) * 0.01;
    // Reset delta velocity for the next frame.
    particlesOut[idx].dv = vec2f(0.0, 0.0);
    // Copy the mass and dummy values.
    particlesOut[idx].m = particle.m;
    particlesOut[idx].dummy = particle.dummy;
  }
}





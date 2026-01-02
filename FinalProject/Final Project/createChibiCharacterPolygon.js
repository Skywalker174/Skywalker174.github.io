export function createChibiCharacterPolygon(scale = 0.2) {
    const finalCoords = [];
  
    function buildCircle(cx, cy, radius, segments) {
      const arr = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (2.0 * Math.PI * i) / segments;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        arr.push(x, y);
      }
      return arr; 
    }
  
    function buildPolygon(points) {
      const arr = [...points];
      const firstX = arr[0];
      const firstY = arr[1];
      const lastX = arr[arr.length - 2];
      const lastY = arr[arr.length - 1];
      if (firstX !== lastX || firstY !== lastY) {
        arr.push(firstX, firstY);
      }
      return arr;
    }
  
    function addShapeWithDegenerates(shapeArray) {
      if (finalCoords.length === 0) {
        finalCoords.push(...shapeArray);
      } else {
        const lastX = finalCoords[finalCoords.length - 2];
        const lastY = finalCoords[finalCoords.length - 1];
        const firstX = shapeArray[0];
        const firstY = shapeArray[1];
        finalCoords.push(lastX, lastY);   
        finalCoords.push(firstX, firstY); 
        finalCoords.push(firstX, firstY); 
        finalCoords.push(...shapeArray);
      }
    }
  
    const headRadius = 0.15;
    const headSegments = 16;
    const headCircle = buildCircle(0.0, 0.0, headRadius, headSegments);
    addShapeWithDegenerates(headCircle);
  

    const eyeRadius = 0.04;
    const eyeSegments = 12;
    const leftEyeCircle = buildCircle(-0.05, 0.05, eyeRadius, eyeSegments);
    addShapeWithDegenerates(leftEyeCircle);

    const rightEyeCircle = buildCircle(+0.05, 0.05, eyeRadius, eyeSegments);
    addShapeWithDegenerates(rightEyeCircle);
  

    const bodyPoints = [
      -0.1, -0.1,   
       0.1, -0.1,  
       0.16, -0.4,  
      -0.16, -0.4 
    ];
    const bodyPoly = buildPolygon(bodyPoints);
    addShapeWithDegenerates(bodyPoly);
  
    const leftArmPoints = [
      -0.17, -0.12, 
      -0.13, -0.12, 
      -0.13, -0.20,
      -0.17, -0.20
    ];
    const leftArmRect = buildPolygon(leftArmPoints);
    addShapeWithDegenerates(leftArmRect);
  
    const rightArmPoints = [
       0.13, -0.12,
       0.17, -0.12,
       0.17, -0.20,
       0.13, -0.20
    ];
    const rightArmRect = buildPolygon(rightArmPoints);
    addShapeWithDegenerates(rightArmRect);
  
    const leftLegPoints = [
      -0.08, -0.4,
      -0.04, -0.4,
      -0.04, -0.5,
      -0.08, -0.5
    ];
    const leftLegRect = buildPolygon(leftLegPoints);
    addShapeWithDegenerates(leftLegRect);
  
    const rightLegPoints = [
      0.04, -0.4,
      0.08, -0.4,
      0.08, -0.5,
      0.04, -0.5
    ];
    const rightLegRect = buildPolygon(rightLegPoints);
    addShapeWithDegenerates(rightLegRect);
  
    const scaledCoords = finalCoords.map(coord => coord * scale);
  
    return new Float32Array(scaledCoords);
  }
  
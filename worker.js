// Point class
class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  // Helper to subtract points (vector)
  subtract(p) {
    return new Vector(this.x - p.x, this.y - p.y);
  }
  
  // Helper to clone
  clone() {
    return new Point(this.x, this.y);
  }

  // Draw the point (small circle)
  draw(ctx, color = 'black', radius = 3) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// Vector class for directions and normals
class Vector {
  constructor(dx, dy) {
    this.dx = dx;
    this.dy = dy;
  }

  // Normalize the vector
  normalize() {
    const length = Math.hypot(this.dx, this.dy);
    return new Vector(this.dx / length, this.dy / length);
  }

  // Dot product
  dot(v) {
    return this.dx * v.dx + this.dy * v.dy;
  }

  cross(v) {
    return this.dx * v.dy - this.dy * v.dx;
  }

  // Scale
  scale(scalar) {
    return new Vector(this.dx * scalar, this.dy * scalar);
  }
  
  // Reflect around normal n (assumed normalized)
  reflect(normal) {
    // r = d - 2 * (d ⋅ n) * n
    // reflection ray = direction of light - 2 * (dir of light *dot* normal vector) * normal vector
    const dot = this.dot(normal);
    const reflectedDx = this.dx - 2 * dot * normal.dx;
    const reflectedDy = this.dy - 2 * dot * normal.dy;
    return new Vector(reflectedDx, reflectedDy);
  }


}

// LineSegment class
class LineSegment {
  constructor(startPoint, endPoint, material = [0,0,255]) {
    this.start = startPoint;
    this.end = endPoint;
    this.calculateNormal();
    this.material = new Material(1, 1, 0.5, material);
  }
  
  // Calculate normalized normal vector (perpendicular to line)
  calculateNormal() {
    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    // Perpendicular vector
    const normal = new Vector(-dy, dx).normalize();
    this.normal = normal;
  }
  
  // Ray-line segment intersection test
  // Returns the intersection point if exists, else null
  intersect(ray) {
    const p = ray.origin;
    const d = ray.direction;
    const p1 = this.start;
    const p2 = this.end;
    
    const v1 = p.subtract(p1);
    const v2 = p2.subtract(p1);
    const v3 = new Vector(-d.dy, d.dx);

    const dot = v2.dot(v3);
    if (Math.abs(dot) < 1e-8) {
      // Parallel, no intersection
      return null;
    }

    const t1 = v2.cross(v1) / dot;
    const t2 = v1.dot(v3) / dot;

    // Check if intersection is within segment bounds and in front of the ray
    if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
      const intersectX = p.x + d.dx * t1;
      const intersectY = p.y + d.dy * t1;
      return new Point(intersectX, intersectY);
    }

    return null;
  }

  // Draw the line segment
  draw(ctx, lineWidth = 2) {
    const color = this.material.color;
    ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(this.start.x, this.start.y);
    ctx.lineTo(this.end.x, this.end.y);
    ctx.stroke();
  }
}

// Ray class
class Ray {
  constructor(origin, direction, wavelength, bounceLevel = 0) {
    this.origin = origin; // Point
    this.direction = direction.normalize(); // Vector
    this.wavelength = wavelength; // in nm, e.g., 500
    this.color = wavelength;
    this.bounceLevel = bounceLevel;
  }

  // Draw the ray
  draw(ctx, length = 200) {
    const color = this.material.color;
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.01)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.origin.x, this.origin.y);
    const endX = this.origin.x + this.direction.dx * length;
    const endY = this.origin.y + this.direction.dy * length;
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  castAndDraw(ctx, objects, maxLength = 1000, color = [0,0,255,0.01]) {
    let closestDist = Infinity;
    let closestPoint = null;
    let closestObj = null;

    // Loop through all objects to find the nearest intersection
    for (const obj of objects) {
      const hitPoint = obj.intersect(this);
      if (hitPoint) {
        const dx = hitPoint.x - this.origin.x;
        const dy = hitPoint.y - this.origin.y;
        const dist = Math.hypot(dx, dy);
        if (dist < closestDist && dist > 1e-8) {
          closestDist = dist;
          closestPoint = hitPoint;
          closestObj = obj;
        }
      }
    }

    // Decide where to draw
    const drawLength = Math.min(closestDist, maxLength);
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.origin.x, this.origin.y);
    ctx.lineTo(
      this.origin.x + this.direction.dx * drawLength,
      this.origin.y + this.direction.dy * drawLength
    );
    ctx.stroke();

    // Return the intersection point for further reflection/refraction
    return [closestPoint, closestObj];
  }

  cast(walls, maxDist) {
    let closestPoint = null;
    let closestWall = null;
    let closestDist = maxDist;

    for (let wall of walls) {
      const denom = (wall.start.x - wall.end.x) * this.direction.dy -
                    (wall.start.y - wall.end.y) * this.direction.dx;
      if (Math.abs(denom) < 1e-6) continue;

      const t = ((wall.start.x - this.origin.x) * this.direction.dy -
                 (wall.start.y - this.origin.y) * this.direction.dx) / denom;
      const u = ((wall.start.x - this.origin.x) * (wall.start.y - wall.end.y) -
                 (wall.start.y - this.origin.y) * (wall.start.x - wall.end.x)) / denom;

      if (t >= 0 && t <= 1 && u > 0 && u < closestDist) {
        closestDist = u;
        closestPoint = new Point(
          this.origin.x + this.direction.dx * u,
          this.origin.y + this.direction.dy * u
        );
        closestWall = wall;
      }
    }

    return [closestPoint, closestWall];
  }

}

// Material class with wavelength-dependent properties
class Material {
  constructor(refractiveIndexFunc, reflectivity = 1.0, absorption = 0.0, color = [0,0,255,1]) {
    // refractiveIndexFunc: function(wavelength) => index of refraction
    this.refractiveIndexFunc = refractiveIndexFunc;
    this.reflectivity = reflectivity;
    this.absorption = absorption;
    this.color = color
  }

  getRefractiveIndex(wavelength) {
    return this.refractiveIndexFunc(wavelength);
  }
}


function traceRays(initialRays, walls, maxBounces = 3) {
  let rays = [...initialRays];
  let segments = [];

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    let nextBounceRays = [];

    for (let ray of rays) {
      if (ray.bounceLevel !== bounce) continue;

      // Instead of drawing, store line segments
      const [hitPoint, wall] = ray.castAndDraw({ 
        beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, strokeStyle:'' 
      }, walls, 1000, ray.color);

      if (!hitPoint) continue;

      // Color inheritance
      const light = [
        (ray.color[0]) * (wall.material.color[0] / 255) * wall.material.absorption * 0.99,
        (ray.color[1]) * (wall.material.color[1] / 255) * wall.material.absorption * 0.99,
        (ray.color[2]) * (wall.material.color[2] / 255) * wall.material.absorption * 0.99,
        (ray.color[3]) * (wall.material.color[3]),
      ];

      // Store segment
      segments.push({
        start: { x: ray.origin.x, y: ray.origin.y },
        end:   { x: hitPoint.x, y: hitPoint.y },
        color: ray.color
      });

      // Reflect ray
      let normal = wall.normal;
      if (ray.direction.dot(normal) > 0) normal = normal.scale(-1);

      const offsetOrigin = new Point(
        hitPoint.x + normal.dx * 0.0001,
        hitPoint.y + normal.dy * 0.0001
      );
      let reflected = ray.direction.reflect(normal);

      // Add reflected ray
      nextBounceRays.push(new Ray(offsetOrigin, reflected, light, bounce + 1));

      for (let i = 0; i < 0; i++) {
        const randomOffset = Math.random() * Math.PI - Math.PI / 2;
        const dirAngle = Math.atan2(normal.dy, normal.dx) + randomOffset;
        const dirVec = new Vector(Math.cos(dirAngle), Math.sin(dirAngle));

        nextBounceRays.push(
          new Ray(offsetOrigin, dirVec, light, bounce + 1)
        );
      }
    }

    rays.push(...nextBounceRays);
  }

  return segments;
}

self.onmessage = function (e) {
  const { rays, walls, bounces } = e.data;

  // Rebuild classes
  const rebuiltRays = rays.map(r =>
    new Ray(
      new Point(r.origin.x, r.origin.y),
      new Vector(r.direction.dx, r.direction.dy),
      r.color,
      r.bounceLevel
    )
  );

  const rebuiltWalls = walls.map(w =>
    new LineSegment(
      new Point(w.p1.x, w.p1.y),
      new Point(w.p2.x, w.p2.y),
      w.material
    )
  );

  // Perform tracing and return array of segments
  const results = traceRays(rebuiltRays, rebuiltWalls, bounces);
  self.postMessage(results);
};
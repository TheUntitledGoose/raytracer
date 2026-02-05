// Point class
  class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
  
    // Helper to subtract points (vector)
    subtract(p) {
      return {
        dx : this.x - p.x,
        dy : this.y - p.y
      }
      // return new Vector(this.x - p.x, this.y - p.y);
    }

    static static_subtract(p1, p2) {
      return {
        dx : p1.x - p2.x,
        dy : p1.y - p2.y
      }
      // return new Vector(this.x - p.x, this.y - p.y);
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

    static static_dot(v1, v2) {
      return v1.dx * v2.dx + v1.dy * v2.dy;
    }
  
    cross(v) {
      return this.dx * v.dy - this.dy * v.dx;
    }

    static static_cross(v1,v2) {
      return v1.dx * v2.dy - v1.dy * v2.dx;
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
     
      // const v1 = p.subtract(p1);
      const v1 = Point.static_subtract(p, p1);
      // const v2 = p2.subtract(p1);
      const v2 = Point.static_subtract(p2, p1);
      const v3 = new Vector(-d.dy, d.dx);
  
      // const dot = v2.dot(v3);
      const dot = Vector.static_dot(v2, v3);
      if (Math.abs(dot) < 1e-8) {
        // Parallel, no intersection
        return null;
      }
  
      // const t1 = v2.cross(v1) / dot;
      const t1 = Vector.static_cross(v2, v1) / dot;
      // const t2 = v1.dot(v3) / dot;
      const t2 = Vector.static_dot(v1, v3) / dot;
  
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
  
    castAndDraw(targetCtx, objects, maxLength = 1000, color = [0,0,255,1]) {
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
            closestObj = hitPoint.obj ? hitPoint.obj : obj;
          }
        }
      }
  
      // Decide where to draw
      const drawLength = Math.min(closestDist, maxLength);
      targetCtx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`;
      targetCtx.lineWidth = 1;
      targetCtx.beginPath();
      targetCtx.moveTo(this.origin.x, this.origin.y);
      targetCtx.lineTo(
        this.origin.x + this.direction.dx * drawLength,
        this.origin.y + this.direction.dy * drawLength
      );
      targetCtx.stroke();
  
      // Return the intersection point for further reflection/refraction
      return [closestPoint, closestObj];
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

  class Circle {
    constructor(x, y, radius, startAngle, endAngle, segments, material=[255,255,255,1]) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.startAngle = startAngle;
      this.endAngle = endAngle;
      
      this.lines = new Array(segments);

      for (var i = 0; i < segments; i++) {
        this.lines[i] = new LineSegment(
          new Point(
            this.x+this.radius*Math.cos(this.startAngle+(this.endAngle/segments)*i), 
            this.y+this.radius*Math.sin(this.startAngle+(this.endAngle/segments)*i)
          ),
          new Point(
            this.x+this.radius*Math.cos(this.startAngle+(this.endAngle/segments)*(i+1)), 
            this.y+this.radius*Math.sin(this.startAngle+(this.endAngle/segments)*(i+1))
          ),
          material
        )

        this.lines[i].circle = {
          centerX: this.x,
          centerY: this.y
        }

      }
    }

    draw(ctx, lineWidth = 2) {
      for (const line of this.lines) {
        line.draw(ctx, 1)
      }
    }
  }
(() => {
  const c = document.getElementById("myCanvas");
  const ctx = c.getContext("2d");
  
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  
  c.height = windowHeight;
  c.width = windowWidth;
  
  const c2 = document.querySelector('#imguiCanvas')
  const ctx2 = c2.getContext('2d')
  
  let imgui = new window.ImGui(200, 250, 400, 100, c2);
  
  let reflect_checkbox = imgui.checkbox("Reflections", true);
  let specular_checkbox = imgui.checkbox("Specular reflections", false);
  let bounces_slider = imgui.slider(0, 20, undefined, 7, { text: "Bounces" });
  let samples_per_ray_slider = imgui.slider(0, 6, undefined, 1, { text: "Samples per ray" });
  let max_sample_slider = imgui.slider(0, 16384, undefined, 2048, { text: "Samples" });
  let progress = imgui.staticText(`Progress: 0/2048`, "white", true)
  let button = imgui.button("Render", true);
  button.onClick(() => {
    step = 0;

    rays = new Array(rays_amount);
    for (let i = 0; i < rays_amount; i++) {
    
      const angle = Math.random()*40+270
      const radians = -(angle*Math.PI/180);
    
      rays[i] = (new Ray(
        new Point(50+i, 50),
        new Vector(Math.cos(radians),Math.sin(radians)),
        [255,255,255, 0]
      ))  
    }

    ctx.clearRect(0,0,windowWidth,windowHeight);
  })
  
  // Initialize the UI. This sets the height of the UI to fit all elements.
  imgui.init();
  
  
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
  
  // let bounces = 7;
  // let samples_per_ray = 1;
  // let max_sample = 2048;
  let bounces = bounces_slider.state;
  let samples_per_ray = samples_per_ray_slider.state;
  let max_sample = max_sample_slider.state;
  
  
  // Create scene objects
  const floor = new LineSegment(new Point(100, 500), new Point(700, 500), [20,105,203,1]);
  const floor2 = new LineSegment(new Point(100, 480), new Point(300, 480), [255,255,255,1]);
  const wall = new LineSegment(new Point(300, 300), new Point(700, 300), [255,0,0,1]);
  const wall2 = new LineSegment(new Point(500, 400), new Point(700, 400), [255,255,0,1]);
  const wall3 = new LineSegment(new Point(200, 100), new Point(300, 70), [0,255,0,1]);
  
  const walls = [floor,floor2, wall, wall2, wall3];
  
  // Create rays
  const rays_amount = 50;
  let rays = new Array(rays_amount);
  for (let i = 0; i < rays_amount; i++) {
  
    const angle = Math.random()*40+270
    const radians = -(angle*Math.PI/180);
  
    rays[i] = (new Ray(
      new Point(50, 50),
      new Vector(Math.cos(radians),Math.sin(radians)),
      [255,255,255, 0]
    ))  
  }
  
  function traceRays(initialRays, walls, maxBounces = 3) {
    let rays = [...initialRays]; // copy of starting rays
  
    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      let nextBounceRays = [];
  
      for (let ray of rays) {
        // Process only rays at the current bounce level
        if (ray.bounceLevel !== bounce) continue;
  
        const [hitPoint, wall] = ray.castAndDraw(ctx, walls, 1000, ray.color);
        if (!hitPoint) continue;
  
        // Blend colors (inheritance)
        const light = [
          (ray.color[0]) * (wall.material.color[0]/255) * wall.material.absorption * 0.99,
          (ray.color[1]) * (wall.material.color[1]/255) * wall.material.absorption * 0.99,
          (ray.color[2]) * (wall.material.color[2]/255) * wall.material.absorption * 0.99,
          (ray.color[3]) * (wall.material.color[3]),
        ];
        
  
        // Calculate surface normal
        let normal = wall.normal;
        if (ray.direction.dot(normal) > 0) {
          normal = normal.scale(-1);
        }
  
        const offsetOrigin = new Point(
          hitPoint.x + normal.dx * 0.0001,
          hitPoint.y + normal.dy * 0.0001
        );
  
        // Reflect ray
        let reflected = ray.direction.reflect(normal);
  
        // Always add the reflected ray if specular bounce is desired
        if (reflect_checkbox.state) {
          nextBounceRays.push(
            new Ray(offsetOrigin, reflected, light, bounce + 1)
          );
        }
  
        // Then add diffuse scatter if desired
        if (specular_checkbox.state) {
          for (let i = 0; i < samples_per_ray; i++) {
            const range = Math.PI
            const randomOffset = Math.random() * range - range / 2;
            const dirAngle = Math.atan2(normal.dy, normal.dx) + randomOffset;
            const dirVec = new Vector(Math.cos(dirAngle), Math.sin(dirAngle));
    
            nextBounceRays.push(
              new Ray(offsetOrigin, dirVec, light, bounce + 1)
            );
          }
        }
      }
  
      // Merge new rays into the main list
      rays.push(...nextBounceRays);
    }
  
    return rays;
  }
  
  
  function imgui_animate() {
    ctx2.clearRect(0, 0, c2.width, c2.height);
    imgui.draw();
    window.requestAnimationFrame(imgui_animate)
  }
  window.requestAnimationFrame(imgui_animate)

  let step = 0;
  function animate() {

    bounces = parseInt(bounces_slider.state);
    samples_per_ray = parseInt(samples_per_ray_slider.state);
    max_sample = parseInt(max_sample_slider.state);

    if (step > max_sample) return window.requestAnimationFrame(animate)
    progress.text = `Progress: ${step}/${max_sample}`

    // Render
    ctx.globalCompositeOperation = "color-dodge";
    ctx.fillStyle = `rgba(0,0,0,.01)`
    ctx.fillRect(0,0, windowWidth, windowHeight)
    // ctx.globalCompositeOperation = "source-over";

    
    // Draw objects
    for (const wall of walls) {
      wall.draw(ctx)
    }
    // ctx.globalCompositeOperation = "saturation";
  
    // let rays = new Array(rays_amount);
    for (let i = 0; i < rays_amount; i++) {
      
      const angle = Math.random()*30+280
      const radians = -(angle*Math.PI/180);
  
      rays[i] = (new Ray(
        new Point(50, 50),
        new Vector(Math.cos(radians),Math.sin(radians)),
        [255,255,255, 0.01]
      ))
    }
    
    if (rays[0]) {

      traceRays(rays, walls, bounces)
      
      // traceRaysMultiThread(rays, walls, bounces, (results) => {
      //   // Draw results
      //   for (const result of results) {
      //     ctx.beginPath();
      //     ctx.moveTo(result.start.x, result.start.y);
      //     ctx.lineTo(result.end.x, result.end.y);
      //     ctx.strokeStyle = `rgba(${result.color[0]}, ${result.color[1]}, ${result.color[2]}, ${result.color[3]})`;
      //     ctx.stroke();
      //   }

      //   // step++;
      // });

      step++;
    }

  
    window.requestAnimationFrame(animate)
  }
  window.requestAnimationFrame(animate)

  // Create workers (adjust thread count as needed)
  const THREADS = navigator.hardwareConcurrency || 4;
  // const workers = Array.from({ length: THREADS }, () => new Worker('worker.js'));

  function traceRaysMultiThread(rays, walls, bounces, callback) {
    const chunkSize = Math.ceil(rays.length / THREADS);
    let completed = 0;
    const allResults = [];

    workers.forEach((worker, index) => {
      const chunk = rays.slice(index * chunkSize, (index + 1) * chunkSize);

      // Handle the response from each worker
      worker.onmessage = function (e) {
        const results = e.data; // Array of line segments { start, end, color }

        allResults.push(...results);
        completed++;

        // Once all threads are finished, draw and callback
        if (completed === THREADS) {
          // Draw all lines
          for (let line of allResults) {
            ctx.beginPath();
            ctx.moveTo(line.start.x, line.start.y);
            ctx.lineTo(line.end.x, line.end.y);
            ctx.strokeStyle = `rgba(${line.color[0]},${line.color[1]},${line.color[2]},${line.color[3]})`;
            ctx.stroke();
          }
          if (callback) callback(allResults);
        }
      };

      // Send only this chunk, not the full array
      worker.postMessage({
        rays: chunk.map(ray => ({
          origin: { x: ray.origin.x, y: ray.origin.y },
          direction: { dx: ray.direction.dx, dy: ray.direction.dy },
          color: ray.color,
          bounceLevel: ray.bounceLevel ?? 0
        })),
        walls: walls.map(w => ({
          p1: { x: w.start.x, y: w.start.y },
          p2: { x: w.end.x, y: w.end.y },
          material: w.material
        })),
        bounces
      });
    });
  }

  
  
  window.addEventListener('resize', () => {
      windowWidth = window.innerWidth;
      windowHeight = window.innerHeight;
  })
})()

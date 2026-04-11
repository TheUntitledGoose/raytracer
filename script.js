(() => {
  const c = document.getElementById("myCanvas");
  const ctx = c.getContext("2d");
  
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  
  c.height = windowHeight;
  c.width = windowWidth;

  let mx;
  let my;

  let light_obj = {
    x:50, 
    y:50, 
    material: [255,255,255,1]
  }
  
  const c2 = document.querySelector('#imguiCanvas')
  const ctx2 = c2.getContext('2d')
  
  let imgui = new window.ImGui(600, 50, 400, 100, c2);
  
  let reflect_checkbox = imgui.checkbox("Reflections", true);
  let specular_checkbox = imgui.checkbox("Specular reflections", true);
  let draw_walls_checkbox = imgui.checkbox("Draw walls (Reset Render)", false);
  let bounces_slider = imgui.slider(0, 20, undefined, 10, { text: "Bounces" });
  let samples_per_ray_slider = imgui.slider(0, 8, undefined, 2, { text: "Samples per ray", float: false });
  let max_sample_slider = imgui.slider(0, 16384, undefined, 2048, { text: "Samples" });
  let exposure = imgui.slider(0, 3, undefined, 1, { text: "Exposure", float: true });
  let progress = imgui.staticText(`Progress: 0/2048 \nFPS: 0`, "white", true)
  let button = imgui.button("Reset Render", true);
  button.onClick(() => {
    step = 0;
    rays = new Array(rays_amount);
    light()
    ctx.clearRect(0,0,windowWidth,windowHeight);
  })

  imgui.staticText("- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -", undefined, true)
  imgui.staticText("DIFFERENT ENVIRONMENTS:", undefined, true)

  let default_env_button = imgui.button("Default Environment", true);
  default_env_button.onClick(() => {
    step = 0;

    rays_amount = 50;
    rays = new Array(rays_amount)

    light_obj.angle = undefined;
    walls = default_env;
  })

  let mirror_button = imgui.button("Mirror Environment", true);
  mirror_button.onClick(() => {
    step = 0;

    rays_amount = 10;
    rays = new Array(rays_amount)

    const mirror = new Circle(500, 200, 100, -Math.PI * 1/3, Math.PI * 2/3, 50, [255,255,255,1])

    light_obj.x = 100;
    light_obj.y = 200;

    // no, i dont understand this either.
    light_obj.angle = `
    (
      (i/rays_amount) + (50 * step/max_sample/rays_amount) % (1/rays_amount)
    )
      *
    (Math.PI/6) - (Math.PI/12)`;

    walls = mirror.lines;
  })
  
  // Initialize the UI. This sets the height of the UI to fit all elements.
  imgui.init();
  
  let bounces = bounces_slider.state;
  let samples_per_ray = parseInt(samples_per_ray_slider.state);
  let max_sample = max_sample_slider.state;
  
  
  // Create scene objects
  const default_env = [
    new LineSegment(new Point(100, 500), new Point(700, 500), [0,105,203,1]),
    new LineSegment(new Point(100, 480), new Point(300, 480), [255,255,255,1]),
    new LineSegment(new Point(300, 300), new Point(700, 300), [255,0,0,1]),
    new LineSegment(new Point(500, 400), new Point(700, 400), [255,255,0,1]),
    new LineSegment(new Point(200, 100), new Point(300, 70), [0,255,0,1]),
  ]

  const circle = new Circle(275,380,50, -Math.PI * 1/4, Math.PI*3.5/2, 50, [255,255,255,1]);
  
  let walls = [...default_env, ...circle.lines];

  // const dpr = window.devicePixelRatio || 1;

  // // Set internal resolution
  // c.width = windowWidth * dpr;
  // c.height = windowHeight * dpr;
  // c2.width = windowWidth * dpr;
  // c2.height = windowHeight * dpr;

  // // Normalize drawing coordinates
  // ctx.imageSmoothingEnabled = true;
  // ctx.imageSmoothingQuality = "high";
  // ctx.scale(dpr, dpr);

  // Create rays
  let rays_amount = 50;
  let rays = new Array(rays_amount);

  function light() {
    for (let i = 0; i < rays_amount; i++) {
      
      // eval unsafe? more like suck my dick

      const angle = light_obj.angle !== undefined ? eval(light_obj.angle) : -((Math.random()*30+280)*Math.PI/180);
  
      rays[i] = (new Ray(
        new Point(eval(light_obj.x), eval(light_obj.y)),
        new Vector(Math.cos(angle),Math.sin(angle)),
        light_obj.material
      ))
    }
  }

  light()
  
  function traceRays(initialRays, walls, maxBounces = 3, currentCtx) {
    let rays = [...initialRays]; // copy of starting rays
  
    for (let bounce = 0; bounce <= maxBounces; bounce++) {
      let nextBounceRays = [];
  
      for (let ray of rays) {
        // Process only rays at the current bounce level
        if (ray.bounceLevel !== bounce) continue;
  
        const [hitPoint, wall] = ray.castAndDraw(currentCtx, walls, 1000, ray.color);
        if (!hitPoint) continue;

        // ----- 1. Apply wall albedo / energy loss -----
        const albedo = [
          wall.material.color[0] / 255,
          wall.material.color[1] / 255,
          wall.material.color[2] / 255,
          wall.material.color[3] * 0.5 // alpha
        ];

        const light = [
          ray.color[0] * albedo[0] * 0.85,
          ray.color[1] * albedo[1] * 0.85,
          ray.color[2] * albedo[2] * 0.85,
          ray.color[3] * albedo[3] * 0.5
        ];

        // Early skip if energy too low
        const maxEnergy = Math.max(light[0], light[1], light[2]);
        if (maxEnergy < 0.005) continue;
  
        // Blend colors (inheritance)
        // const light = [
        //   (ray.color[0]) * (wall.material.color[0]/255) * 0.85,
        //   (ray.color[1]) * (wall.material.color[1]/255) * 0.85,
        //   (ray.color[2]) * (wall.material.color[2]/255) * 0.85,
        //   (ray.color[3]) * (wall.material.color[3]) * 0.5,
        // ];
        
  
        // Calculate surface normal
        let normal = wall.normal;
        
        // If circle, calculate ideal angle of reflection
        const circle = wall.circle;
        if (circle) {
          // Center - hit point
          const dx = circle.centerX - hitPoint.x;
          const dy = circle.centerY - hitPoint.y;
          const circle_normal = new Vector(dx, dy).normalize();

          normal = circle_normal;
        }
        
        if (ray.direction.dot(normal) > 0) {
          normal = normal.scale(-1);
        }
  
        const offsetOrigin = new Point(
          hitPoint.x + normal.dx * 0.0001,
          hitPoint.y + normal.dy * 0.0001
        );
  
        const reflectChance = reflect_checkbox.state ? 0.5 : 0.0;
        const diffuseChance = specular_checkbox.state ? 0.5 : 0.0;
        const total = reflectChance + diffuseChance;

        const r = Math.random() * total;

        // Always add the reflected ray if specular bounce is desired
        if (reflect_checkbox.state && r < reflectChance) {
          
          const reflected = ray.direction.reflect(normal);

          // Reduce energy slightly on each bounce
          // const reflectedLight = light.map(c => c * 0.85);

          nextBounceRays.push(
            new Ray(offsetOrigin, reflected, light, bounce + 1)
          );
        }
        // Then add diffuse scatter if desired
        else if (specular_checkbox.state) {
          const nx = normal.dx;
          const ny = normal.dy;

          for (let i = 0; i < samples_per_ray; i++) {
            const offset = (Math.random() - 0.5) * Math.PI;
            const cosOff = Math.cos(offset);
            const sinOff = Math.sin(offset);

            // Rotate normal directly
            const dx = nx * cosOff - ny * sinOff;
            const dy = ny * cosOff + nx * sinOff;

            // const range = Math.PI;
            // const randomOffset = Math.random() * range - range / 2;
            // const dirAngle = Math.atan2(normal.dy, normal.dx) + randomOffset;
            // const dirVec = new Vector(Math.cos(dirAngle), Math.sin(dirAngle));

            // Cosine weighting + energy scaling
    
            if (nextBounceRays.length < 3000) {
              nextBounceRays.push(
                new Ray(offsetOrigin, new Vector(dx, dy), light, bounce + 1)
              );
            }
          }
        }
      }
  
      // Merge new rays into the main list
      // rays.push(...nextBounceRays);
      rays = nextBounceRays;
    }
  
    return rays;
  }
  
  
  function imgui_animate() {
    ctx2.clearRect(0, 0, c2.width, c2.height);
    imgui.draw();
    window.requestAnimationFrame(imgui_animate)
  }

  window.requestAnimationFrame(imgui_animate)

  // Accumulation buffer (stores floats between 0–1)
  let accumulationBuffer = new Float32Array(windowWidth * windowHeight * 4);

  // Create a single reusable offscreen render target
  let currentFrame = document.createElement("canvas");
  currentFrame.width = windowWidth;
  currentFrame.height = windowHeight;
  let currentCtx = currentFrame.getContext("2d", { willReadFrequently: true });

  let step = 0;

  currentCtx.scale(2,2)

  function animate() {
    bounces = Math.round(bounces_slider.state);
    samples_per_ray = Math.round(samples_per_ray_slider.state);
    max_sample = Math.round(max_sample_slider.state);
    
    let startTime = performance.now()

    if (step > max_sample) return window.requestAnimationFrame(animate)
    // progress.text = `Progress: ${step}/${max_sample}\nFPS: ${1000/}`

    // Render

    // ----- 1. Clear offscreen canvas and draw single noisy sample -----
    currentCtx.clearRect(0, 0, windowWidth, windowHeight);

    
    // Draw objects
    if (draw_walls_checkbox.state) {
      for (const wall of walls) {
        wall.draw(currentCtx, 0.5)
      }
    }
  
    light()
    
    if (rays[0]) {

      traceRays(rays, walls, bounces, currentCtx)
      
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

    // ----- 2. Grab pixels once -----
    let frameImage = currentCtx.getImageData(0, 0, windowWidth, windowHeight);
    let cdata = frameImage.data;

    // ----- 3. Update accumulation buffer -----
    for (let i = 0; i < cdata.length; i++) {
      // let sample = (cdata[i] / 255.0);
      const sample = Math.min(1.0, cdata[i] / 255); // clamp to prevent wash-out
      accumulationBuffer[i] = ((accumulationBuffer[i]) * (step-1) + (sample)) / (step);
    }

    // ----- 4. Present averaged result -----
    let output = ctx.createImageData(windowWidth, windowHeight);
    let odata = output.data;
    // for (let i = 0; i < odata.length; i++) {
    //   odata[i] = Math.min(255, (accumulationBuffer[i]) * 255 * exposure.state);
    // }
    for (let i = 0; i < odata.length; i += 4) {
      odata[i + 0] = Math.min(255, accumulationBuffer[i + 0] * 255 * exposure.state);
      odata[i + 1] = Math.min(255, accumulationBuffer[i + 1] * 255 * exposure.state);
      odata[i + 2] = Math.min(255, accumulationBuffer[i + 2] * 255 * exposure.state);
      odata[i + 3] = 255; // keep alpha fully opaque
    }
    ctx.putImageData(output, 0, 0);


    let endTime = performance.now()

    progress.text = `Progress: ${step}/${max_sample}\nms: ${endTime - startTime}`
  
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
      
      c.width = windowWidth;
      c.height = windowHeight;
      
      currentFrame.width = windowWidth;
      currentFrame.height = windowHeight;
      
      accumulationBuffer = new Float32Array(windowWidth * windowHeight * 4);

      step = 0;
  })

  document.addEventListener('mousemove', (e) => {
    if (e.buttons != 1) return
    if (imgui.checkHover(e.clientX, e.clientY)) return
    for (const line of circle.lines) {
      line.start.x += e.movementX;
      line.start.y += e.movementY;
      line.end.x += e.movementX;
      line.end.y += e.movementY;

      line.circle.centerX += e.movementX;
      line.circle.centerY += e.movementY;

      step = 0;
    }
  })

  document.addEventListener('wheel', (e) => {
    e.preventDefault();

    step = 0;

    const rect = c.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Get world point under mouse before zoom
    // const before = screenToWorld(mouseX, mouseY);

    // Exponential zoom for smoothness
    const ZOOM_BASE = 1.1;
    const zoomFactor = e.deltaY > 0 ? 1 / ZOOM_BASE : ZOOM_BASE;
    // let newScale = finalScale * zoomFactor;

    // finalScale = newScale;

    // World point under mouse after zoom
    // const after = screenToWorld(mouseX, mouseY);

    // Shift camera so mouse points to same world coordinate
    // originX += before.x - after.x;
    // originY += before.y - after.y;
    
    currentCtx.scale(zoomFactor, zoomFactor)
  }, { passive: false });
  
})()

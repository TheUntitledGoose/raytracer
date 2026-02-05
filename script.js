(() => {
  const c = document.getElementById("myCanvas");
  const ctx = c.getContext("2d");
  
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  
  c.height = windowHeight;
  c.width = windowWidth;
  
  const c2 = document.querySelector('#imguiCanvas')
  const ctx2 = c2.getContext('2d')
  
  let imgui = new window.ImGui(600, 50, 400, 100, c2);
  
  let reflect_checkbox = imgui.checkbox("Reflections", true);
  let specular_checkbox = imgui.checkbox("Specular reflections", true);
  let bounces_slider = imgui.slider(0, 10, undefined, 5, { text: "Bounces" });
  let samples_per_ray_slider = imgui.slider(0, 8, undefined, 2, { text: "Samples per ray" });
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
  
  // let render = imgui.button("Render", true);
  
  // Initialize the UI. This sets the height of the UI to fit all elements.
  imgui.init();
  
  // let bounces = 7;
  // let samples_per_ray = 1;
  // let max_sample = 2048;
  let bounces = bounces_slider.state;
  let samples_per_ray = samples_per_ray_slider.state;
  let max_sample = max_sample_slider.state;
  
  
  // Create scene objects
  const floor = new LineSegment(new Point(100, 500), new Point(700, 500), [0,105,203,1]);
  const floor2 = new LineSegment(new Point(100, 480), new Point(300, 480), [255,255,255,1]);
  const wall = new LineSegment(new Point(300, 300), new Point(700, 300), [255,0,0,1]);
  const wall2 = new LineSegment(new Point(500, 400), new Point(700, 400), [255,255,0,1]);
  const wall3 = new LineSegment(new Point(200, 100), new Point(300, 70), [0,255,0,1]);

  const circle = new Circle(275,380,50, -Math.PI * 1/4, Math.PI*3.5/2, 50, [255,255,255,1]);
  
  const walls = [floor,floor2, wall, wall2, wall3, ...circle.lines];

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
  const rays_amount = 25;
  let rays = new Array(rays_amount);

  function light() {
    for (let i = 0; i < rays_amount; i++) {
      
      const angle = Math.random()*30+280
      const radians = -(angle*Math.PI/180);
  
      rays[i] = (new Ray(
        new Point(50, 50),
        new Vector(Math.cos(radians),Math.sin(radians)),
        [255,255,255, 1]
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
  
        // Always add the reflected ray if specular bounce is desired
        if (reflect_checkbox.state) {
          
          const reflected = ray.direction.reflect(normal);

          // Reduce energy slightly on each bounce
          const reflectedLight = light.map(c => c * 0.85);

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

            // Cosine weighting + energy scaling
    
            nextBounceRays.push(
              new Ray(offsetOrigin, dirVec, light, bounce + 1)
            );
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

  function animate() {
    bounces = parseInt(bounces_slider.state);
    samples_per_ray = parseInt(samples_per_ray_slider.state);
    max_sample = parseInt(max_sample_slider.state);
    
    let startTime = performance.now()
    
    if (step > max_sample) return window.requestAnimationFrame(animate)
    // progress.text = `Progress: ${step}/${max_sample}\nFPS: ${1000/}`

    // Render

    // ----- 1. Clear offscreen canvas and draw single noisy sample -----
    currentCtx.clearRect(0, 0, windowWidth, windowHeight);

    
    // Draw objects
    // for (const wall of walls) {
    //   wall.draw(currentCtx, 0.5)
    // }
    // ctx.globalCompositeOperation = "saturation";
  
    // let rays = new Array(rays_amount);
    // for (let i = 0; i < rays_amount; i++) {
      
    //   const angle = Math.random()*30+280
    //   const radians = -(angle*Math.PI/180);
  
    //   rays[i] = (new Ray(
    //     new Point(50, 50),
    //     new Vector(Math.cos(radians),Math.sin(radians)),
    //     [255,255,255, 1]
    //   ))
    // }
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
  
})()

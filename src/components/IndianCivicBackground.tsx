import { useEffect, useRef } from "react";

const IndianCivicBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const colors = {
    saffron: "#FF9933",
    white: "#FFFFFF",
    deepBlue: "#004687",
    green: "#046A38",
    gold: "#D4AF37",
  };

  const cities = [
    { name: "Delhi", x: 0.48, y: 0.28 },
    { name: "Mumbai", x: 0.35, y: 0.52 },
    { name: "Kolkata", x: 0.68, y: 0.42 },
    { name: "Chennai", x: 0.52, y: 0.72 },
    { name: "Bangalore", x: 0.45, y: 0.68 },
    { name: "Hyderabad", x: 0.48, y: 0.58 },
    { name: "Ahmedabad", x: 0.32, y: 0.42 },
    { name: "Jaipur", x: 0.40, y: 0.35 },
    { name: "Lucknow", x: 0.55, y: 0.32 },
    { name: "Bhopal", x: 0.45, y: 0.45 },
  ];

  const parliament = { x: 0.48, y: 0.28 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Array<{
      x: number;
      y: number;
      speed: number;
      opacity: number;
      size: number;
      color: string;
    }> = [];
    
    let waves: Array<{
      radius: number;
      opacity: number;
      speed: number;
      x: number;
      y: number;
    }> = [];

    let floatingShapes: Array<{
      x: number;
      y: number;
      size: number;
      rotation: number;
      rotationSpeed: number;
      type: "hexagon" | "diamond" | "circle";
      opacity: number;
      floatOffset: number;
    }> = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      initWaves();
      initFloatingShapes();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 8000);
      const particleColors = [colors.saffron, colors.deepBlue, colors.green, colors.gold];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speed: 0.2 + Math.random() * 0.8,
          opacity: 0.1 + Math.random() * 0.4,
          size: 1 + Math.random() * 3,
          color: particleColors[Math.floor(Math.random() * particleColors.length)],
        });
      }
    };

    const initWaves = () => {
      waves = [];
      for (let i = 0; i < 3; i++) {
        waves.push({
          radius: 50 + i * 100,
          opacity: 0.1,
          speed: 0.5 + Math.random() * 0.5,
          x: canvas.width * 0.5,
          y: canvas.height * 0.5,
        });
      }
    };

    const initFloatingShapes = () => {
      floatingShapes = [];
      const types: Array<"hexagon" | "diamond" | "circle"> = ["hexagon", "diamond", "circle"];
      for (let i = 0; i < 8; i++) {
        floatingShapes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: 20 + Math.random() * 40,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.02,
          type: types[Math.floor(Math.random() * types.length)],
          opacity: 0.03 + Math.random() * 0.05,
          floatOffset: Math.random() * Math.PI * 2,
        });
      }
    };

    let chakraRotation = 0;
    let lineProgress = 0;
    let time = 0;
    let pulsePhase = 0;

    const drawIndiaMapOutline = () => {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = colors.deepBlue;
      ctx.lineWidth = 2;
      
      const w = canvas.width;
      const h = canvas.height;
      
      ctx.beginPath();
      ctx.moveTo(w * 0.35, h * 0.15);
      ctx.lineTo(w * 0.42, h * 0.12);
      ctx.lineTo(w * 0.50, h * 0.14);
      ctx.lineTo(w * 0.55, h * 0.18);
      ctx.lineTo(w * 0.60, h * 0.22);
      ctx.lineTo(w * 0.72, h * 0.28);
      ctx.lineTo(w * 0.75, h * 0.35);
      ctx.lineTo(w * 0.70, h * 0.42);
      ctx.lineTo(w * 0.65, h * 0.50);
      ctx.lineTo(w * 0.58, h * 0.62);
      ctx.lineTo(w * 0.52, h * 0.72);
      ctx.lineTo(w * 0.48, h * 0.82);
      ctx.lineTo(w * 0.45, h * 0.78);
      ctx.lineTo(w * 0.38, h * 0.68);
      ctx.lineTo(w * 0.32, h * 0.55);
      ctx.lineTo(w * 0.28, h * 0.45);
      ctx.lineTo(w * 0.30, h * 0.35);
      ctx.lineTo(w * 0.35, h * 0.25);
      ctx.closePath();
      ctx.stroke();
      
      // Animated glow effect on map
      ctx.globalAlpha = 0.03 + Math.sin(time * 0.5) * 0.02;
      ctx.fillStyle = colors.saffron;
      ctx.fill();
      
      ctx.restore();
    };

    const drawAshokaChakra = (cx: number, cy: number, radius: number, rotation: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      
      // Pulsing glow effect
      const glowIntensity = 0.15 + Math.sin(pulsePhase) * 0.05;
      ctx.globalAlpha = glowIntensity;
      
      // Outer glow
      const gradient = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 1.2);
      gradient.addColorStop(0, colors.deepBlue);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = colors.deepBlue;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      
      // 24 spokes with gradient
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI * 2) / 24;
        const spokeGradient = ctx.createLinearGradient(
          Math.cos(angle) * radius * 0.15,
          Math.sin(angle) * radius * 0.15,
          Math.cos(angle) * radius * 0.95,
          Math.sin(angle) * radius * 0.95
        );
        spokeGradient.addColorStop(0, colors.deepBlue);
        spokeGradient.addColorStop(1, colors.saffron);
        ctx.strokeStyle = spokeGradient;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radius * 0.15, Math.sin(angle) * radius * 0.15);
        ctx.lineTo(Math.cos(angle) * radius * 0.95, Math.sin(angle) * radius * 0.95);
        ctx.stroke();
      }
      
      ctx.restore();
    };

    const drawParliamentSilhouette = (x: number, y: number, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = colors.deepBlue;
      
      ctx.beginPath();
      ctx.moveTo(-50, 25);
      ctx.lineTo(-50, 5);
      ctx.lineTo(-45, 5);
      ctx.lineTo(-45, -5);
      ctx.lineTo(-38, -5);
      ctx.lineTo(-38, -20);
      ctx.lineTo(-32, -20);
      ctx.lineTo(-32, -5);
      ctx.lineTo(-22, -5);
      ctx.lineTo(-22, -20);
      ctx.lineTo(-16, -20);
      ctx.lineTo(-16, -5);
      ctx.lineTo(-10, -5);
      ctx.quadraticCurveTo(0, -45, 10, -5);
      ctx.lineTo(16, -5);
      ctx.lineTo(16, -20);
      ctx.lineTo(22, -20);
      ctx.lineTo(22, -5);
      ctx.lineTo(32, -5);
      ctx.lineTo(32, -20);
      ctx.lineTo(38, -20);
      ctx.lineTo(38, -5);
      ctx.lineTo(45, -5);
      ctx.lineTo(45, 5);
      ctx.lineTo(50, 5);
      ctx.lineTo(50, 25);
      ctx.closePath();
      ctx.fill();
      
      // Add subtle light on dome
      ctx.globalAlpha = 0.1 + Math.sin(time * 2) * 0.05;
      ctx.fillStyle = colors.gold;
      ctx.beginPath();
      ctx.arc(0, -25, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    };

    const drawFlowingLines = (progress: number) => {
      ctx.save();
      
      const parliamentX = canvas.width * parliament.x;
      const parliamentY = canvas.height * parliament.y;
      
      cities.forEach((city, index) => {
        const cityX = canvas.width * city.x;
        const cityY = canvas.height * city.y;
        
        const lineStart = (index / cities.length);
        const currentProgress = ((progress + lineStart) % 1);
        
        // Draw curved connection lines
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = colors.saffron;
        ctx.lineWidth = 1.5;
        
        const midX = (parliamentX + cityX) / 2 + (Math.random() - 0.5) * 50;
        const midY = (parliamentY + cityY) / 2 - 30;
        
        ctx.beginPath();
        ctx.moveTo(parliamentX, parliamentY);
        ctx.quadraticCurveTo(midX, midY, cityX, cityY);
        ctx.stroke();
        
        // Animated dot traveling along the line
        const dotProgress = currentProgress;
        const dotT = dotProgress;
        const dotX = (1 - dotT) * (1 - dotT) * parliamentX + 2 * (1 - dotT) * dotT * midX + dotT * dotT * cityX;
        const dotY = (1 - dotT) * (1 - dotT) * parliamentY + 2 * (1 - dotT) * dotT * midY + dotT * dotT * cityY;
        
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = colors.gold;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // City pulsing dot
        const pulseSize = 4 + Math.sin(time * 3 + index) * 2;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = colors.saffron;
        ctx.beginPath();
        ctx.arc(cityX, cityY, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      });
      
      ctx.restore();
    };

    const drawParticles = () => {
      particles.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        
        // Star shape for some particles
        if (Math.random() > 0.7) {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const outerX = particle.x + Math.cos(angle) * particle.size;
            const outerY = particle.y + Math.sin(angle) * particle.size;
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            const innerAngle = angle + Math.PI / 5;
            const innerX = particle.x + Math.cos(innerAngle) * particle.size * 0.4;
            const innerY = particle.y + Math.sin(innerAngle) * particle.size * 0.4;
            ctx.lineTo(innerX, innerY);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
        
        particle.y -= particle.speed;
        particle.x += Math.sin(time + particle.y * 0.01) * 0.3;
        
        if (particle.y < -10) {
          particle.y = canvas.height + 10;
          particle.x = Math.random() * canvas.width;
        }
      });
    };

    const drawWaves = () => {
      waves.forEach((wave, index) => {
        ctx.save();
        ctx.globalAlpha = wave.opacity * (1 - wave.radius / (canvas.width * 0.4));
        ctx.strokeStyle = index % 2 === 0 ? colors.saffron : colors.deepBlue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        wave.radius += wave.speed;
        if (wave.radius > canvas.width * 0.4) {
          wave.radius = 50;
          wave.opacity = 0.1;
        }
      });
    };

    const drawFloatingShapes = () => {
      floatingShapes.forEach((shape) => {
        ctx.save();
        const floatY = shape.y + Math.sin(time + shape.floatOffset) * 20;
        ctx.translate(shape.x, floatY);
        ctx.rotate(shape.rotation);
        ctx.globalAlpha = shape.opacity;
        ctx.strokeStyle = colors.deepBlue;
        ctx.lineWidth = 1;
        
        if (shape.type === "hexagon") {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const x = Math.cos(angle) * shape.size;
            const y = Math.sin(angle) * shape.size;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        } else if (shape.type === "diamond") {
          ctx.beginPath();
          ctx.moveTo(0, -shape.size);
          ctx.lineTo(shape.size * 0.6, 0);
          ctx.lineTo(0, shape.size);
          ctx.lineTo(-shape.size * 0.6, 0);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, shape.size, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.restore();
        
        shape.rotation += shape.rotationSpeed;
        shape.x += Math.sin(time * 0.5 + shape.floatOffset) * 0.2;
        
        if (shape.x < -50) shape.x = canvas.width + 50;
        if (shape.x > canvas.width + 50) shape.x = -50;
      });
    };

    const drawTricolorGradient = () => {
      ctx.save();
      
      // Animated tricolor bands
      const bandOffset = Math.sin(time * 0.3) * 20;
      
      ctx.globalAlpha = 0.08;
      const saffronGradient = ctx.createLinearGradient(0, bandOffset, 0, canvas.height * 0.35 + bandOffset);
      saffronGradient.addColorStop(0, colors.saffron);
      saffronGradient.addColorStop(1, "transparent");
      ctx.fillStyle = saffronGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.4);
      
      const greenGradient = ctx.createLinearGradient(0, canvas.height * 0.65 - bandOffset, 0, canvas.height);
      greenGradient.addColorStop(0, "transparent");
      greenGradient.addColorStop(1, colors.green);
      ctx.fillStyle = greenGradient;
      ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
      
      ctx.restore();
    };

    const drawGridPattern = () => {
      ctx.save();
      ctx.globalAlpha = 0.02;
      ctx.strokeStyle = colors.deepBlue;
      ctx.lineWidth = 1;
      
      const gridSize = 80;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      time += 0.016;
      pulsePhase += 0.03;
      
      drawGridPattern();
      drawTricolorGradient();
      drawIndiaMapOutline();
      drawWaves();
      drawFloatingShapes();
      
      const chakraRadius = Math.min(canvas.width, canvas.height) * 0.18;
      drawAshokaChakra(canvas.width * 0.5, canvas.height * 0.5, chakraRadius, chakraRotation);
      chakraRotation += 0.003;
      
      drawParliamentSilhouette(
        canvas.width * parliament.x,
        canvas.height * parliament.y - 40,
        2
      );
      
      drawFlowingLines(lineProgress);
      lineProgress += 0.004;
      if (lineProgress > 1) lineProgress = 0;
      
      drawParticles();
      
      animationId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.35 }}
    />
  );
};

export default IndianCivicBackground;

import React, { useEffect, useRef } from 'react';

export default function LiveTelemetryBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Create network telemetry nodes
    const nodeCount = Math.min(Math.floor((width * height) / 25000), 35);
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1.5,
      pulse: Math.random() * Math.PI * 2,
    }));

    // Data packet animations along connections
    const packets = Array.from({ length: 12 }, () => ({
      from: Math.floor(Math.random() * nodeCount),
      to: Math.floor(Math.random() * nodeCount),
      progress: Math.random(),
      speed: 0.003 + Math.random() * 0.005,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains('dark');
      const nodeColor = isDark ? 'rgba(56, 189, 248, ' : 'rgba(99, 102, 241, ';
      const lineBaseColor = isDark ? '56, 189, 248' : '99, 102, 241';

      // Update & render nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.03;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        const pulseSize = node.radius + Math.sin(node.pulse) * 0.8;

        // Draw node center
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(0.5, pulseSize), 0, Math.PI * 2);
        ctx.fillStyle = nodeColor + (0.35 + Math.sin(node.pulse) * 0.15) + ')';
        ctx.fill();

        // Draw node outer halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor + '0.04)';
        ctx.fill();
      }

      // Draw node connection links
      const maxDistance = 140;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * (isDark ? 0.18 : 0.12);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${lineBaseColor}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Render data packets traveling between nodes
      for (let p = 0; p < packets.length; p++) {
        const packet = packets[p];
        packet.progress += packet.speed;

        if (packet.progress >= 1) {
          packet.from = Math.floor(Math.random() * nodeCount);
          packet.to = Math.floor(Math.random() * nodeCount);
          packet.progress = 0;
        }

        const n1 = nodes[packet.from];
        const n2 = nodes[packet.to];
        if (!n1 || !n2) continue;

        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < maxDistance * 1.2) {
          const px = n1.x + (n2.x - n1.x) * packet.progress;
          const py = n1.y + (n2.y - n1.y) * packet.progress;

          ctx.beginPath();
          ctx.arc(px, py, isDark ? 2.5 : 2, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? '#38bdf8' : '#6366f1';
          ctx.shadowBlur = isDark ? 8 : 4;
          ctx.shadowColor = isDark ? '#38bdf8' : '#6366f1';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-70 transition-opacity duration-500"
    />
  );
}

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Server3DCube({ status = 'HEALTHY', healthScore = 98 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 260;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 5.5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Color based on status
    let glowColorHex = 0x10b981; // emerald
    if (status === 'WARNING') glowColorHex = 0xf59e0b; // amber
    if (status === 'CRITICAL') glowColorHex = 0xef4444; // red

    // Server Chassis (outer metallic cube frame)
    const geometry = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: glowColorHex, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    scene.add(wireframe);

    // Inner Glowing Core Cube
    const coreGeom = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const coreMat = new THREE.MeshPhongMaterial({
      color: glowColorHex,
      emissive: glowColorHex,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.8,
      shininess: 100,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    scene.add(coreMesh);

    // Status LED Lights around the core
    const ledGroup = new THREE.Group();
    const ledCount = 8;
    for (let i = 0; i < ledCount; i++) {
      const ledGeom = new THREE.SphereGeometry(0.12, 16, 16);
      const ledMat = new THREE.MeshBasicMaterial({ color: glowColorHex });
      const led = new THREE.Mesh(ledGeom, ledMat);
      const angle = (i / ledCount) * Math.PI * 2;
      led.position.x = Math.cos(angle) * 1.4;
      led.position.y = Math.sin(angle) * 1.4;
      led.position.z = 0;
      ledGroup.add(led);
    }
    scene.add(ledGroup);

    // Ambient & Point Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(glowColorHex, 2, 10);
    pointLight.position.set(2, 3, 4);
    scene.add(pointLight);

    // Cursor tracking
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRotationY = x * 1.2;
      targetRotationX = y * 1.2;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth rotation
      wireframe.rotation.y += 0.008;
      wireframe.rotation.x += 0.004;

      coreMesh.rotation.y -= 0.012;
      coreMesh.rotation.x -= 0.006;

      ledGroup.rotation.z += 0.015;

      // Pulse core opacity
      coreMat.opacity = 0.6 + Math.sin(elapsedTime * 3) * 0.2;

      // Mouse interactive tilt dampening
      wireframe.rotation.y += (targetRotationY - wireframe.rotation.y) * 0.05;
      wireframe.rotation.x += (targetRotationX - wireframe.rotation.x) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, [status, healthScore]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-64">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-lg text-xs font-mono">
        <span
          className={`h-2.5 w-2.5 rounded-full animate-ping ${
            status === 'CRITICAL' ? 'bg-red-500' : status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
        />
        <span className="text-slate-200">3D CYBER CORE: {status}</span>
      </div>
    </div>
  );
}

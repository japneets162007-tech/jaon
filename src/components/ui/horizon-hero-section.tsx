'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
// three's package "exports" map requires the explicit .js extension for addons
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

gsap.registerPlugin(ScrollTrigger);

type Vec3 = { x: number; y: number; z: number };
type StarField = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
type Nebula = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
type Mountain = THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;

interface ThreeRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  composer: EffectComposer | null;
  stars: StarField[];
  nebula: Nebula | null;
  mountains: Mountain[];
  locations: number[];
  targetCamera: Vec3 | null;
  animationId: number | null;
}

// Sections below the hero. They exist to give the page scroll distance.
const SECTIONS = [
  {
    title: 'COSMOS',
    line1: 'Beyond the boundaries of imagination,',
    line2: 'lies the universe of possibilities',
  },
  {
    title: 'INFINITY',
    line1: 'In the space between thought and creation,',
    line2: 'we find the essence of true innovation',
  },
];

const TOTAL_SECTIONS = SECTIONS.length;

// Camera stops for each section: HORIZON -> COSMOS -> INFINITY
const CAMERA_POSITIONS: [Vec3, Vec3, Vec3] = [
  { x: 0, y: 30, z: 300 },
  { x: 0, y: 40, z: -50 },
  { x: 0, y: 50, z: -700 },
];

const splitTitle = (text: string) =>
  text.split('').map((char, i) => (
    <span key={i} className="title-char" aria-hidden="true">
      {char}
    </span>
  ));

export const Component = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Eased camera position: the animate loop chases the scroll-driven target
  const smoothCameraPos = useRef<Vec3>({ x: 0, y: 30, z: 100 });

  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const threeRefs = useRef<ThreeRefs>({
    scene: null,
    camera: null,
    renderer: null,
    composer: null,
    stars: [],
    nebula: null,
    mountains: [],
    locations: [],
    targetCamera: null,
    animationId: null,
  });

  // Initialize Three.js
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const refs = threeRefs.current;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00025);
    refs.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 100;
    camera.position.y = 20;
    refs.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.5;
    refs.renderer = renderer;

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8,
        0.4,
        0.85
      )
    );
    refs.composer = composer;

    const createStarField = () => {
      const starCount = 5000;

      for (let i = 0; i < 3; i++) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let j = 0; j < starCount; j++) {
          const radius = 200 + Math.random() * 800;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(Math.random() * 2 - 1);

          positions[j * 3] = radius * Math.sin(phi) * Math.cos(theta);
          positions[j * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
          positions[j * 3 + 2] = radius * Math.cos(phi);

          // Color variation
          const color = new THREE.Color();
          const colorChoice = Math.random();
          if (colorChoice < 0.7) {
            color.setHSL(0, 0, 0.8 + Math.random() * 0.2);
          } else if (colorChoice < 0.9) {
            color.setHSL(0.08, 0.5, 0.8);
          } else {
            color.setHSL(0.6, 0.5, 0.8);
          }

          colors[j * 3] = color.r;
          colors[j * 3 + 1] = color.g;
          colors[j * 3 + 2] = color.b;

          sizes[j] = Math.random() * 2 + 0.5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            depth: { value: i },
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            uniform float depth;

            void main() {
              vColor = color;
              vec3 pos = position;

              // Slow rotation based on depth
              float angle = time * 0.05 * (1.0 - depth * 0.3);
              mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
              pos.xy = rot * pos.xy;

              vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
              gl_PointSize = size * (300.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;

            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              float opacity = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, opacity);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
        refs.stars.push(stars);
      }
    };

    const createNebula = () => {
      const geometry = new THREE.PlaneGeometry(8000, 4000, 100, 100);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x0033ff) },
          color2: { value: new THREE.Color(0xff0066) },
          opacity: { value: 0.3 },
        },
        vertexShader: `
          varying vec2 vUv;
          varying float vElevation;
          uniform float time;

          void main() {
            vUv = uv;
            vec3 pos = position;

            float elevation = sin(pos.x * 0.01 + time) * cos(pos.y * 0.01 + time) * 20.0;
            pos.z += elevation;
            vElevation = elevation;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color1;
          uniform vec3 color2;
          uniform float opacity;
          uniform float time;
          varying vec2 vUv;
          varying float vElevation;

          void main() {
            float mixFactor = sin(vUv.x * 10.0 + time) * cos(vUv.y * 10.0 + time);
            vec3 color = mix(color1, color2, mixFactor * 0.5 + 0.5);

            float alpha = opacity * (1.0 - length(vUv - 0.5) * 2.0);
            alpha *= 1.0 + vElevation * 0.01;

            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const nebula = new THREE.Mesh(geometry, material);
      nebula.position.z = -1050;
      nebula.rotation.x = 0;
      scene.add(nebula);
      refs.nebula = nebula;
    };

    const createMountains = () => {
      const layers = [
        { distance: -50, height: 60, color: 0x1a1a2e, opacity: 1 },
        { distance: -100, height: 80, color: 0x16213e, opacity: 0.8 },
        { distance: -150, height: 100, color: 0x0f3460, opacity: 0.6 },
        { distance: -200, height: 120, color: 0x0a4668, opacity: 0.4 },
      ];

      layers.forEach((layer, index) => {
        const points: THREE.Vector2[] = [];
        const segments = 50;

        for (let i = 0; i <= segments; i++) {
          const x = (i / segments - 0.5) * 1000;
          const y =
            Math.sin(i * 0.1) * layer.height +
            Math.sin(i * 0.05) * layer.height * 0.5 +
            Math.random() * layer.height * 0.2 -
            100;
          points.push(new THREE.Vector2(x, y));
        }

        points.push(new THREE.Vector2(5000, -300));
        points.push(new THREE.Vector2(-5000, -300));

        const shape = new THREE.Shape(points);
        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          side: THREE.DoubleSide,
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.z = layer.distance;
        mountain.position.y = layer.distance;
        mountain.userData = { baseZ: layer.distance, index };
        scene.add(mountain);
        refs.mountains.push(mountain);
      });
    };

    const createAtmosphere = () => {
      const geometry = new THREE.SphereGeometry(600, 32, 32);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float time;

          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            vec3 atmosphere = vec3(0.3, 0.6, 1.0) * intensity;

            float pulse = sin(time * 2.0) * 0.1 + 0.9;
            atmosphere *= pulse;

            gl_FragColor = vec4(atmosphere, intensity * 0.25);
          }
        `,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      scene.add(new THREE.Mesh(geometry, material));
    };

    // Remember each mountain layer's resting depth so scrolling back can restore it
    const getLocation = () => {
      refs.locations = refs.mountains.map((mountain) => mountain.position.z);
    };

    const animate = () => {
      refs.animationId = requestAnimationFrame(animate);

      const time = Date.now() * 0.001;

      // Update stars
      refs.stars.forEach((starField) => {
        const timeUniform = starField.material.uniforms.time;
        if (timeUniform) timeUniform.value = time;
      });

      // Update nebula
      const nebulaTime = refs.nebula?.material.uniforms.time;
      if (nebulaTime) nebulaTime.value = time * 0.5;

      // Smooth camera movement with easing
      if (refs.targetCamera) {
        const smoothingFactor = 0.05; // Lower = smoother but slower
        const smooth = smoothCameraPos.current;

        smooth.x += (refs.targetCamera.x - smooth.x) * smoothingFactor;
        smooth.y += (refs.targetCamera.y - smooth.y) * smoothingFactor;
        smooth.z += (refs.targetCamera.z - smooth.z) * smoothingFactor;

        // Add subtle floating motion
        const floatX = Math.sin(time * 0.1) * 2;
        const floatY = Math.cos(time * 0.15) * 1;

        camera.position.x = smooth.x + floatX;
        camera.position.y = smooth.y + floatY;
        camera.position.z = smooth.z;
        camera.lookAt(0, 10, -600);
      }

      // Parallax mountains with subtle animation
      refs.mountains.forEach((mountain, i) => {
        const parallaxFactor = 1 + i * 0.5;
        mountain.position.x = Math.sin(time * 0.1) * 2 * parallaxFactor;
        mountain.position.y = 50 + Math.cos(time * 0.15) * 1 * parallaxFactor;
      });

      composer.render();
    };

    createStarField();
    createNebula();
    createMountains();
    createAtmosphere();
    getLocation();

    animate();

    // Mark as ready after Three.js is initialized
    setIsReady(true);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup (also runs between the two mounts in React StrictMode)
    return () => {
      if (refs.animationId !== null) {
        cancelAnimationFrame(refs.animationId);
      }

      window.removeEventListener('resize', handleResize);

      // Dispose every geometry and material in the scene
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials: THREE.Material[] = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });

      composer.dispose();
      renderer.dispose();

      // Reset so a re-mount starts from a clean slate instead of appending
      refs.scene = null;
      refs.camera = null;
      refs.renderer = null;
      refs.composer = null;
      refs.stars = [];
      refs.nebula = null;
      refs.mountains = [];
      refs.locations = [];
      refs.animationId = null;
    };
  }, []);

  // GSAP intro animation: runs once Three.js is ready
  useEffect(() => {
    if (!isReady) return;

    const ctx = gsap.context(() => {
      // Reveal the elements that start hidden (avoids a flash before the intro plays)
      gsap.set(
        [menuRef.current, titleRef.current, subtitleRef.current, scrollProgressRef.current],
        { visibility: 'visible' }
      );

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const tl = gsap.timeline();

      // Animate menu
      if (menuRef.current) {
        tl.from(menuRef.current, {
          x: -100,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
        });
      }

      // Animate title with split text
      if (titleRef.current) {
        const titleChars = titleRef.current.querySelectorAll('.title-char');
        tl.from(
          titleChars,
          {
            y: 200,
            opacity: 0,
            duration: 1.5,
            stagger: 0.05,
            ease: 'power4.out',
          },
          '-=0.5'
        );
      }

      // Animate subtitle lines
      if (subtitleRef.current) {
        const subtitleLines = subtitleRef.current.querySelectorAll('.subtitle-line');
        tl.from(
          subtitleLines,
          {
            y: 50,
            opacity: 0,
            duration: 1,
            stagger: 0.2,
            ease: 'power3.out',
          },
          '-=0.8'
        );
      }

      // Animate scroll indicator
      if (scrollProgressRef.current) {
        tl.from(
          scrollProgressRef.current,
          {
            opacity: 0,
            y: 50,
            duration: 1,
            ease: 'power2.out',
          },
          '-=0.5'
        );
      }
    });

    // revert() also restores inline styles, so StrictMode / hot reload replays cleanly
    return () => ctx.revert();
  }, [isReady]);

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      const refs = threeRefs.current;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - windowHeight;
      // Guard: a page that can't scroll would otherwise give 0 / 0 = NaN
      const progress = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

      setScrollProgress(progress);
      const newSection = Math.floor(progress * TOTAL_SECTIONS);
      setCurrentSection(newSection);

      // Smooth progress through all sections
      const totalProgress = progress * TOTAL_SECTIONS;
      const sectionProgress = totalProgress % 1;

      // Get current and next camera stops
      const currentPos = CAMERA_POSITIONS[newSection] ?? CAMERA_POSITIONS[0];
      const nextPos = CAMERA_POSITIONS[newSection + 1] ?? currentPos;

      // Set the target; the easing itself happens in the animate loop
      refs.targetCamera = {
        x: currentPos.x + (nextPos.x - currentPos.x) * sectionProgress,
        y: currentPos.y + (nextPos.y - currentPos.y) * sectionProgress,
        z: currentPos.z + (nextPos.z - currentPos.z) * sectionProgress,
      };

      // Hide the mountain layers once the camera has flown past them,
      // and put them back when the user scrolls up again
      refs.mountains.forEach((mountain, i) => {
        if (progress > 0.7) {
          mountain.position.z = 600000;
        }
        if (progress < 0.7) {
          mountain.position.z = refs.locations[i] ?? mountain.position.z;
        }
      });

      // The nebula follows the farthest mountain layer
      const farthestMountain = refs.mountains[3];
      if (refs.nebula && farthestMountain) {
        refs.nebula.position.z = farthestMountain.position.z;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Set initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="hero-container cosmos-style">
      <canvas ref={canvasRef} className="hero-canvas" />

      {/* Side menu */}
      <div ref={menuRef} className="side-menu" style={{ visibility: 'hidden' }}>
        <div className="menu-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="vertical-text">SPACE</div>
      </div>

      {/* Main content */}
      <div className="hero-content cosmos-content">
        <h1
          ref={titleRef}
          className="hero-title"
          aria-label="HORIZON"
          style={{ visibility: 'hidden' }}
        >
          {splitTitle('HORIZON')}
        </h1>

        <div
          ref={subtitleRef}
          className="hero-subtitle cosmos-subtitle"
          style={{ visibility: 'hidden' }}
        >
          <p className="subtitle-line">Where vision meets reality,</p>
          <p className="subtitle-line">we shape the future of tomorrow</p>
        </div>
      </div>

      {/* Scroll progress indicator */}
      <div
        ref={scrollProgressRef}
        className="scroll-progress"
        style={{ visibility: 'hidden' }}
      >
        <div className="scroll-text">SCROLL</div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>
        <div className="section-counter">
          {String(currentSection).padStart(2, '0')} /{' '}
          {String(TOTAL_SECTIONS).padStart(2, '0')}
        </div>
      </div>

      {/* Additional sections for scrolling */}
      <div className="scroll-sections">
        {SECTIONS.map((section) => (
          <section key={section.title} className="content-section">
            <h2 className="hero-title">{section.title}</h2>

            <div className="hero-subtitle cosmos-subtitle">
              <p className="subtitle-line">{section.line1}</p>
              <p className="subtitle-line">{section.line2}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

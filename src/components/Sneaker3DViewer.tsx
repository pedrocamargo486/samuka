import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { ChevronDown, ChevronUp, Layers, RotateCw, Sun, Moon } from 'lucide-react';
import type { Product } from '../types';
import { buildProceduralSneakerGroup, type SneakerModelParts } from './sneaker3d/buildSneakerModel';
import {
  createContactShadowTexture,
  createTurntableTexture,
  resolveSneakerPalette,
} from './sneaker3d/sneakerPalette';

interface Sneaker3DViewerProps {
  product: Product;
  selectedColor: string;
}

type CameraPresetKey = 'three_quarter' | 'side' | 'top' | 'back' | 'sole';

const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  three_quarter: { label: '3/4', pos: [2.45, 1.35, 2.55], target: [0, 0.42, 0] },
  side: { label: 'Lateral', pos: [0.1, 0.62, 3.25], target: [0, 0.42, 0] },
  top: { label: 'Topo', pos: [0.05, 3.35, 0.45], target: [0, 0.35, 0] },
  back: { label: 'Traseira', pos: [-3.1, 0.92, 0.35], target: [0, 0.45, 0] },
  sole: { label: 'Detalhe', pos: [1.9, 0.38, -2.15], target: [0, 0.28, 0] },
};

// Module-level preallocated math helpers (zero GC inside render loop)
const _camPosTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function Sneaker3DViewer({ product, selectedColor }: Sneaker3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [activePreset, setActivePreset] = useState<CameraPresetKey>('three_quarter');
  const [autoRotate, setAutoRotate] = useState(true);
  const [explodedAmount, setExplodedAmount] = useState(0);
  const [darkStudio, setDarkStudio] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const palette = useMemo(
    () => resolveSneakerPalette(product.colors || [], selectedColor, product.name),
    [product.colors, selectedColor, product.name]
  );

  // Mutable refs so React UI updates never recreate WebGLRenderer or reset OrbitControls
  const stateRef = useRef({
    autoRotate: true,
    explodedTarget: 0,
    explodedCurrent: 0,
    darkStudio: false,
    camTransitionActive: false,
    camPreset: 'three_quarter' as CameraPresetKey,
  });

  const sceneApiRef = useRef<{
    requestRender: () => void;
    updateStudioTheme: (dark: boolean) => void;
    updateModelColors: (nextPalette: typeof palette, brandName: string) => void;
  } | null>(null);

  // Initialize Three.js WebGL scene once per product mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    const lightBg = new THREE.Color('#F4F4F2');
    const darkBg = new THREE.Color('#16161A');
    scene.background = stateRef.current.darkStudio ? darkBg : lightBg;
    scene.fog = new THREE.Fog(
      stateRef.current.darkStudio ? '#16161A' : '#F4F4F2',
      7.5,
      16
    );

    // Studio Environment Reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    camera.position.set(...CAMERA_PRESETS.three_quarter.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.three_quarter.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 1.85;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
    controls.autoRotateSpeed = 1.4;

    // 3-Point Studio Lighting Rig (<= 3 shadow casters)
    const hemiLight = new THREE.HemisphereLight('#EAF2FF', '#C4BEB4', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF6EA', 2.0);
    keyLight.position.set(3.8, 5.5, 3.6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 2.5;
    keyLight.shadow.camera.bottom = -2.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#DCE8FF', 1.15);
    rimLight.position.set(-4.0, 2.8, -3.5);
    scene.add(rimLight);

    // Studio Softboxes (skipped on software WebGL)
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxTop = new THREE.RectAreaLight('#FFFFFF', 2.4, 4.5, 2.2);
      softboxTop.position.set(0, 4.2, 1.4);
      softboxTop.lookAt(0, 0.4, 0);
      scene.add(softboxTop);
    }

    // Studio Grounded Turntable & Radial Contact Shadow
    let turntableTex = createTurntableTexture(stateRef.current.darkStudio, maxAnisotropy);
    const turntableGeo = new THREE.CylinderGeometry(2.05, 2.12, 0.06, 64);
    const turntableMat = new THREE.MeshStandardMaterial({
      map: turntableTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const turntableMesh = new THREE.Mesh(turntableGeo, turntableMat);
    turntableMesh.position.set(0, -0.032, 0);
    turntableMesh.receiveShadow = true;
    scene.add(turntableMesh);

    const contactShadowTex = createContactShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(3.5, 2.2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, 0.002, 0.02);
    scene.add(shadowPlane);

    // Assemble Composite 10-Part Procedural Sneaker Model
    const sneakerModel: SneakerModelParts = buildProceduralSneakerGroup({
      palette,
      sneakerType: product.type,
      brandName: product.brandName,
      isSoftwareGl,
      maxAnisotropy,
    });
    sneakerModel.root.position.set(0, 0, 0);
    scene.add(sneakerModel.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Coalesced On-Demand & Damped Animation Loop with Software-WebGL Pacing
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        renderDirty = false;
        const delta = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        let needsMoreFrames = false;

        // 1. Exponential Camera Preset Damping
        if (stateRef.current.camTransitionActive) {
          const preset = CAMERA_PRESETS[stateRef.current.camPreset];
          _camPosTarget.set(...preset.pos);
          _lookTarget.set(...preset.target);
          const alpha = 1 - Math.exp(-7.5 * delta);
          camera.position.lerp(_camPosTarget, alpha);
          controls.target.lerp(_lookTarget, alpha);
          if (camera.position.distanceTo(_camPosTarget) < 0.015) {
            camera.position.copy(_camPosTarget);
            controls.target.copy(_lookTarget);
            stateRef.current.camTransitionActive = false;
          } else {
            needsMoreFrames = true;
          }
        }

        // 2. Smooth Exploded Layers Damping
        const expDiff = Math.abs(
          stateRef.current.explodedTarget - stateRef.current.explodedCurrent
        );
        if (expDiff > 0.002) {
          stateRef.current.explodedCurrent = THREE.MathUtils.damp(
            stateRef.current.explodedCurrent,
            stateRef.current.explodedTarget,
            8.0,
            delta
          );
          needsMoreFrames = true;
        } else {
          stateRef.current.explodedCurrent = stateRef.current.explodedTarget;
        }

        const e = stateRef.current.explodedCurrent;
        sneakerModel.layers.outsole.position.y = -e * 0.14;
        sneakerModel.layers.midsole.position.y = e * 0.06;
        sneakerModel.layers.upper.position.y = e * 0.34;
        sneakerModel.layers.overlays.position.y = e * 0.56;
        sneakerModel.layers.laces.position.y = e * 0.82;

        // 3. OrbitControls update
        controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
        const controlsMoved = controls.update();
        if (controls.autoRotate || controlsMoved) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || needsMoreFrames)) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    const handleControlStart = () => {
      stateRef.current.camTransitionActive = false;
    };
    const handleControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 200);
        const h = Math.max(entry.contentRect.height, 200);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    });
    resizeObserver.observe(container);

    sceneApiRef.current = {
      requestRender,
      updateStudioTheme: (dark: boolean) => {
        scene.background = dark ? darkBg : lightBg;
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.color.copy(dark ? darkBg : lightBg);
        }
        const nextTex = createTurntableTexture(dark, maxAnisotropy);
        turntableTex.dispose();
        turntableTex = nextTex;
        turntableMat.map = turntableTex;
        turntableMat.needsUpdate = true;
        requestRender();
      },
      updateModelColors: (nextPal, brand) => {
        sneakerModel.updatePalette(nextPal, brand, maxAnisotropy);
        requestRender();
      },
    };

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();

      sneakerModel.dispose();
      turntableGeo.dispose();
      turntableMat.dispose();
      turntableTex.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      contactShadowTex.dispose();
      envRT.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneApiRef.current = null;
    };
  }, [product.id, product.type]);

  // Sync palette updates without resetting camera or WebGL context
  useEffect(() => {
    sceneApiRef.current?.updateModelColors(palette, product.brandName);
  }, [palette, product.brandName]);

  // Sync studio light/dark backdrop
  useEffect(() => {
    stateRef.current.darkStudio = darkStudio;
    sceneApiRef.current?.updateStudioTheme(darkStudio);
  }, [darkStudio]);

  // Sync auto-rotate & exploded slider
  useEffect(() => {
    stateRef.current.autoRotate = autoRotate;
    sceneApiRef.current?.requestRender();
  }, [autoRotate]);

  useEffect(() => {
    stateRef.current.explodedTarget = explodedAmount;
    sceneApiRef.current?.requestRender();
  }, [explodedAmount]);

  const handleSelectCameraPreset = (preset: CameraPresetKey) => {
    setActivePreset(preset);
    stateRef.current.camPreset = preset;
    stateRef.current.camTransitionActive = true;
    sceneApiRef.current?.requestRender();
  };

  return (
    <div className="relative w-full aspect-[4/3] min-h-[320px] sm:min-h-[420px] overflow-hidden select-none border border-stone-200 bg-[#F4F4F2]">
      {/* Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Minimal Top-Left Badge (Static, zero backdrop-blur, zero pulsing dots) */}
      <div
        className={`pointer-events-none absolute top-3 left-3 px-2.5 py-1.5 border text-[11px] font-semibold tracking-wide ${
          darkStudio
            ? 'bg-[#1F1F24] border-stone-700 text-stone-200'
            : 'bg-white border-stone-300 text-[#111111]'
        }`}
      >
        <span className="font-bold uppercase tracking-wider">3D Interativo</span>
        <span className="mx-1.5 opacity-40">·</span>
        <span className="opacity-80">Arraste 360° ou dê zoom</span>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-[580px] flex flex-col items-center pointer-events-none">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className={`pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 border border-b-0 text-[10px] font-bold uppercase tracking-wider cursor-pointer ${
            darkStudio
              ? 'bg-[#1B1B1F] border-stone-700 text-stone-200 hover:text-white'
              : 'bg-white border-stone-300 text-[#111111] hover:bg-stone-50'
          }`}
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Mostrar controles 3D</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Ocultar controles</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div
            className={`pointer-events-auto w-full border p-2.5 sm:p-3 shadow-lg space-y-2.5 ${
              darkStudio
                ? 'bg-[#1B1B1F] border-stone-700 text-stone-100'
                : 'bg-white border-stone-300 text-[#111111]'
            }`}
          >
            {/* Camera Presets + Utility Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetKey[]).map((key) => {
                  const isActive = activePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectCameraPreset(key)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#C8102E] text-white border-[#C8102E]'
                          : darkStudio
                            ? 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                            : 'bg-stone-50 border-stone-300 text-[#111111] hover:border-[#111111]'
                      }`}
                    >
                      {CAMERA_PRESETS[key].label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoRotate((r) => !r)}
                  title="Girar automaticamente"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase border cursor-pointer ${
                    autoRotate
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : darkStudio
                        ? 'bg-stone-900 border-stone-700 text-stone-300'
                        : 'bg-white border-stone-300 text-stone-600'
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  <span className="hidden sm:inline">Girar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDarkStudio((d) => !d)}
                  title={darkStudio ? 'Estúdio claro' : 'Estúdio escuro'}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold uppercase border cursor-pointer ${
                    darkStudio
                      ? 'bg-stone-800 border-stone-600 text-white'
                      : 'bg-white border-stone-300 text-[#111111]'
                  }`}
                >
                  {darkStudio ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Exploded Construction Layers Slider */}
            <div className="flex items-center gap-2.5 pt-1 border-t border-stone-200/20">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80 shrink-0">
                <Layers className="w-3 h-3 text-[#C8102E]" />
                <span>Camadas</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={explodedAmount}
                onChange={(e) => setExplodedAmount(Number(e.target.value))}
                aria-label="Separar camadas do tênis em 3D"
                className="flex-1 accent-[#C8102E] cursor-pointer h-1.5"
              />
              <span className="font-mono-num text-[10px] font-bold w-8 text-right opacity-80">
                {Math.round(explodedAmount * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

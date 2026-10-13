import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei/core/Float";
import { RoundedBox } from "@react-three/drei/core/RoundedBox";
import * as THREE from "three";
import { SCENE, STATIONS, type Station } from "./stations";

const W = 16;
const H = (W * SCENE.h) / SCENE.w;
const FOV = 30;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
// contain-fit: the whole image is always in frame for the canvas aspect, recomputed on resize
const fitZ = (aspect: number) => Math.max(H / 2 / TAN, W / 2 / (TAN * aspect));
const ORANGE = new THREE.Color("#f97316");
const BLUE = new THREE.Color("#60a5fa");
const ease = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const damp = THREE.MathUtils.damp;

type Props = { hot: string | null; going: string | null; onHover: (id: string | null) => void; onReady: () => void };

function toWorld(s: Station) {
  const [x0, y0, x1, y1] = s.box;
  return {
    x: ((x0 + x1) / 2 / SCENE.w - 0.5) * W,
    y: (0.5 - (y0 + y1) / 2 / SCENE.h) * H,
    w: ((x1 - x0) / SCENE.w) * W,
    h: ((y1 - y0) / SCENE.h) * H,
  };
}

function sweepTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 8;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, "rgba(255,255,255,0)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.55)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Backdrop({ tex, dim }: { tex: THREE.Texture; dim: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((_, dt) => {
    const v = damp(mat.current.color.r, dim ? 0.62 : 1, 6, dt);
    mat.current.color.setScalar(v);
  });
  return (
    <mesh>
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial ref={mat} map={tex} toneMapped={false} />
    </mesh>
  );
}

function StationMesh({ s, i, tex, sweep, hot, going, onHover }: {
  s: Station; i: number; tex: THREE.Texture; sweep: THREE.Texture; hot: boolean; going: boolean; onHover: (id: string | null) => void;
}) {
  const p = useMemo(() => toWorld(s), [s]);
  const face = useMemo(() => {
    const t = tex.clone();
    const [x0, , x1, y1] = s.box;
    t.repeat.set((x1 - x0) / SCENE.w, (s.box[3] - s.box[1]) / SCENE.h);
    t.offset.set(x0 / SCENE.w, 1 - y1 / SCENE.h);
    t.needsUpdate = true;
    return t;
  }, [tex, s]);
  const g = useRef<THREE.Group>(null!);
  const shade = useRef<THREE.MeshBasicMaterial>(null!);
  const edge = useRef<THREE.LineBasicMaterial>(null!);
  const band = useRef<THREE.Mesh>(null!);
  const bandMat = useRef<THREE.MeshBasicMaterial>(null!);
  const born = useRef<number | null>(null);
  const sweepT = useRef(-1);
  const wasHot = useRef(false);
  const accent = s.accent === "orange" ? ORANGE : BLUE;
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.w * 1.004, p.h * 1.004)), [p]);

  useFrame(({ clock, pointer }, dt) => {
    const t = clock.elapsedTime;
    if (born.current === null) born.current = t;
    const k = ease((t - born.current - 0.25 - i * 0.14) / 0.9); // staggered entrance
    const lift = going ? 1.4 : 0; // hover stays flat so the painted button and the link line up
    const gr = g.current;
    gr.position.z = damp(gr.position.z, lift, 7, dt);
    gr.position.y = p.y - (1 - k) * 1.1;
    const sc = 0.92 + 0.08 * k;
    gr.scale.setScalar(damp(gr.scale.x, sc, 8, dt));
    gr.rotation.x = damp(gr.rotation.x, going ? -pointer.y * 0.06 : 0, 6, dt);
    gr.rotation.y = damp(gr.rotation.y, going ? pointer.x * 0.08 : 0, 6, dt);
    shade.current.opacity = damp(shade.current.opacity, going ? 0.85 : 0, 8, dt) * k;
    edge.current.opacity = damp(edge.current.opacity, hot ? 1 : 0.18 * k, 8, dt);
    // light sweep: on hover start, and a quiet idle pass every few seconds
    if (hot && !wasHot.current) sweepT.current = 0;
    wasHot.current = hot;
    const idle = (t + i * 1.7) % 7;
    if (sweepT.current < 0 && idle < dt && k >= 1) sweepT.current = 0;
    if (sweepT.current >= 0) {
      sweepT.current += dt / (hot ? 0.75 : 1.3);
      const u = sweepT.current;
      band.current.position.x = (-0.7 + 1.4 * u) * p.w;
      bandMat.current.opacity = Math.sin(Math.PI * Math.min(u, 1)) * (hot ? 0.5 : 0.18);
      if (u >= 1) { sweepT.current = -1; bandMat.current.opacity = 0; }
    }
  });

  return (
    <>
      {/* hides the painted panel underneath once the station lifts off it */}
      <mesh position={[p.x, p.y, 0.005]}>
        <planeGeometry args={[p.w, p.h]} />
        <meshBasicMaterial ref={shade} color="#04070b" transparent opacity={0} />
      </mesh>
      <group ref={g} position={[p.x, p.y, 0]}>
        <RoundedBox args={[p.w, p.h, 0.1]} radius={0.04} smoothness={2} position={[0, 0, -0.05]}>
          <meshBasicMaterial color="#0d131a" />
        </RoundedBox>
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[p.w, p.h]} />
          <meshBasicMaterial map={face} toneMapped={false} />
        </mesh>
        <lineSegments geometry={edgeGeo} position={[0, 0, 0.004]}>
          <lineBasicMaterial ref={edge} color={accent} transparent opacity={0} />
        </lineSegments>
        <mesh ref={band} position={[-p.w, 0, 0.006]} scale={[p.w * 0.35, p.h, 1]} rotation={[0, 0, -0.12]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={bandMat} map={sweep} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* floating HUD bracket plate, crisp lines only */}
        <Float speed={1.6} rotationIntensity={0} floatIntensity={0.25} floatingRange={[-0.03, 0.03]}>
          <Brackets w={p.w} h={p.h} color={accent} hot={hot} />
        </Float>
      </group>
    </>
  );
}

function Brackets({ w, h, color, hot }: { w: number; h: number; color: THREE.Color; hot: boolean }) {
  const mat = useRef<THREE.LineBasicMaterial>(null!);
  const grp = useRef<THREE.Group>(null!);
  const geo = useMemo(() => {
    const a = 0.32, x = w / 2 + 0.08, y = h / 2 + 0.08;
    const v = [
      -x, y - a, 0, -x, y, 0, -x, y, 0, -x + a, y, 0,
      x - a, -y, 0, x, -y, 0, x, -y, 0, x, -y + a, 0,
    ];
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return gg;
  }, [w, h]);
  useFrame((_, dt) => {
    mat.current.opacity = damp(mat.current.opacity, hot ? 1 : 0, 9, dt);
    grp.current.scale.setScalar(damp(grp.current.scale.x, hot ? 1 : 1.04, 9, dt));
  });
  return (
    <group ref={grp} position={[0, 0, 0.2]}>
      <lineSegments geometry={geo}><lineBasicMaterial ref={mat} color={color} transparent opacity={0} /></lineSegments>
    </group>
  );
}

function Rig({ hot, going }: { hot: string | null; going: string | null }) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ pointer, clock }, dt) => {
    const id = going ?? hot;
    const s = STATIONS.find((x) => x.id === id);
    const p = s ? toWorld(s) : null;
    const intro = ease(clock.elapsedTime / 1.4);
    // no idle or hover camera drift: the frame stays exactly fitted; only the launch transition moves in
    void pointer;
    const tx = going && p ? p.x * 0.25 : 0;
    const ty = going && p ? p.y * 0.25 : 0;
    const tz = fitZ(size.width / Math.max(size.height, 1)) + (1 - intro) * 1.6 - (going ? 2.2 : 0);
    camera.position.x = damp(camera.position.x, tx, going ? 5 : 3, dt);
    camera.position.y = damp(camera.position.y, ty, going ? 5 : 3, dt);
    camera.position.z = damp(camera.position.z, tz, going ? 5 : 3, dt);
    target.set(camera.position.x * 0.6, camera.position.y * 0.6, 0);
    camera.lookAt(target);
  });
  return null;
}

function Scene({ hot, going, onHover, onReady }: Props) {
  const tex = useLoader(THREE.TextureLoader, SCENE.large);
  const sweep = useMemo(sweepTexture, []);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }, [tex]);
  useEffect(() => { onReady(); }, [onReady]);
  return (
    <>
      <Rig hot={hot} going={going} />
      <Backdrop tex={tex} dim={!!hot || !!going} />
      {STATIONS.map((s, i) => (
        <StationMesh key={s.id} s={s} i={i} tex={tex} sweep={sweep} hot={hot === s.id} going={going === s.id} onHover={onHover} />
      ))}
    </>
  );
}

export default function Lab3D(props: Props) {
  return (
    <Canvas className="canvas" eventSource={document.getElementById("stage")!} eventPrefix="client" dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, fitZ(SCENE.w / SCENE.h) + 1.6], near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: "high-performance" }} flat>
      <Suspense fallback={null}><Scene {...props} /></Suspense>
    </Canvas>
  );
}

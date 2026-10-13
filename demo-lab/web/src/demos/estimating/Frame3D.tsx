/* eslint-disable @typescript-eslint/no-explicit-any */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import * as THREE from "three";
import { CAT_COLOR } from "./calc";

export type FrameApi = { fit: () => void; reset: () => void };
type Member = { a: [number, number, number]; b: [number, number, number]; cat: string; size: number };

/* A simple steel frame laid out from the takeoff: columns on a grid, beams at each level, angle braces, base plates. */
export function layout(rows: any[]): { members: Member[]; plates: [number, number][]; bays: [number, number]; stories: number } {
  const on = rows.filter((r) => r.on && r.lbs_total != null);
  const n = (c: string) => on.filter((r) => r.cat === c).reduce((a, r) => a + r.qty, 0);
  const cols = Math.max(4, n("Column") || 4), beams = n("Beam") + n("Channel") + n("Tube");
  const nx = Math.max(2, Math.ceil(Math.sqrt(cols * 1.5))), ny = Math.max(2, Math.ceil(cols / nx));
  const per = (nx - 1) * ny + nx * (ny - 1);
  const stories = Math.min(3, Math.max(1, Math.round(beams / Math.max(1, per)) || 1));
  const bay = 2.0, h = 1.4, M: Member[] = [], ox = ((nx - 1) * bay) / 2, oz = ((ny - 1) * bay) / 2;
  const P = (i: number, j: number, k: number): [number, number, number] => [i * bay - ox, k * h, j * bay - oz];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) M.push({ a: P(i, j, 0), b: P(i, j, stories), cat: "Column", size: 0.11 });
  for (let k = 1; k <= stories; k++) {
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny; j++) M.push({ a: P(i, j, k), b: P(i + 1, j, k), cat: "Beam", size: 0.09 });
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny - 1; j++) M.push({ a: P(i, j, k), b: P(i, j + 1, k), cat: j % 2 ? "Channel" : "Beam", size: 0.08 });
  }
  if (n("Angle")) for (let k = 0; k < stories; k++) { M.push({ a: P(0, 0, k), b: P(1, 0, k + 1), cat: "Angle", size: 0.05 }); M.push({ a: P(nx - 1, ny - 1, k), b: P(nx - 2, ny - 1, k + 1), cat: "Angle", size: 0.05 }); }
  if (n("Pipe")) for (let i = 0; i < nx - 1; i++) M.push({ a: [P(i, 0, stories)[0], stories * h + 0.5, -oz - 0.2], b: [P(i + 1, 0, stories)[0], stories * h + 0.5, -oz - 0.2], cat: "Pipe", size: 0.04 });
  const plates: [number, number][] = []; for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const p = P(i, j, 0); plates.push([p[0], p[2]]); }
  return { members: M, plates, bays: [nx - 1, ny - 1], stories };
}

function Beam({ m }: { m: Member }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b), d = b.clone().sub(a);
    return { pos: a.clone().add(b).multiplyScalar(0.5), len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [m]);
  return <mesh position={pos} quaternion={quat} castShadow><boxGeometry args={[m.size, len, m.size * (m.cat === "Beam" ? 1.6 : 1)]} /><meshStandardMaterial color={CAT_COLOR[m.cat] ? "#9aa7b7" : "#9aa7b7"} metalness={0.75} roughness={0.38} emissive={CAT_COLOR[m.cat]} emissiveIntensity={0.08} /></mesh>;
}

const Rig = forwardRef<FrameApi, { size: number; mode: string }>(function Rig({ size, mode }, ref) {
  const { camera } = useThree();
  const ctl = useRef<any>(null);
  const home = useMemo(() => new THREE.Vector3(size * 0.95, size * 0.6, size * 1.05), [size]);
  const fit = () => { camera.position.copy(home.clone().multiplyScalar(0.72)); ctl.current?.target.set(0, size * 0.12, 0); ctl.current?.update(); };
  const reset = () => { camera.position.copy(home); ctl.current?.target.set(0, size * 0.12, 0); ctl.current?.update(); };
  useImperativeHandle(ref, () => ({ fit, reset }));
  useEffect(reset, [size]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = ctl.current; if (!c) return;
    c.mouseButtons = { LEFT: mode === "pan" ? THREE.MOUSE.PAN : mode === "zoom" ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: mode === "pan" ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
  }, [mode]);
  return <OrbitControls ref={ctl} makeDefault enableDamping dampingFactor={0.12} minDistance={2} maxDistance={size * 4} />;
});

export default forwardRef<FrameApi, { rows: any[]; mode: string }>(function Frame3D({ rows, mode }, ref) {
  const L = useMemo(() => layout(rows), [rows]);
  const size = Math.max(L.bays[0], L.bays[1]) * 2 + L.stories * 1.4;
  return (
    <Canvas className="frame3d" dpr={[1, 1.75]} shadows camera={{ fov: 40, position: [8, 6, 9] }} aria-label="3D model of the steel frame">
      <color attach="background" args={["#0b1220"]} />
      <hemisphereLight args={["#cfe0ff", "#0b1220", 0.7]} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} castShadow />
      <directionalLight position={[-6, 4, -6]} intensity={0.5} color="#93c5fd" />
      <gridHelper args={[size * 2, Math.round(size * 2), "#1e3a5f", "#13233a"]} position={[0, 0.001, 0]} />
      {L.members.map((m, i) => <Beam key={i} m={m} />)}
      {L.plates.map(([x, z], i) => <mesh key={i} position={[x, 0.02, z]}><boxGeometry args={[0.32, 0.04, 0.32]} /><meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.5} /></mesh>)}
      <axesHelper args={[0.9]} position={[-size * 0.55, 0.01, size * 0.45]} />
      <Rig ref={ref} size={size} mode={mode} />
    </Canvas>
  );
});

import { Component, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, ContactShadows, Float, OrbitControls, Sparkles, useGLTF } from '@react-three/drei';

/* Copper kettle built from simple shapes — shown when no .glb is uploaded in admin */
function CopperKettle() {
  const copper = { color: '#B87333', metalness: 0.9, roughness: 0.28 };
  const charcoal = { color: '#1F2326', metalness: 0.4, roughness: 0.5 };
  return (
    <group position={[0, -0.2, 0]}>
      {/* body */}
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.72, 0.9, 1.1, 64]} />
        <meshStandardMaterial {...copper} />
      </mesh>
      {/* shoulder */}
      <mesh castShadow position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.72, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...copper} />
      </mesh>
      {/* lid knob */}
      <mesh castShadow position={[0, 1.9, 0]}>
        <sphereGeometry args={[0.13, 32, 16]} />
        <meshStandardMaterial {...charcoal} />
      </mesh>
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.3, 0.42, 0.08, 48]} />
        <meshStandardMaterial {...charcoal} />
      </mesh>
      {/* handle */}
      <mesh castShadow position={[-0.05, 1.45, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.62, 0.07, 16, 64, Math.PI]} />
        <meshStandardMaterial {...charcoal} />
      </mesh>
      {/* spout */}
      <mesh castShadow position={[0.95, 0.85, 0]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.07, 0.16, 0.75, 32]} />
        <meshStandardMaterial {...copper} />
      </mesh>
      {/* base */}
      <mesh receiveShadow position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.98, 1.02, 0.08, 64]} />
        <meshStandardMaterial {...charcoal} />
      </mesh>
    </group>
  );
}

// Size of the 3D model from Django admin (1 = original size). Lower = smaller.
const MODEL_SCALE = 0.75;

function GLBModel({ url }) {
  const { scene } = useGLTF(url);
  return (
    <group scale={MODEL_SCALE} position={[0, 0.35, 0]}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

/* Gentle rotation + mouse-parallax tilt */
function Rig({ children, parallax }) {
  const ref = useRef();
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.25;
    if (parallax) {
      ref.current.rotation.x += (state.pointer.y * 0.15 - ref.current.rotation.x) * 0.06;
      ref.current.position.x += (state.pointer.x * 0.25 - ref.current.position.x) * 0.05;
    }
  });
  return <group ref={ref}>{children}</group>;
}

class ModelBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function ModelViewer({ url, interactive = false, parallax = false, steam = true }) {
  return (
    <Canvas
      className="model-canvas"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.4, 5.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#F1E7DC" />
      <pointLight position={[0, 3, 2]} intensity={0.8} color="#D9A273" />

      <Suspense fallback={null}>
        <Float speed={1.4} rotationIntensity={interactive ? 0 : 0.25} floatIntensity={0.6}>
          <Rig parallax={parallax && !interactive}>
            <ModelBoundary fallback={<CopperKettle />}>{url ? <GLBModel url={url} /> : <CopperKettle />}</ModelBoundary>
          </Rig>
        </Float>
        {steam && <Sparkles count={36} scale={[2, 2.6, 2]} position={[0.4, 2.3, 0]} size={3} speed={0.35} color="#FFFFFF" opacity={0.7} />}
        <ContactShadows position={[0, -0.3, 0]} opacity={0.35} scale={6} blur={2.6} far={3} color="#1F2326" />
      </Suspense>

      {interactive && <OrbitControls enablePan={false} enableZoom minDistance={3} maxDistance={8} autoRotate={false} />}
    </Canvas>
  );
}

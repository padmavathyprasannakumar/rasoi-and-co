import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../ui/Icon';
import { SmartImage, Spinner } from '../ui/Primitives';
import { cldUrl, isLowEndDevice } from '../../utils/image';

const ModelViewer = lazy(() => import('../home/ModelViewer'));

export default function ProductGallery({ images = [], name, model3d, imgRef }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [show3d, setShow3d] = useState(false);
  const current = images[active];

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  return (
    <div className="gallery">
      <div className="gallery-thumbs" role="tablist" aria-label="Product images">
        {images.map((img, i) => (
          <button
            key={img.id}
            className={`thumb ${i === active && !show3d ? 'active' : ''}`}
            onClick={() => {
              setActive(i);
              setShow3d(false);
            }}
            role="tab"
            aria-selected={i === active && !show3d}
          >
            <SmartImage src={img.image} alt={img.alt_text || `${name} view ${i + 1}`} width={160} sizes="80px" />
          </button>
        ))}
        {model3d && !isLowEndDevice() && (
          <button className={`thumb thumb-3d ${show3d ? 'active' : ''}`} onClick={() => setShow3d(true)} aria-label="View in 3D">
            <Icon name="cube" size={22} />
            <small>3D</small>
          </button>
        )}
      </div>

      <div className="gallery-main">
        <AnimatePresence mode="wait">
          {show3d ? (
            <motion.div key="3d" className="gallery-3d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Suspense fallback={<Spinner label="Loading 3D view" />}>
                <ModelViewer url={model3d} interactive />
              </Suspense>
              <span className="gallery-hint">Drag to rotate</span>
            </motion.div>
          ) : (
            <motion.div
              key={current?.id || 'ph'}
              className="gallery-zoom"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              onPointerMove={current ? onMove : undefined}
              onPointerLeave={() => setZoom((z) => ({ ...z, on: false }))}
            >
              <SmartImage src={current?.image} alt={current?.alt_text || name} width={1000} eager sizes="(max-width: 1024px) 100vw, 50vw" imgRef={imgRef} />
              {current && zoom.on && (
                <div
                  className="zoom-lens"
                  style={{ backgroundImage: `url("${cldUrl(current.image, 1800)}")`, backgroundPosition: `${zoom.x}% ${zoom.y}%` }}
                  aria-hidden="true"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {model3d && !show3d && !isLowEndDevice() && (
          <button className="btn btn-outline view3d-btn" onClick={() => setShow3d(true)}>
            <Icon name="cube" size={16} /> View in 3D
          </button>
        )}
      </div>
    </div>
  );
}

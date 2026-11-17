import ProductCard from './ProductCard';
import { Stagger, StaggerItem } from '../ui/Reveal';
import { SkeletonGrid } from '../ui/Primitives';

export default function ProductGrid({ products, loading, skeletonCount = 8, className = '' }) {
  if (loading) return <SkeletonGrid count={skeletonCount} />;
  return (
    <Stagger className={`product-grid ${className}`}>
      {(products || []).map((p, i) => (
        <StaggerItem key={p.slug}>
          <ProductCard product={p} priority={i < 4} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

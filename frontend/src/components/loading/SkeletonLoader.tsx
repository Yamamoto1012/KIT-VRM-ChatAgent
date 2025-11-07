/**
 * SkeletonLoader - スケルトンUI用のプレースホルダーコンポーネント
 *
 * 用途: 大きなコンポーネント（VRMContainerなど）の遅延読み込み中に画面レイアウトを保持するスケルトン表示
 */
interface SkeletonLoaderProps {
	className?: string;
}

export function SkeletonLoader({ className = "" }: SkeletonLoaderProps) {
	return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

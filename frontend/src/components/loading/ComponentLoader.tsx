/**
 * ComponentLoader - 遅延読み込みコンポーネントのSuspenseフォールバックUI
 */
export function ComponentLoader() {
	return (
		<div className="flex items-center justify-center p-8">
			<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
		</div>
	);
}

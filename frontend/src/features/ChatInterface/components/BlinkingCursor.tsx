import type React from "react";

export type BlinkingCursorProps = {
	className?: string;
};

/**
 * ストリーミング中に表示される点滅カーソルコンポーネント
 */
export const BlinkingCursor: React.FC<BlinkingCursorProps> = ({
	className = "",
}) => {
	return (
		<span
			className={`inline-block ml-1 text-gray-800 animate-blink ${className}`}
		>
			|
		</span>
	);
};

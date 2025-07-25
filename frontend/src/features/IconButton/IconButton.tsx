import { Button } from "@/components/ui/button";
import { useCharacterTheme } from "@/hooks/useCharacterTheme";
import type React from "react";

export type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export type IconButtonProps = {
	icon: IconComponent;
	onClick: React.MouseEventHandler<HTMLButtonElement>;
	className?: string;
	iconClassName?: string;
};

export const IconButton: React.FC<IconButtonProps> = ({
	icon: Icon,
	onClick,
	className = "",
	iconClassName = "h-5 w-5",
}) => {
	const { colors } = useCharacterTheme();
	return (
		<Button
			onClick={onClick}
			variant="outline"
			size="icon"
			className={`rounded-full w-12 h-12 backdrop-blur-md border-white/20 text-white hover:bg-white/20 ${className}`}
			style={{ backgroundColor: colors.primary }}
		>
			<Icon className={iconClassName} />
		</Button>
	);
};

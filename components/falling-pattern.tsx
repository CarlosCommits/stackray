'use client';

import type React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type FallingPatternProps = React.ComponentProps<'div'> & {
	/** Primary color of the falling elements (default: 'var(--primary)') */
	color?: string;
	/** Background color (default: 'var(--background)') */
	backgroundColor?: string;
	/** Animation duration in seconds (default: 150) */
	duration?: number;
	/** Blur intensity for the overlay effect (default: '1em') */
	blurIntensity?: string;
	/** Pattern density - affects spacing (default: 1) */
	density?: number;
};

export function FallingPattern({
	color = 'var(--primary)',
	backgroundColor = 'var(--background)',
	duration = 150,
	blurIntensity = '1em',
	density = 1,
	className,
}: FallingPatternProps) {
	// Generate background image style with customizable color
	const generateBackgroundImage = () => {
		const patterns = [
			// Row 1
			`radial-gradient(4px 100px at 0px 235px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 235px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 117.5px, ${color} 100%, transparent 150%)`,
			// Row 2
			`radial-gradient(4px 100px at 0px 252px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 252px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 126px, ${color} 100%, transparent 150%)`,
			// Row 3
			`radial-gradient(4px 100px at 0px 150px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 150px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 75px, ${color} 100%, transparent 150%)`,
			// Row 4
			`radial-gradient(4px 100px at 0px 253px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 253px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 126.5px, ${color} 100%, transparent 150%)`,
			// Row 5
			`radial-gradient(4px 100px at 0px 204px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 204px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 102px, ${color} 100%, transparent 150%)`,
			// Row 6
			`radial-gradient(4px 100px at 0px 134px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 134px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 67px, ${color} 100%, transparent 150%)`,
			// Row 7
			`radial-gradient(4px 100px at 0px 179px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 179px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 89.5px, ${color} 100%, transparent 150%)`,
			// Row 8
			`radial-gradient(4px 100px at 0px 299px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 299px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 149.5px, ${color} 100%, transparent 150%)`,
			// Row 9
			`radial-gradient(4px 100px at 0px 215px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 215px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 107.5px, ${color} 100%, transparent 150%)`,
			// Row 10
			`radial-gradient(4px 100px at 0px 281px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 281px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 140.5px, ${color} 100%, transparent 150%)`,
			// Row 11
			`radial-gradient(4px 100px at 0px 158px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 158px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 79px, ${color} 100%, transparent 150%)`,
			// Row 12
			`radial-gradient(4px 100px at 0px 210px, ${color}, transparent)`,
			`radial-gradient(4px 100px at 300px 210px, ${color}, transparent)`,
			`radial-gradient(1.5px 1.5px at 150px 105px, ${color} 100%, transparent 150%)`,
		];

		return patterns.join(', ');
	};

	const backgroundSizes = [
		'300px 235px',
		'300px 235px',
		'300px 235px',
		'300px 252px',
		'300px 252px',
		'300px 252px',
		'300px 150px',
		'300px 150px',
		'300px 150px',
		'300px 253px',
		'300px 253px',
		'300px 253px',
		'300px 204px',
		'300px 204px',
		'300px 204px',
		'300px 134px',
		'300px 134px',
		'300px 134px',
		'300px 179px',
		'300px 179px',
		'300px 179px',
		'300px 299px',
		'300px 299px',
		'300px 299px',
		'300px 215px',
		'300px 215px',
		'300px 215px',
		'300px 281px',
		'300px 281px',
		'300px 281px',
		'300px 158px',
		'300px 158px',
		'300px 158px',
		'300px 210px',
		'300px 210px',
	].join(', ');

	const startPositions =
		'0px 220px, 3px 220px, 151.5px 337.5px, 25px 24px, 28px 24px, 176.5px 150px, 50px 16px, 53px 16px, 201.5px 91px, 75px 224px, 78px 224px, 226.5px 230.5px, 100px 19px, 103px 19px, 251.5px 121px, 125px 120px, 128px 120px, 276.5px 187px, 150px 31px, 153px 31px, 301.5px 120.5px, 175px 235px, 178px 235px, 326.5px 384.5px, 200px 121px, 203px 121px, 351.5px 228.5px, 225px 224px, 228px 224px, 376.5px 364.5px, 250px 26px, 253px 26px, 401.5px 105px, 275px 75px, 278px 75px, 426.5px 180px';
	const endPositions =
		'0px 6800px, 3px 6800px, 151.5px 6917.5px, 25px 13632px, 28px 13632px, 176.5px 13758px, 50px 5416px, 53px 5416px, 201.5px 5491px, 75px 17175px, 78px 17175px, 226.5px 17301.5px, 100px 5119px, 103px 5119px, 251.5px 5221px, 125px 8428px, 128px 8428px, 276.5px 8495px, 150px 9876px, 153px 9876px, 301.5px 9965.5px, 175px 13391px, 178px 13391px, 326.5px 13540.5px, 200px 14741px, 203px 14741px, 351.5px 14848.5px, 225px 18770px, 228px 18770px, 376.5px 18910.5px, 250px 5082px, 253px 5082px, 401.5px 5161px, 275px 6375px, 278px 6375px, 426.5px 6480px';
	return (
		<div className={cn('relative h-full w-full p-1', className)}>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="size-full"
			>
				<motion.div
					className="relative size-full z-0"
					style={{
						backgroundColor,
						backgroundImage: generateBackgroundImage(),
						backgroundSize: backgroundSizes,
					}}
					variants={{
						initial: {
							backgroundPosition: startPositions,
						},
						animate: {
							backgroundPosition: [startPositions, endPositions],
							transition: {
								duration: duration,
								ease: 'linear',
								repeat: Number.POSITIVE_INFINITY,
							},
						},
					}}
					initial="initial"
					animate="animate"
				/>
			</motion.div>
			<div
				className="absolute inset-0 z-1 dark:brightness-600"
				style={{
					backdropFilter: `blur(${blurIntensity})`,
					backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${backgroundColor} 2px)`,
					backgroundSize: `${8 * density}px ${8 * density}px`,
				}}
			/>
		</div>
	);
}

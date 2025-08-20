import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function App() {
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		// İlk açılışta sistem tercihine bak
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		setIsDark(prefersDark);
		if (prefersDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}

		// Sistem teması değişirse dinle
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
			setIsDark(e.matches);
			if (e.matches) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		};
		mediaQuery.addEventListener('change', handler);

		return () => mediaQuery.removeEventListener('change', handler);
	}, []);

	// const toggleDark = () => {
	// 	const newMode = !isDark;
	// 	setIsDark(newMode);
	// 	if (newMode) {
	// 		document.documentElement.classList.add('dark');
	// 	} else {
	// 		document.documentElement.classList.remove('dark');
	// 	}
	// };

	return (
		<div className='min-h-dvh bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 w-100'>
			<header className='top-0 z-10 border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur flex items-center justify-between'>
				<div className='mx-auto max-w-screen-sm p-4 font-semibold'>Birlikte Planla</div>
				{/* <button onClick={toggleDark} className='m-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-700'>
					{isDark ? '☀️' : '🌙'}
				</button> */}
			</header>

			<main className='mx-auto max-w-screen-sm p-4 pb-24'>
				<Outlet />
			</main>
		</div>
	);
}

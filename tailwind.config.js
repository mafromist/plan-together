export default {
	darkMode: 'class', // dark mode toggle için
	content: ['./index.html', './src/**/*.{ts,tsx}'],
	theme: { extend: {} },
	plugins: [require('flowbite/plugin')],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#f5f3ff',
					100: '#ede9fe',
					200: '#ddd6fe',
					300: '#c4b5fd',
					400: '#a78bfa',
					500: '#8b5cf6',
					600: '#7c3aed',
					700: '#6d28d9',
					800: '#5b21b6',
					900: '#4c1d95',
				},
				surface: {
					light: '#ffffff',
					dark: '#18181b', // zinc-900
					cardLight: '#f9fafb',
					cardDark: '#27272a',
				},
				textc: {
					light: '#1f2937',
					dark: '#e5e7eb',
					mutedLight: '#6b7280',
					mutedDark: '#9ca3af',
				},
			},
		},
	},
};

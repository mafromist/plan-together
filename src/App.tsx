import { Outlet, Link } from 'react-router-dom';

export default function App() {
	return (
		<div className='min-h-dvh bg-gray-50 text-gray-900 w-100'>
			<header className='top-0 z-10 border-b bg-white/80 backdrop-blur'>
				<div className='mx-auto max-w-screen-sm p-4 font-semibold'>Bir Arada</div>
			</header>

			<main className='mx-auto max-w-screen-sm p-4 pb-24'>
				<Outlet />
			</main>

			<nav className='inset-x-0 bottom-0 border-t bg-white/80 backdrop-blur'>
				<div className='mx-auto max-w-screen-sm grid grid-cols-2'>
					<Link to='/' className='p-3 text-center'>
						Home
					</Link>
				</div>
				<div style={{ height: 'calc(16px + var(--safe-bottom))' }} />
			</nav>
		</div>
	);
}

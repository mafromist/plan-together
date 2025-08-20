import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './index.css';
import 'flowbite/dist/flowbite.css';
import { ensureAnonSession } from './lib/auth';
import './assets/darkMode.css';

ensureAnonSession();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);

import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import NewEvent from "./pages/NewEvent";
import EventPage from "./pages/EventPage";

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'new', element: <NewEvent /> },
      { path: 'e/:slug', element: <EventPage /> },
    ],
  },
]);

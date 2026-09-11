/** Browser bootstrap: mount the existing React application. HubApp owns demo
 * login/session restoration and catalog providers; this is not a login bypass.
 * No hosted identity service or server runtime is imported into this export. */
import { createRoot } from 'react-dom/client';
import { HubApp } from './controllers/hub-controller';
import './views/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('OneJarc requires the root element in index.html.');

// Dark is the initial presentation; saved theme settings hydrate in the controller.
document.documentElement.classList.add('dark');
createRoot(root).render(
  <HubApp initialName="ONE JARC" initialEmail="one.jarc@jarcgroup.ph" />,
);

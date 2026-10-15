import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QuartzPortalProvider} from '../vendor/quartz/lib/portal';
import {App} from './app';
import './styles.css';

// body.quartz is set in source.html; the provider keeps overlays inside that scope.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QuartzPortalProvider>
      <App/>
    </QuartzPortalProvider>
  </StrictMode>,
);

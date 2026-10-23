import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './themes/wijaya-meriah/theme.css';
import './themes/showcase-wijaya-2/theme.css';
import './themes/showcase-wijaya-2/appearance-fixes.css';
import './themes/wijaya-meriah/appearance-fixes.css';
import './themes/wijaya-meriah/light-layout-fixes.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

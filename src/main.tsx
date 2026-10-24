import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './themes/wijaya-meriah/theme.css';
import './themes/showcase-wijaya-2/theme.css';
import './themes/showcase-wijaya-2/appearance-fixes.css';
import './themes/showcase-wijaya-2/visual-balance-fixes.css';
import './themes/showcase-wijaya-2/catalog-grid-fix.css';
import './themes/showcase-wijaya-2/button-spacing-fix.css';
import './themes/showcase-wijaya-2/discovery-promo-fix.css';
import './themes/showcase-wijaya-2/promo-right-layout.css';
import './themes/showcase-wijaya-2/hero-fold-fix.css';
import './themes/wijaya-meriah/appearance-fixes.css';
import './themes/wijaya-meriah/light-layout-fixes.css';
import './themes/wijaya-meriah/left-alignment-fix.css';
import './themes/wijaya-meriah/category-text-contrast.css';
import './themes/wijaya-meriah/catalog-promo-visibility.css';
import './themes/showcase-wijaya-2/promo-section-bottom.css';
import './themes/showcase-wijaya-2/hero-controls-light-fix.css';
import './themes/promo-claim-size.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

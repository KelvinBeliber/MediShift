import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
// Self-hosted so the app has no third-party font request — it runs on locked-down
// hospital networks. Variable file covers every weight the system uses (400–700).
import '@fontsource-variable/manrope'
import './index.css'
// Importing the store connects the axios token bridge as a side effect;
// it must run before any request is made.
import '@/features/auth/store'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)

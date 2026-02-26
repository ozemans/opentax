import { RouterProvider } from 'react-router';
import { TaxProvider } from './state/TaxContext';
import { router } from './router';

export function App() {
  return (
    <TaxProvider>
      <RouterProvider router={router} />
    </TaxProvider>
  );
}

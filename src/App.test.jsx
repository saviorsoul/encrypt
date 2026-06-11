import { render, screen } from '@testing-library/react';
import App from '@/App';

test('redirects unauthenticated users to sign in', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SkipToContentLink } from './SkipToContentLink';

test('renders skip link with correct text and target', () => {
  render(<SkipToContentLink />);

  const link = screen.getByRole('link', { name: /Skip to main content/i });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute('href', '#main-content');
});

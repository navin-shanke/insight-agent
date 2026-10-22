import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResearchProgress } from '../design-system/components/ResearchProgress';

describe('ResearchProgress Stage Stepper', () => {
  it('renders all 6 distinct stage names', () => {
    render(<ResearchProgress step="discover_sources" status="running" />);

    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Inspect')).toBeInTheDocument();
    expect(screen.getByText('Extract')).toBeInTheDocument();
    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByText('Synthesize')).toBeInTheDocument();
  });

  it('marks current running step correctly without simulated percentage', () => {
    render(<ResearchProgress step="verify_claims" status="running" />);
    expect(screen.getByText('Verify Claims')).toBeInTheDocument();
  });

  it('displays completion state when task status is completed', () => {
    render(<ResearchProgress step="report" status="completed" />);
    expect(screen.getByText(/Execution completed/i)).toBeInTheDocument();
  });

  it('displays error message truthfully when task fails', () => {
    render(
      <ResearchProgress
        step="inspect_content"
        status="failed"
        error="Connection refused to upstream source"
      />
    );
    expect(screen.getByText('Connection refused to upstream source')).toBeInTheDocument();
  });
});

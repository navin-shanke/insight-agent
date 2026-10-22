import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportDetail } from '../pages/ReportDetail';
import * as reportsApi from '../api/reports';
import { Report } from '../types';

const mockReport: Report = {
  id: 'rep-test-1234',
  title: 'Research: Model Context Protocol Architecture',
  query: 'What is the Model Context Protocol specification?',
  summary: 'Executive summary text outlining key capabilities.',
  executive_summary: 'Executive summary text outlining key capabilities.',
  limitations: 'Limited to DuckDuckGo retrieved documents.',
  created_at: '2026-10-22T10:00:00Z',
  updated_at: '2026-10-22T10:00:00Z',
  discovery_ids: ['disc-1', 'disc-2'],
  body_md: '# Full Report\n\nDetailed markdown synthesis.',
  metrics: {
    unique_sources_count: 2,
    unique_domains_count: 2,
    total_discoveries_count: 2,
    total_claims_count: 3,
    supported_count: 1,
    partially_supported_count: 1,
    contradicted_count: 0,
    unverified_count: 1,
  },
  sources: [
    { url: 'https://modelcontextprotocol.io/docs/intro', domain: 'modelcontextprotocol.io' },
    { url: 'https://anthropic.com/news/mcp', domain: 'anthropic.com' },
  ],
  findings: [
    {
      id: 'f-1',
      claim_text: 'MCP provides a standardized client-server interface.',
      verification_status: 'SUPPORTED',
      source_url: 'https://modelcontextprotocol.io/docs/intro',
      source_domain: 'modelcontextprotocol.io',
      confidence_rationale: 'Direct specification statement',
      evidence_excerpts: ['MCP connects AI systems to data sources.'],
    },
    {
      id: 'f-2',
      claim_text: 'MCP supports bidirectional sampling with external models.',
      verification_status: 'PARTIALLY_SUPPORTED',
      source_url: 'https://anthropic.com/news/mcp',
      source_domain: 'anthropic.com',
      confidence_rationale: 'Sampling protocol details incomplete',
      evidence_excerpts: ['Sampling allows servers to request model completions.'],
    },
    {
      id: 'f-3',
      claim_text: 'All cloud providers support MCP natively in 2026.',
      verification_status: 'UNVERIFIED',
      source_url: null,
      source_domain: null,
      confidence_rationale: 'No documentation found',
      evidence_excerpts: [],
    },
  ],
};

describe('ReportDetail Interactive Intelligence Dossier', () => {
  it('renders executive summary, verification ribbon, and findings', async () => {
    vi.spyOn(reportsApi, 'fetchReport').mockResolvedValue(mockReport);

    render(
      <MemoryRouter initialEntries={['/reports/rep-test-1234']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Research: Model Context Protocol Architecture')).toBeInTheDocument();
    expect(screen.getByText('Executive Summary & Key Takeaways')).toBeInTheDocument();
    expect(screen.getAllByText(/MCP provides a standardized client-server interface/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MCP supports bidirectional sampling/i)).toBeInTheDocument();
  });

  it('filters findings by verification status', async () => {
    vi.spyOn(reportsApi, 'fetchReport').mockResolvedValue(mockReport);

    render(
      <MemoryRouter initialEntries={['/reports/rep-test-1234']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Research: Model Context Protocol Architecture');

    // Click 'SUPPORTED' status pill
    const supportedBtn = screen.getByRole('button', { name: /^SUPPORTED$/i });
    fireEvent.click(supportedBtn);

    // Finding 1 should be visible, Finding 2 (Partially Supported) should be hidden
    expect(screen.getAllByText(/MCP provides a standardized client-server interface/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/MCP supports bidirectional sampling/i)).not.toBeInTheDocument();
  });

  it('filters findings dynamically via real-time search input', async () => {
    vi.spyOn(reportsApi, 'fetchReport').mockResolvedValue(mockReport);

    render(
      <MemoryRouter initialEntries={['/reports/rep-test-1234']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Research: Model Context Protocol Architecture');

    const searchInput = screen.getByPlaceholderText(/Search claims, domains, or evidence/i);
    fireEvent.change(searchInput, { target: { value: 'bidirectional' } });

    // Finding 2 matches the query
    expect(screen.getByText(/MCP supports bidirectional sampling/i)).toBeInTheDocument();
    // Count showing is updated
    expect(screen.getByText(/Showing 1 of 3 findings/i)).toBeInTheDocument();
  });

  it('switches between dossier tabs: Map, Sources, and Full Markdown View', async () => {
    vi.spyOn(reportsApi, 'fetchReport').mockResolvedValue(mockReport);

    render(
      <MemoryRouter initialEntries={['/reports/rep-test-1234']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Research: Model Context Protocol Architecture');

    // Click Source-to-Claim Map tab
    const matrixTab = screen.getByRole('button', { name: /Source-to-Claim Map/i });
    fireEvent.click(matrixTab);
    expect(screen.getByText('Source-to-Claim Mapping Matrix')).toBeInTheDocument();

    // Click Source Provenance & Domains tab
    const sourcesTab = screen.getByRole('button', { name: /Source Provenance & Domains/i });
    fireEvent.click(sourcesTab);
    expect(screen.getByText('Domain Citation Frequency')).toBeInTheDocument();

    // Click Full Markdown View tab
    const markdownTab = screen.getByRole('button', { name: /Full Markdown View/i });
    fireEvent.click(markdownTab);
    expect(screen.getByText('Detailed markdown synthesis.')).toBeInTheDocument();
  });
});

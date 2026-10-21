import React from 'react';

export const SkeletonCard: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="bg-[#11151E] border border-[#1E2535] rounded-xl p-4 animate-pulse space-y-3">
      <div className="h-4 bg-[#161B27] rounded w-1/3" />
      <div className="h-6 bg-[#161B27] rounded w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-[#161B27] rounded w-full" />
      ))}
    </div>
  );
};

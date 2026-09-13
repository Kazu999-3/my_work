"use client";

import React from 'react';
import MentorshipHubPanel from './MentorshipHubPanel';

export default function MentorshipPage() {
  return (
    <div className="min-h-screen bg-background py-6 md:py-10 px-4 sm:px-6 lg:px-10 text-stone-800">
      <div className="max-w-[1600px] w-full mx-auto">
        <MentorshipHubPanel />
      </div>
    </div>
  );
}

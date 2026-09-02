import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  
  // We will hide the full navbar on the actual patient intake flow to reduce distraction,
  // but keep a minimal header. For now, we show it everywhere.
  const isIntakeFlow = location.pathname === '/intake';

  return (
    <header className="bg-white border-b border-brand-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-2 text-brand-700">
          <div className="bg-brand-100 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-brand-600" />
          </div>
          <span className="font-bold text-xl tracking-tight">MediKiosk</span>
        </Link>

        {/* Mock ABHA / Right side nav */}
        {!isIntakeFlow && (
          <div className="flex items-center gap-4">
            {}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-brand-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-brand-200">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500"></div>
              <span className="text-xs sm:text-sm font-medium text-brand-700">ABHA Linked</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
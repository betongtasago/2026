import React, { useState } from 'react';
import { FilterState, DriverRecord } from '../types';
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onResetFilters: () => void;
  allRecords: DriverRecord[];
  activeFilterCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  allRecords,
  activeFilterCount,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Extract unique driver names & vehicle plates for filter selects
  const uniqueDrivers = React.useMemo(() => {
    const map = new Map<string, string>();
    allRecords.forEach((r) => {
      if (r.driverName && !map.has(r.driverName)) {
        map.set(r.driverName, r.driverName);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allRecords]);

  const uniqueVehicles = React.useMemo(() => {
    const set = new Set<string>();
    allRecords.forEach((r) => {
      if (r.vehicleNumber) set.add(r.vehicleNumber);
    });
    return Array.from(set).sort();
  }, [allRecords]);

  const handleTextChange = (field: keyof FilterState, value: any) => {
    onFilterChange({
      ...filters,
      [field]: value,
    });
  };

  const handleNumericChange = (field: keyof FilterState, value: string) => {
    const num = value.trim() === '' ? null : Number(value);
    onFilterChange({
      ...filters,
      [field]: isNaN(num as number) ? null : num,
    });
  };

  return (
    <div className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:p-5">
      {/* Primary Row: Search & Quick Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            id="input-global-search"
            value={filters.searchQuery}
            onChange={(e) => handleTextChange('searchQuery', e.target.value)}
            placeholder="Tìm tài xế hoặc số xe..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => handleTextChange('searchQuery', '')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Driver Filter */}
        <div className="w-full md:w-56">
          <select
            id="select-filter-driver"
            value={filters.driverName}
            onChange={(e) => handleTextChange('driverName', e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="">Tất cả tài xế ({uniqueDrivers.length})</option>
            {uniqueDrivers.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Vehicle Filter */}
        <div className="w-full md:w-48">
          <select
            id="select-filter-vehicle"
            value={filters.vehicleNumber}
            onChange={(e) => handleTextChange('vehicleNumber', e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
          >
            <option value="">Tất cả số xe ({uniqueVehicles.length})</option>
            {uniqueVehicles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Advanced toggle */}
          <button
            type="button"
            id="btn-toggle-advanced-filters"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showAdvanced || activeFilterCount > 0
                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              id="btn-reset-filters"
              onClick={onResetFilters}
              title="Xóa tất cả các bộ lọc đang áp dụng"
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Drawer */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs animate-in fade-in duration-150">
          {/* Station Volume Range */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              KL TRẠM TN (m³)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Từ"
                value={filters.minStationVolume ?? ''}
                onChange={(e) => handleNumericChange('minStationVolume', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Đến"
                value={filters.maxStationVolume ?? ''}
                onChange={(e) => handleNumericChange('maxStationVolume', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>
          </div>

          {/* Total KM Range */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              TỔNG KM
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Min km"
                value={filters.minTotalKm ?? ''}
                onChange={(e) => handleNumericChange('minTotalKm', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Max km"
                value={filters.maxTotalKm ?? ''}
                onChange={(e) => handleNumericChange('maxTotalKm', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>
          </div>

          {/* Large Trips */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              CHUYẾN LỚN
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Từ"
                value={filters.minLargeTrips ?? ''}
                onChange={(e) => handleNumericChange('minLargeTrips', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Đến"
                value={filters.maxLargeTrips ?? ''}
                onChange={(e) => handleNumericChange('maxLargeTrips', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>
          </div>

          {/* Small Trips */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              CHUYẾN NHỎ
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Từ"
                value={filters.minSmallTrips ?? ''}
                onChange={(e) => handleNumericChange('minSmallTrips', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                placeholder="Đến"
                value={filters.maxSmallTrips ?? ''}
                onChange={(e) => handleNumericChange('maxSmallTrips', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
              />
            </div>
          </div>

          {/* Water Vehicles */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              XE NƯỚC
            </label>
            <select
              value={filters.waterVehicles}
              onChange={(e) => handleTextChange('waterVehicles', e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
            >
              <option value="all">Tất cả</option>
              <option value="0">0 chuyến</option>
              <option value="1">1 chuyến</option>
              <option value="2">2 chuyến</option>
              <option value="3">3 chuyến</option>
              <option value="gt0">&gt; 0 chuyến</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

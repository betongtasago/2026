import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DriverRecord, FilterState, SortState, ColumnKey } from './types';
import { SAMPLE_DRIVER_DATA } from './data/sampleData';
import { DashboardHeader } from './components/DashboardHeader';
import { SummaryCards } from './components/SummaryCards';
import { FilterBar } from './components/FilterBar';
import { DriverTable } from './components/DriverTable';
import { Pagination } from './components/Pagination';
import { UploadExcelModal } from './components/UploadExcelModal';
import { DriverDetailModal } from './components/DriverDetailModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EmptyState } from './components/EmptyState';
import { exportDriversToExcel, exportDriversToCSV } from './utils/excelExporter';
import { normalizeStringForComparison } from './utils/excelParser';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const STORAGE_KEY = 'VIETNAMESE_FLEET_MANAGEMENT_DATA_V1';
const STORAGE_TIMESTAMP_KEY = 'VIETNAMESE_FLEET_LAST_UPDATED';

const INITIAL_FILTERS: FilterState = {
  searchQuery: '',
  driverName: '',
  vehicleNumber: '',
  minStationVolume: null,
  maxStationVolume: null,
  minTotalKm: null,
  maxTotalKm: null,
  minLargeTrips: null,
  maxLargeTrips: null,
  minSmallTrips: null,
  maxSmallTrips: null,
  waterVehicles: 'all',
};

export default function App() {
  // Primary records state
  const [records, setRecords] = useState<DriverRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read saved data from localStorage, fallback to demo data');
    }
    return SAMPLE_DRIVER_DATA;
  });

  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_TIMESTAMP_KEY) || '18/08/2026 19:20';
  });

  // Filter & Sort State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: 'asc' });

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals & Dialogs
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<DriverRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Notifications / Toast
  const [toast, setToast] = useState<{
    id: string;
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ id: `${Date.now()}`, type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Save to localStorage whenever records change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      if (lastUpdated) {
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, lastUpdated);
      }
    } catch (e) {
      console.warn('Storage quota exceeded or error storing data');
    }
  }, [records, lastUpdated]);

  // Compute active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery.trim()) count++;
    if (filters.driverName) count++;
    if (filters.vehicleNumber) count++;
    if (filters.minStationVolume !== null || filters.maxStationVolume !== null) count++;
    if (filters.minTotalKm !== null || filters.maxTotalKm !== null) count++;
    if (filters.minLargeTrips !== null || filters.maxLargeTrips !== null) count++;
    if (filters.minSmallTrips !== null || filters.maxSmallTrips !== null) count++;
    if (filters.waterVehicles !== 'all') count++;
    return count;
  }, [filters]);

  // Filter Pipeline
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Global search: search in driver name and vehicle number
      if (filters.searchQuery.trim()) {
        const queryNorm = normalizeStringForComparison(filters.searchQuery);
        const nameNorm = normalizeStringForComparison(r.driverName);
        const vehicleNorm = normalizeStringForComparison(r.vehicleNumber);

        if (!nameNorm.includes(queryNorm) && !vehicleNorm.includes(queryNorm)) {
          return false;
        }
      }

      // Driver Name filter
      if (filters.driverName && r.driverName !== filters.driverName) {
        return false;
      }

      // Vehicle Number filter
      if (filters.vehicleNumber && r.vehicleNumber !== filters.vehicleNumber) {
        return false;
      }

      // Station Volume Range
      if (filters.minStationVolume !== null && r.stationVolume < filters.minStationVolume) {
        return false;
      }
      if (filters.maxStationVolume !== null && r.stationVolume > filters.maxStationVolume) {
        return false;
      }

      // Total KM Range
      if (filters.minTotalKm !== null && r.totalKm < filters.minTotalKm) {
        return false;
      }
      if (filters.maxTotalKm !== null && r.totalKm > filters.maxTotalKm) {
        return false;
      }

      // Large Trips Range
      if (filters.minLargeTrips !== null && r.largeTrips < filters.minLargeTrips) {
        return false;
      }
      if (filters.maxLargeTrips !== null && r.largeTrips > filters.maxLargeTrips) {
        return false;
      }

      // Small Trips Range
      if (filters.minSmallTrips !== null && r.smallTrips < filters.minSmallTrips) {
        return false;
      }
      if (filters.maxSmallTrips !== null && r.smallTrips > filters.maxSmallTrips) {
        return false;
      }

      // Water Vehicles filter
      if (filters.waterVehicles !== 'all') {
        if (filters.waterVehicles === 'gt0' && r.waterVehicles <= 0) return false;
        if (filters.waterVehicles !== 'gt0' && r.waterVehicles !== Number(filters.waterVehicles)) {
          return false;
        }
      }

      return true;
    });
  }, [records, filters]);

  // Sort Pipeline
  const sortedRecords = useMemo(() => {
    if (!sortState.key) return filteredRecords;

    const key = sortState.key;
    const directionMult = sortState.direction === 'asc' ? 1 : -1;

    return [...filteredRecords].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB, 'vi') * directionMult;
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return (numA - numB) * directionMult;
    });
  }, [filteredRecords, sortState]);

  // Pagination Slice
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Handle Sort toggle
  const handleSort = (key: ColumnKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') {
          return { key, direction: 'desc' };
        }
        return { key: null, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Import Confirmation handler
  const handleConfirmImport = (newRecords: DriverRecord[], filename: string) => {
    setRecords(newRecords);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')} - ${now.toLocaleDateString('vi-VN')}`;
    setLastUpdated(timeStr);
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);

    showToast(`Đã nhập thành công ${newRecords.length} dòng dữ liệu từ file "${filename}"`, 'success');
  };

  // Reset to original 24 demo sample records
  const handleResetDemo = () => {
    setRecords(SAMPLE_DRIVER_DATA);
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')} - ${now.toLocaleDateString('vi-VN')}`;
    setLastUpdated(timeStr);
    showToast('Đã nạp lại bộ dữ liệu 24 tài xế mẫu', 'info');
  };

  // Clear all records
  const handleClearAll = () => {
    setRecords([]);
    setIsClearConfirmOpen(false);
    showToast('Đã xóa toàn bộ dữ liệu trong bảng', 'warning');
  };

  // Export handlers
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) return;
    const now = new Date();
    const dateTag = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now
      .getDate()
      .toString()
      .padStart(2, '0')}`;
    exportDriversToExcel(filteredRecords, `BaoCaoVanHanhTaiXe_${dateTag}.xlsx`);
    showToast(`Đã xuất ${filteredRecords.length} dòng ra file Excel`, 'success');
  };

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const now = new Date();
    const dateTag = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now
      .getDate()
      .toString()
      .padStart(2, '0')}`;
    exportDriversToCSV(filteredRecords, `BaoCaoVanHanhTaiXe_${dateTag}.csv`);
    showToast(`Đã xuất ${filteredRecords.length} dòng ra file CSV`, 'success');
  };

  const handleDownloadSampleTemplate = () => {
    exportDriversToExcel(SAMPLE_DRIVER_DATA, 'Mau_BaoCaoTaiXe_Chuan.xlsx');
    showToast('Đã tải xuống file Excel mẫu chuẩn 24 dòng', 'success');
  };

  // Single row save/edit/delete
  const handleSaveRow = (savedRecord: DriverRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === savedRecord.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRecord.id ? savedRecord : r));
      }
      return [savedRecord, ...prev];
    });
    showToast(`Đã lưu thông tin tài xế ${savedRecord.driverName}`, 'success');
  };

  const handleDeleteRow = (recordId: string) => {
    const target = records.find((r) => r.id === recordId);
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    setDeletingId(null);
    showToast(`Đã xóa tài xế ${target?.driverName || ''}`, 'warning');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          id="system-toast"
          className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-200"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-700'
                : toast.type === 'warning'
                ? 'bg-amber-800 text-white border-amber-700'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : toast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-300" />
            ) : (
              <Info className="w-4 h-4 text-blue-300" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main App Header */}
      <DashboardHeader
        totalRecords={records.length}
        filteredCount={filteredRecords.length}
        lastUpdated={lastUpdated}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onDownloadTemplate={handleDownloadSampleTemplate}
        onResetDemo={handleResetDemo}
        onClearData={() => setIsClearConfirmOpen(true)}
        onAddNewRow={() => {
          setEditingRecord(null);
          setIsEditOpen(true);
        }}
      />

      {/* Main Content Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Dynamic Summary Cards */}
        <SummaryCards records={filteredRecords} />

        {/* Search & Filter Toolbar */}
        {records.length > 0 && (
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            onResetFilters={() => setFilters(INITIAL_FILTERS)}
            allRecords={records}
            activeFilterCount={activeFilterCount}
          />
        )}

        {/* Data Table or Empty State */}
        {records.length === 0 ? (
          <EmptyState
            onOpenUpload={() => setIsUploadOpen(true)}
            onLoadDemo={handleResetDemo}
          />
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            isFiltered
            onOpenUpload={() => setIsUploadOpen(true)}
            onLoadDemo={handleResetDemo}
            onResetFilters={() => setFilters(INITIAL_FILTERS)}
          />
        ) : (
          <div className="space-y-3">
            <DriverTable
              records={paginatedRecords}
              allFilteredRecords={filteredRecords}
              sortState={sortState}
              onSort={handleSort}
              startIndex={(currentPage - 1) * pageSize}
              onEditRow={(rec) => {
                setEditingRecord(rec);
                setIsEditOpen(true);
              }}
              onDeleteRow={(id) => setDeletingId(id)}
            />

            {/* Pagination Bar */}
            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalRecords={filteredRecords.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </main>

      {/* Upload Excel Modal */}
      <UploadExcelModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      {/* Edit/Add Row Modal */}
      <DriverDetailModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        record={editingRecord}
        onSave={handleSaveRow}
      />

      {/* Clear All Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="Xác nhận xóa toàn bộ dữ liệu?"
        message="Thao tác này sẽ xóa toàn bộ dữ liệu tài xế đang lưu. Bạn có thể nhấn 'Nạp dữ liệu mẫu' hoặc tải file Excel mới bất kỳ lúc nào."
        confirmText="Xóa tất cả dữ liệu"
        onConfirm={handleClearAll}
        onCancel={() => setIsClearConfirmOpen(false)}
      />

      {/* Delete Single Row Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Xóa bản ghi tài xế?"
        message="Bạn có chắc chắn muốn xóa tài xế này khỏi danh sách quản lý?"
        confirmText="Xóa bản ghi"
        onConfirm={() => deletingId && handleDeleteRow(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      {/* Footer */}
      <footer className="mt-auto py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hệ thống Quản lý và Phân tích Dữ liệu Vận hành Tài xế © 2026</span>
          <span className="text-slate-400">
            Hỗ trợ import Excel chuẩn .xlsx, .xls • Tự động nhận diện cột tiếng Việt
          </span>
        </div>
      </footer>
    </div>
  );
}

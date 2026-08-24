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
import { TripPhotoImportModal } from './components/TripPhotoImportModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EmptyState } from './components/EmptyState';
import { LoginScreen } from './components/LoginScreen';
import { apiFetch } from './api';
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
  const [records, setRecords] = useState<DriverRecord[]>([]);
  const [serverVersion, setServerVersion] = useState<number>(0);
  const [authState, setAuthState] = useState<'loading' | 'signed_out' | 'signed_in'>('loading');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);

  const [lastUpdated, setLastUpdated] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_TIMESTAMP_KEY) || null;
  });

  // Filter & Sort State
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [sortState, setSortState] = useState<SortState>({ key: null, direction: 'asc' });

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals & Dialogs
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isTripPhotoImportOpen, setIsTripPhotoImportOpen] = useState<boolean>(false);
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

  const handleLogin = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) return data?.error || 'Không thể đăng nhập vào hệ thống.';

      const sessionResponse = await apiFetch('/api/auth/me');
      const sessionData = await sessionResponse.json().catch(() => null);
      if (!sessionResponse.ok || !sessionData?.authenticated) {
        return 'Đăng nhập đã nhận nhưng thiết bị chưa giữ được phiên. Hãy kiểm tra HTTPS và tên miền API rồi thử lại.';
      }
      setCurrentUser(sessionData.user || data.user || { username });
      setAuthState('signed_in');
      return null;
    } catch {
      return 'Không thể kết nối máy chủ. Vui lòng kiểm tra deployment và thử lại.';
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setRecords([]);
    setCurrentUser(null);
    setAuthState('signed_out');
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!active) return;
        if (response.ok && data?.authenticated) {
          setCurrentUser(data.user || null);
          setAuthState('signed_in');
        } else {
          setAuthState('signed_out');
        }
      })
      .catch(() => { if (active) setAuthState('signed_out'); });
    return () => { active = false; };
  }, []);

  // Fetch initial fleet data from server
  const fetchFleetDataFromServer = useCallback(async (notify = false) => {
    if (authState !== 'signed_in') return;
    try {
      const res = await apiFetch('/api/fleet-data');
      if (res.status === 401) { setAuthState('signed_out'); return; }
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.records)) {
          setRecords(data.records);
          setServerVersion(data.version || 0);
          if (data.lastUpdated) {
            setLastUpdated(data.lastUpdated);
          }
          if (notify) {
            showToast(`Đã đồng bộ ${data.records.length} dòng từ máy chủ`, 'info');
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Lỗi kết nối máy chủ:', e);
    }

    // Fallback to local storage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecords(parsed);
      }
    } catch (e) {}
  }, [authState, showToast]);

  useEffect(() => {
    if (authState !== 'signed_in') return;
    fetchFleetDataFromServer(false);

    // Auto-sync polling every 5 seconds
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/fleet-data');
        if (res.status === 401) { setAuthState('signed_out'); return; }
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && typeof data.version === 'number') {
            setServerVersion((prevVersion) => {
              if (data.version > prevVersion) {
                setRecords(data.records || []);
                if (data.lastUpdated) setLastUpdated(data.lastUpdated);
                showToast(`Máy chủ vừa cập nhật dữ liệu mới (${(data.records || []).length} bản ghi)`, 'info');
                return data.version;
              }
              return prevVersion;
            });
          }
        }
      } catch (e) {}
    }, 5000);

    return () => clearInterval(interval);
  }, [authState, fetchFleetDataFromServer, showToast]);

  const syncRecordsToServer = async (newRecords: DriverRecord[], actionName = 'Cập nhật') => {
    const now = new Date();
    const timeStr = `${actionName}: ${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')} - ${now.toLocaleDateString('vi-VN')}`;
    setLastUpdated(timeStr);

    try {
      const cacheRecords = newRecords;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheRecords));
        localStorage.setItem(STORAGE_TIMESTAMP_KEY, timeStr);
      } catch (storageError) {
        console.warn('Không thể cập nhật cache local, vẫn tiếp tục đồng bộ lên máy chủ:', storageError);
      }
      const res = await apiFetch('/api/fleet-data', {
        method: 'POST',
        body: JSON.stringify({
          records: newRecords,
          lastUpdated: timeStr,
          actionType: actionName
        })
      });
      if (res.status === 401) { setAuthState('signed_out'); return; }
      if (res.ok) {
        const data = await res.json();
        if (data.version) setServerVersion(data.version);
      }
    } catch (e) {
      console.error('Lỗi khi lưu dữ liệu lên máy chủ:', e);
    }
  };

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

    const updated = [...newRecords];
    setRecords(updated);
    syncRecordsToServer(updated, 'Nhập từ Excel');
    showToast(`Đã nhập và đồng bộ thành công ${newRecords.length} dòng dữ liệu từ file "${filename}"`, 'success');
  };

  const handleApplyTripPhotoImport = async (nextRecords: DriverRecord[], matchedCount: number, totalCount: number) => {
    setRecords(nextRecords);
    setCurrentPage(1);
    await syncRecordsToServer(nextRecords, 'Đồng bộ chuyến từ ảnh');
    showToast(`Đã đồng bộ ${matchedCount}/${totalCount} dòng chuyến vào danh sách tài xế`, 'success');
  };

  // Refresh data from server
  const handleResetDemo = () => {
    fetchFleetDataFromServer(true);
    setFilters(INITIAL_FILTERS);
    setCurrentPage(1);
  };

  // Clear all records
  const handleClearAll = () => {
    setRecords([]);
    setIsClearConfirmOpen(false);
    syncRecordsToServer([], 'Xóa toàn bộ dữ liệu');
    showToast('Đã xóa toàn bộ dữ liệu trên toàn hệ thống', 'warning');
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
    const templateSample = records.length > 0 ? records.slice(0, 5) : SAMPLE_DRIVER_DATA;
    exportDriversToExcel(templateSample, 'Mau_BaoCaoTaiXe_Chuan.xlsx');
    showToast('Đã tải xuống file Excel mẫu chuẩn', 'success');
  };

  // Single row save/edit/delete
  const handleSaveRow = (savedRecord: DriverRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === savedRecord.id);
      const updated = exists ? prev.map((r) => (r.id === savedRecord.id ? savedRecord : r)) : [savedRecord, ...prev];
      syncRecordsToServer(updated, exists ? 'Cập nhật tài xế' : 'Thêm tài xế');
      return updated;
    });
    showToast(`Đã lưu thông tin tài xế ${savedRecord.driverName}`, 'success');
  };

  const handleDeleteRow = (recordId: string) => {
    const target = records.find((r) => r.id === recordId);
    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== recordId);
      syncRecordsToServer(updated, 'Xóa tài xế');
      return updated;
    });
    setDeletingId(null);
    showToast(`Đã xóa tài xế ${target?.driverName || ''}`, 'warning');
  };

  if (authState === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-[#07111f] text-sm font-semibold text-cyan-200">Đang kiểm tra phiên đăng nhập...</div>;
  }
  if (authState === 'signed_out') return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#eef4f7] text-slate-900 flex flex-col font-sans selection:bg-cyan-600 selection:text-white">
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
        onOpenTripPhotoImport={() => setIsTripPhotoImportOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onDownloadTemplate={handleDownloadSampleTemplate}
        onResetDemo={handleResetDemo}
        onClearData={() => setIsClearConfirmOpen(true)}
        username={currentUser?.username}
        onLogout={handleLogout}
        onAddNewRow={() => {
          setEditingRecord(null);
          setIsEditOpen(true);
        }}
      />

      {/* Main Content Dashboard Container */}
      <main className="relative flex-1 w-full mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
        {/* Dynamic Summary Cards */}
        <div className="mb-6 rounded-[24px] border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-xl shadow-slate-900/10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">Bảng điều hành vận hành</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Tổng quan đội xe hôm nay</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Theo dõi nhanh nguồn lực, khối lượng và hiệu suất từ dữ liệu đã đồng bộ trên máy chủ.</p></div><div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200 sm:self-auto"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />Đang kết nối dữ liệu</div></div></div>

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

      {/* OCR trip photo import modal */}
      <TripPhotoImportModal
        isOpen={isTripPhotoImportOpen}
        records={records}
        onClose={() => setIsTripPhotoImportOpen(false)}
        onApply={handleApplyTripPhotoImport}
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
      <footer className="mt-auto border-t border-slate-200/80 bg-white/80 py-5 text-center text-xs text-slate-500 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hệ thống Quản lý dữ liệu tài xế Tasago © 2026 by LÊ VIẾT THÀNH</span>
          <span className="text-slate-400">
            Bê tông Xanh Sài Gòn - Bê tông của mọi công trình
          </span>
        </div>
      </footer>
    </div>
  );
}

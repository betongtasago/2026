import React from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  FileText,
  RotateCcw,
  Trash2,
  Truck,
  PlusCircle,
  LogOut,
  ShieldCheck,
  Activity,
  ScanLine,
} from 'lucide-react';

interface DashboardHeaderProps {
  totalRecords: number;
  filteredCount: number;
  lastUpdated: string | null;
  onOpenUpload: () => void;
  onOpenTripPhotoImport: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onDownloadTemplate: () => void;
  onResetDemo: () => void;
  onClearData: () => void;
  onAddNewRow?: () => void;
  username?: string;
  onLogout?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  totalRecords,
  filteredCount,
  lastUpdated,
  onOpenUpload,
  onOpenTripPhotoImport,
  onExportExcel,
  onExportCSV,
  onDownloadTemplate,
  onResetDemo,
  onClearData,
  onAddNewRow,
  username,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Title & Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-950 via-slate-800 to-cyan-700 text-cyan-200 shadow-lg shadow-slate-900/15">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Tasago FleetOps</p>
                  <h1 className="text-xl font-black tracking-tight text-slate-950 font-sans">
                    QUẢN LÝ ĐỘI XE
                  </h1>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  {filteredCount === totalRecords
                    ? `${totalRecords} bản ghi`
                    : `${filteredCount} / ${totalRecords} bản ghi`}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-500" />Dữ liệu vận hành đội xe</span>
                {lastUpdated && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">Cập nhật: {lastUpdated}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 xl:flex"><ShieldCheck className="h-3.5 w-3.5" />{username || 'Đã xác thực'}</div>
            {/* Main Upload Button */}
            <button
              type="button"
              id="btn-upload-excel"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Tải Excel lên</span>
            </button>

            <button
              type="button"
              id="btn-import-trip-photo"
              onClick={onOpenTripPhotoImport}
              title="Đọc danh sách chuyến từ ảnh và đồng bộ vào tài xế"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-sm font-black text-cyan-800 transition hover:bg-cyan-100"
            >
              <ScanLine className="h-4 w-4 text-cyan-700" />
              <span className="hidden sm:inline">Ảnh chuyến</span>
            </button>

            {/* Template sample download */}
            <button
              type="button"
              id="btn-download-sample"
              onClick={onDownloadTemplate}
              title="Tải file Excel mẫu chuẩn để nhập liệu"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-lg transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">File mẫu</span>
            </button>

            {/* Export Excel */}
            <button
              type="button"
              id="btn-export-excel"
              onClick={onExportExcel}
              disabled={filteredCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              id="btn-export-csv"
              onClick={onExportCSV}
              disabled={filteredCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất CSV</span>
            </button>

            {/* Add Record (Bonus) */}
            {onAddNewRow && (
              <button
                type="button"
                id="btn-add-driver"
                onClick={onAddNewRow}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Thêm dòng</span>
              </button>
            )}

            {/* More / Reset dropdown or buttons */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-1">
              <button
                type="button"
                id="btn-reset-demo"
                onClick={onResetDemo}
                title="Đồng bộ lại dữ liệu mới nhất từ máy chủ"
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              {onLogout && <button type="button" onClick={onLogout} title="Đăng xuất" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"><LogOut className="h-4 w-4" /></button>}
              <button
                type="button"
                id="btn-clear-data"
                onClick={onClearData}
                title="Xóa toàn bộ dữ liệu bảng"
                disabled={totalRecords === 0}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};


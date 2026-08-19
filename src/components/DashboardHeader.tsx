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
} from 'lucide-react';

interface DashboardHeaderProps {
  totalRecords: number;
  filteredCount: number;
  lastUpdated: string | null;
  onOpenUpload: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onDownloadTemplate: () => void;
  onResetDemo: () => void;
  onClearData: () => void;
  onAddNewRow?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  totalRecords,
  filteredCount,
  lastUpdated,
  onOpenUpload,
  onExportExcel,
  onExportCSV,
  onDownloadTemplate,
  onResetDemo,
  onClearData,
  onAddNewRow,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Title & Brand */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                  QUẢN LÝ TÀI XẾ
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  {filteredCount === totalRecords
                    ? `${totalRecords} bản ghi`
                    : `${filteredCount} / ${totalRecords} bản ghi`}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Dữ liệu vận hành đội xe</span>
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

            {/* Template sample download */}
            <button
              type="button"
              id="btn-download-sample"
              onClick={onDownloadTemplate}
              title="Tải file Excel mẫu chuẩn 24 dòng để thử nghiệm"
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
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
              <button
                type="button"
                id="btn-reset-demo"
                onClick={onResetDemo}
                title="Khôi phục lại 24 dòng dữ liệu mẫu ban đầu"
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
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


import React from 'react';
import { FileSpreadsheet, Upload, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  onOpenUpload: () => void;
  onLoadDemo: () => void;
  isFiltered?: boolean;
  onResetFilters?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onOpenUpload,
  onLoadDemo,
  isFiltered = false,
  onResetFilters,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-12 text-center max-w-lg mx-auto my-8 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-100 shadow-inner">
        <FileSpreadsheet className="w-8 h-8" />
      </div>

      {isFiltered ? (
        <>
          <h3 className="text-lg font-bold text-slate-800">
            Không tìm thấy dữ liệu phù hợp
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có tài xế hoặc số xe nào thỏa mãn các điều kiện tìm kiếm và bộ lọc đang chọn.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa tất cả bộ lọc</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-slate-800">
            Chưa có dữ liệu vận hành
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vui lòng tải file Excel (.xlsx / .xls) lên để bắt đầu hoặc làm mới để đồng bộ dữ liệu mới nhất từ máy chủ.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải Excel lên</span>
            </button>
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Đồng bộ từ máy chủ</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

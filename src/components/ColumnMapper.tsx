import React from 'react';
import { ColumnMappingItem, ColumnKey } from '../types';
import { COLUMN_DEFINITIONS } from '../utils/excelParser';
import { CheckCircle, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface ColumnMapperProps {
  excelHeaders: string[];
  mappings: ColumnMappingItem[];
  onChangeMapping: (targetKey: ColumnKey, excelColIndex: number) => void;
}

export const ColumnMapper: React.FC<ColumnMapperProps> = ({
  excelHeaders,
  mappings,
  onChangeMapping,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Ánh xạ cột dữ liệu (Column Mapping)
        </h4>
        <span className="text-xs text-slate-500">
          Kiểm tra hoặc điều chỉnh các cột trước khi nhập
        </span>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3.5 w-1/3">CỘT HỆ THỐNG YÊU CẦU</th>
              <th className="py-2.5 px-2 w-8 text-center"></th>
              <th className="py-2.5 px-3.5 w-1/2">CỘT TRONG FILE EXCEL CỦA BẠN</th>
              <th className="py-2.5 px-3.5 text-right">TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 bg-white">
            {COLUMN_DEFINITIONS.map((def) => {
              const mapping = mappings.find((m) => m.targetKey === def.key);
              const isMapped = mapping?.isMapped && mapping.excelColIndex >= 0;
              const isRequired = def.required;

              return (
                <tr key={def.key} className="hover:bg-slate-50/70 transition-colors">
                  {/* System Column */}
                  <td className="py-2.5 px-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{def.label}</span>
                      {isRequired ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-red-50 text-red-600 rounded border border-red-200">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Tùy chọn</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">{def.description}</span>
                  </td>

                  {/* Arrow */}
                  <td className="py-2.5 px-2 text-center text-slate-400">
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </td>

                  {/* Excel Column Selector */}
                  <td className="py-2.5 px-3.5">
                    <select
                      value={mapping && mapping.isMapped ? String(mapping.excelColIndex) : '-1'}
                      onChange={(e) => onChangeMapping(def.key, Number(e.target.value))}
                      className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        isMapped
                          ? 'bg-blue-50/40 border-blue-300 text-blue-900 font-semibold'
                          : isRequired
                          ? 'bg-red-50/30 border-red-300 text-red-800'
                          : 'bg-slate-50 border-slate-300 text-slate-600'
                      }`}
                    >
                      <option value="-1">-- Chưa ánh xạ (Bỏ qua cột này) --</option>
                      {excelHeaders.map((header, colIdx) => (
                        <option key={colIdx} value={String(colIdx)}>
                          Cột {colIdx + 1}: {header || `[Không có tiêu đề cột ${colIdx + 1}]`}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Status Indicator */}
                  <td className="py-2.5 px-3.5 text-right">
                    {isMapped ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Đã nhận diện
                      </span>
                    ) : isRequired ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        Cần chọn cột
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                        Mặc định (0)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ColumnMapper;

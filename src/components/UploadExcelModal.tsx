import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Table,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck,
} from 'lucide-react';
import {
  parseWorkbookFile,
  normalizeExcelRows,
} from '../utils/excelParser';
import { ColumnMapper } from './ColumnMapper';
import { ColumnKey, ColumnMappingItem, DriverRecord, ImportErrorItem, ParsedSheetData } from '../types';

interface UploadExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (records: DriverRecord[], filename: string) => void;
}

export const UploadExcelModal: React.FC<UploadExcelModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed workbook data
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [allParsedSheets, setAllParsedSheets] = useState<Record<string, ParsedSheetData>>({});
  const [currentMappings, setCurrentMappings] = useState<ColumnMappingItem[]>([]);

  // Preview & validation state
  const [previewRecords, setPreviewRecords] = useState<DriverRecord[]>([]);
  const [importErrors, setImportErrors] = useState<ImportErrorItem[]>([]);
  const [validRowCount, setValidRowCount] = useState<number>(0);
  const [warningRowCount, setWarningRowCount] = useState<number>(0);
  const [skippedRowCount, setSkippedRowCount] = useState<number>(0);

  // Tab view: 'preview' or 'mapper'
  const [activeTab, setActiveTab] = useState<'preview' | 'mapper'>('preview');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (selectedFile: File) => {
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    if (!['.xlsx', '.xls'].includes(extension)) {
      setErrorMessage('Chỉ hỗ trợ file .xlsx hoặc .xls.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('File Excel vượt quá giới hạn 10 MB. Hãy tách nhỏ dữ liệu rồi thử lại.');
      return;
    }
    try {
      setFile(selectedFile);

      setFileName(selectedFile.name);
      setFileSize((selectedFile.size / 1024).toFixed(1) + ' KB');
      setErrorMessage(null);
      setIsLoading(true);

      setLoadingStep('Đang đọc file Excel...');
      await new Promise((r) => setTimeout(r, 150));

      const arrayBuffer = await selectedFile.arrayBuffer();

      setLoadingStep('Đang phân tích cấu trúc bảng tính...');
      await new Promise((r) => setTimeout(r, 150));

      const { sheetNames: names, parsedSheets, bestSheetName } = parseWorkbookFile(arrayBuffer);

      if (!names.length || !parsedSheets[bestSheetName]) {
        throw new Error('File Excel không có dữ liệu hoặc không tìm thấy trang tính hợp lệ.');
      }

      setLoadingStep('Đang nhận diện các cột dữ liệu...');
      await new Promise((r) => setTimeout(r, 150));

      setSheetNames(names);
      setSelectedSheet(bestSheetName);
      setAllParsedSheets(parsedSheets);

      // Load mappings for best sheet
      const initialSheetData = parsedSheets[bestSheetName];
      const initialMappings = [...initialSheetData.columnMappings];
      setCurrentMappings(initialMappings);

      // Normalize rows to preview
      recalculatePreview(initialSheetData.rawRows, initialMappings);

      setIsLoading(false);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      setIsLoading(false);
      setErrorMessage(
        err?.message || 'Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file .xlsx hoặc .xls.'
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    const sheetData = allParsedSheets[newSheet];
    if (sheetData) {
      const newMappings = [...sheetData.columnMappings];
      setCurrentMappings(newMappings);
      recalculatePreview(sheetData.rawRows, newMappings);
    }
  };

  const handleChangeMapping = (targetKey: ColumnKey, excelColIndex: number) => {
    const updated = currentMappings.map((m) => {
      if (m.targetKey === targetKey) {
        return {
          ...m,
          excelColIndex,
          isMapped: excelColIndex >= 0,
          excelHeader:
            excelColIndex >= 0 && allParsedSheets[selectedSheet]?.headers[excelColIndex]
              ? allParsedSheets[selectedSheet].headers[excelColIndex]
              : '',
        };
      }
      return m;
    });

    setCurrentMappings(updated);
    const sheetData = allParsedSheets[selectedSheet];
    if (sheetData) {
      recalculatePreview(sheetData.rawRows, updated);
    }
  };

  const recalculatePreview = (rawRows: any[][], mappings: ColumnMappingItem[]) => {
    const { records, errors, validCount, warningCount, skippedCount } = normalizeExcelRows(
      rawRows,
      mappings
    );
    setPreviewRecords(records);
    setImportErrors(errors);
    setValidRowCount(validCount);
    setWarningRowCount(warningCount);
    setSkippedRowCount(skippedCount);
  };

  const handleFinalImport = () => {
    const sheetData = allParsedSheets[selectedSheet];
    if (!sheetData) return;

    const { records } = normalizeExcelRows(sheetData.rawRows, currentMappings);
    if (records.length === 0) {
      setErrorMessage('Không có dòng dữ liệu hợp lệ nào để nhập.');
      return;
    }

    onConfirmImport(records, fileName);
    onClose();
  };

  const resetUpload = () => {
    setFile(null);
    setFileName('');
    setErrorMessage(null);
    setPreviewRecords([]);
    setSheetNames([]);
    setSelectedSheet('');
  };

  // Check if required columns are mapped
  const isDriverMapped = currentMappings.some((m) => m.targetKey === 'driverName' && m.isMapped);
  const isVehicleMapped = currentMappings.some((m) => m.targetKey === 'vehicleNumber' && m.isMapped);
  const canConfirm = file && previewRecords.length > 0 && isDriverMapped && isVehicleMapped;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#003B73] via-[#004B93] to-[#00529B] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Nhập Dữ Liệu Từ Excel (.xlsx / .xls)
              </h3>
              <p className="text-xs text-blue-100/80">
                Tự động nhận diện cột tiếng Việt, kiểm tra và chuẩn hóa dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: Upload Dropzone if no file selected yet */}
          {!file && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 rounded-2xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform mb-3">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                Kéo thả file Excel vào đây hoặc click để chọn
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                Hỗ trợ định dạng chuẩn <span className="font-semibold text-slate-700">.xlsx</span>,{' '}
                <span className="font-semibold text-slate-700">.xls</span>. Tự động nhận diện tiêu đề tiếng Việt.
              </p>
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                📁 Chọn file Excel từ máy tính
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">{loadingStep}</p>
              <p className="text-xs text-slate-400">Xử lý trực tiếp trong trình duyệt bảo mật</p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-red-900">Không thể xử lý file Excel</p>
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={resetUpload}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-red-700 underline hover:text-red-900"
                >
                  <RefreshCw className="w-3 h-3" /> Chọn lại file khác
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 & 3: File Details & Preview / Mapper */}
          {file && !isLoading && !errorMessage && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{fileName}</span>
                      <span className="text-[11px] font-normal text-slate-500">({fileSize})</span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {sheetNames.length} trang tính • Đã tìm thấy{' '}
                      <span className="font-bold text-blue-700">{validRowCount}</span> dòng dữ liệu
                    </p>
                  </div>
                </div>

                {/* Sheet Selector */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium">Sheet:</span>
                  </div>
                  <select
                    id="select-worksheet"
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="py-1.5 px-3 text-xs bg-white border border-slate-300 rounded-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name} ({allParsedSheets[name]?.rawRows.length || 0} dòng)
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={resetUpload}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Đổi file
                  </button>
                </div>
              </div>

              {/* Status Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-medium">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Đã nhập thành công <strong className="font-bold">{validRowCount}</strong> dòng dữ liệu
                    {warningRowCount > 0 && `, ${warningRowCount} dòng có cảnh báo`}
                    {skippedRowCount > 0 && ` (${skippedRowCount} dòng trống/tiêu đề được bỏ qua)`}
                  </span>
                </div>

                {/* View Tabs */}
                <div className="flex items-center bg-white p-0.5 rounded-lg border border-blue-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      activeTab === 'preview'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    <Table className="w-3 h-3 inline mr-1" />
                    Xem trước bảng ({previewRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('mapper')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      activeTab === 'mapper'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    <Layers className="w-3 h-3 inline mr-1" />
                    Ánh xạ cột ({currentMappings.filter((m) => m.isMapped).length}/9)
                  </button>
                </div>
              </div>

              {/* TAB 1: Preview Table */}
              {activeTab === 'preview' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64 shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#003B73] text-white font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5 text-center">STT</th>
                          <th className="py-2 px-3">TÊN TÀI XẾ</th>
                          <th className="py-2 px-2.5">SỐ XE</th>
                          <th className="py-2 px-2.5 text-center">KL TRẠM (m³)</th>
                          <th className="py-2 px-2 text-center">CHUYẾN LỚN</th>
                          <th className="py-2 px-2 text-center">CHUYẾN NHỎ</th>
                          <th className="py-2 px-2.5 text-center">TỔNG KM</th>
                          <th className="py-2 px-2 text-center">TỔNG CHUYẾN</th>
                          <th className="py-2 px-2 text-center">XE NƯỚC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {previewRecords.slice(0, 15).map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 text-center font-bold text-blue-700">
                              {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {r.driverName}
                            </td>
                            <td className="py-2 px-2.5 font-bold font-mono text-slate-800">
                              {r.vehicleNumber}
                            </td>
                            <td className="py-2 px-2.5 text-center text-purple-700 font-bold bg-purple-50/30">
                              {r.stationVolume.toFixed(1)}
                            </td>
                            <td className="py-2 px-2 text-center text-amber-600 font-bold bg-amber-50/30">
                              {r.largeTrips}
                            </td>
                            <td className="py-2 px-2 text-center text-amber-500 font-bold bg-amber-50/20">
                              {r.smallTrips}
                            </td>
                            <td className="py-2 px-2.5 text-center text-emerald-700 font-bold font-mono bg-emerald-50/30">
                              {r.totalKm.toLocaleString('vi-VN')}
                            </td>
                            <td className="py-2 px-2 text-center text-red-600 font-black bg-red-50/30">
                              {r.totalTrips}
                            </td>
                            <td className="py-2 px-2 text-center text-blue-700 font-bold bg-blue-50/30">
                              {r.waterVehicles}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {previewRecords.length > 15 && (
                    <p className="text-[11px] text-slate-500 text-center">
                      (Đang hiển thị 15 dòng mẫu trong tổng số {previewRecords.length} dòng dữ liệu sẽ được nhập)
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: Column Mapper */}
              {activeTab === 'mapper' && (
                <ColumnMapper
                  excelHeaders={allParsedSheets[selectedSheet]?.headers || []}
                  mappings={currentMappings}
                  onChangeMapping={handleChangeMapping}
                />
              )}

              {/* Validation Warning if mandatory column missing */}
              {(!isDriverMapped || !isVehicleMapped) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Chưa ánh xạ đủ các cột bắt buộc (Tên tài xế hoặc Số xe). Vui lòng chuyển qua tab{' '}
                    <strong>Ánh xạ cột</strong> để ghép cột phù hợp.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-confirm-import"
              disabled={!canConfirm}
              onClick={handleFinalImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Xác nhận nhập dữ liệu ({previewRecords.length} dòng)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

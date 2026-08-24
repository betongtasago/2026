import React, { useMemo, useRef, useState } from 'react';
import { DriverRecord } from '../types';
import { apiFetch } from '../api';
import { prepareOcrImage } from '../utils/imageUpload';
import { normalizeStringForComparison } from '../utils/excelParser';
import { CheckCircle2, FileImage, ListChecks, Loader2, ScanLine, Upload, X, Zap } from 'lucide-react';

interface OcrTripRow {
  stt?: number;
  driverName: string;
  vehicleNumber: string;
  stationVolume?: number;
  largeTrips?: number;
  smallTrips?: number;
  totalKm?: number;
  totalTrips?: number;
  waterVehicles?: number;
}

interface TripPhotoImportModalProps {
  isOpen: boolean;
  records: DriverRecord[];
  onClose: () => void;
  onApply: (records: DriverRecord[], matchedCount: number, totalCount: number) => Promise<void> | void;
}

const numericFields: Array<keyof Pick<DriverRecord, 'stationVolume' | 'largeTrips' | 'smallTrips' | 'totalKm' | 'totalTrips' | 'waterVehicles'>> = [
  'stationVolume',
  'largeTrips',
  'smallTrips',
  'totalKm',
  'totalTrips',
  'waterVehicles',
];

function normalizeVehicleNumber(value: string): string {
  return normalizeStringForComparison(value).replace(/[^a-z0-9]/g, '');
}

function findMatchingRecord(row: OcrTripRow, records: DriverRecord[]): DriverRecord | undefined {
  const vehicle = normalizeVehicleNumber(row.vehicleNumber);
  const driver = normalizeStringForComparison(row.driverName);
  return records.find((record) => {
    const sameVehicle = vehicle && normalizeVehicleNumber(record.vehicleNumber) === vehicle;
    const sameDriver = driver && normalizeStringForComparison(record.driverName) === driver;
    return Boolean(sameVehicle || sameDriver);
  });
}

function formatValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';
}

export const TripPhotoImportModal: React.FC<TripPhotoImportModalProps> = ({
  isOpen,
  records,
  onClose,
  onApply,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState('');
  const [rows, setRows] = useState<OcrTripRow[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [isReading, setIsReading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => rows.map((row) => findMatchingRecord(row, records)),
    [rows, records],
  );
  const matchedCount = matches.filter(Boolean).length;
  const selectedMatchedCount = Array.from(selectedIndexes).filter((index) => Boolean(matches[index])).length;
  const allRowsSelected = rows.length > 0 && selectedIndexes.size === rows.length;

  if (!isOpen) return null;

  const reset = () => {
    setImageDataUrl(null);
    setImageFileName('');
    setRows([]);
    setSelectedIndexes(new Set());
    setError(null);
    setIsReading(false);
    setIsApplying(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setRows([]);
    setSelectedIndexes(new Set());
    setIsReading(true);
    try {
      const uploaded = await prepareOcrImage(file);
      setImageDataUrl(uploaded.dataUrl);
      setImageFileName(file.name);
      const response = await apiFetch('/api/recognize-image', {
        method: 'POST',
        body: JSON.stringify({ image: uploaded.dataUrl, mimeType: uploaded.mimeType }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Không thể nhận diện danh sách chuyến.');

      const recognized = Array.isArray(data.drivers)
        ? data.drivers
            .filter((row: Partial<OcrTripRow>) => row && row.driverName && row.vehicleNumber)
            .map((row: Partial<OcrTripRow>) => ({
              stt: typeof row.stt === 'number' ? row.stt : undefined,
              driverName: String(row.driverName).trim(),
              vehicleNumber: String(row.vehicleNumber).trim(),
              ...Object.fromEntries(numericFields.map((field) => [field, typeof row[field] === 'number' ? row[field] : undefined])),
            }))
        : [];
      setRows(recognized);
      setSelectedIndexes(new Set(recognized.map((row: OcrTripRow, index: number) => findMatchingRecord(row, records) ? index : -1).filter((index: number) => index >= 0)));
      if (!recognized.length) setError('AI chưa nhận diện được dòng dữ liệu hợp lệ. Hãy dùng ảnh rõ hơn, chụp thẳng và đủ sáng.');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Không thể đọc ảnh danh sách chuyến.');
    } finally {
      setIsReading(false);
    }
  };

  const toggleAllRows = () => {
    setSelectedIndexes(allRowsSelected ? new Set() : new Set(rows.map((_, index) => index)));
  };

  const toggleIndex = (index: number) => {
    setSelectedIndexes((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = async () => {
    if (!selectedMatchedCount || isApplying) return;
    setIsApplying(true);
    try {
      const nextRecords = records.map((record) => {
        const rowIndex = rows.findIndex((row, index) => selectedIndexes.has(index) && findMatchingRecord(row, [record])?.id === record.id);
        if (rowIndex < 0) return record;
        const row = rows[rowIndex];
        const updated: DriverRecord = { ...record };
        numericFields.forEach((field) => {
          const value = row[field];
          if (typeof value === 'number' && Number.isFinite(value)) updated[field] = value as never;
        });
        if (typeof row.totalTrips !== 'number' && typeof row.largeTrips === 'number' && typeof row.smallTrips === 'number') {
          updated.totalTrips = row.largeTrips + row.smallTrips;
        }
        return updated;
      });
      await onApply(nextRecords, selectedMatchedCount, rows.length);
      handleClose();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Không thể đồng bộ dữ liệu chuyến.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/15 text-cyan-200"><ScanLine className="h-5 w-5" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Trợ lý nhập liệu</p><h3 className="text-lg font-black tracking-tight">Đọc danh sách chuyến từ ảnh</h3></div>
          </div>
          <button type="button" onClick={handleClose} className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Đóng"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[300px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
            <div className="mb-5">
              <p className="text-sm font-black text-slate-900">Quy trình 3 bước</p>
              <div className="mt-3 space-y-3 text-xs text-slate-600">
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 font-black text-white">1</span><span>Chọn ảnh bảng kê hoặc danh sách chuyến.</span></div>
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-700 font-black text-white">2</span><span>AI đọc tên tài xế, số xe và số liệu chuyến.</span></div>
                <div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-black text-white">3</span><span>Kiểm tra dòng khớp rồi đồng bộ vào dữ liệu.</span></div>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChooseFile} className="hidden" />
            <button type="button" disabled={isReading} onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60">
              {isReading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isReading ? 'Đang đọc ảnh...' : imageDataUrl ? 'Chọn ảnh khác' : 'Tải ảnh danh sách chuyến'}
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Ảnh được giữ độ phân giải cao để đọc cột nhỏ. Nên chụp thẳng, đủ sáng và không cắt mất tiêu đề.</p>
            {imageDataUrl && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={imageDataUrl} alt="Ảnh danh sách chuyến" className="max-h-52 w-full object-contain" /><p className="truncate border-t border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500">{imageFileName}</p></div>}
          </aside>

          <section className="flex min-h-[420px] flex-col p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Kết quả nhận diện</p><h4 className="mt-1 text-xl font-black tracking-tight text-slate-950">Duyệt trước khi đồng bộ</h4></div>
              {rows.length > 0 && <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle2 className="h-4 w-4" />{matchedCount}/{rows.length} dòng khớp dữ liệu</div>}
            </div>
            {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
            {rows.length > 0 && !isReading && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3"><p className="flex items-center gap-2 text-xs font-semibold text-cyan-900"><ListChecks className="h-4 w-4" />Chọn các dòng cần cập nhật vào danh sách hiện tại.</p><button type="button" onClick={toggleAllRows} className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black text-cyan-800 transition hover:bg-cyan-100">{allRowsSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả dữ liệu'}</button></div>}
            {!rows.length && !isReading && !error && <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center"><FileImage className="h-10 w-10 text-cyan-600" /><p className="mt-4 text-sm font-black text-slate-800">Chưa có ảnh để nhận diện</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Nên chụp rõ toàn bộ tiêu đề và các cột tên tài xế, số xe, khối lượng, lớn, nhỏ, tổng chuyến, tổng km và xe nước.</p></div>}
            {isReading && <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50/50 p-8 text-center"><Loader2 className="h-10 w-10 animate-spin text-cyan-700" /><p className="mt-4 text-sm font-black text-slate-800">AI đang phân tích bảng chuyến...</p><p className="mt-1 text-xs text-slate-500">Quá trình này có thể mất vài giây.</p></div>}
            {rows.length > 0 && !isReading && <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="w-12 px-3 py-3 text-center">Chọn</th><th className="px-3 py-3">Tài xế / số xe</th><th className="px-3 py-3 text-center">KL trạm</th><th className="px-3 py-3 text-center">Lớn</th><th className="px-3 py-3 text-center">Nhỏ</th><th className="px-3 py-3 text-center">Tổng chuyến</th><th className="px-3 py-3 text-center">Tổng KM</th><th className="px-3 py-3 text-center">Xe nước</th><th className="px-3 py-3">Đối chiếu</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => { const match = matches[index]; const selected = selectedIndexes.has(index); return <tr key={`${row.vehicleNumber}-${index}`} className={selected ? 'bg-cyan-50/60' : 'bg-white'}><td className="px-3 py-3 text-center"><input type="checkbox" checked={selected} onChange={() => toggleIndex(index)} className="h-4 w-4 accent-cyan-700" /></td><td className="px-3 py-3"><p className="font-black text-slate-900">{row.driverName}</p><p className="mt-0.5 font-mono text-[11px] font-bold text-slate-500">{row.vehicleNumber}</p></td><td className="px-3 py-3 text-center font-black text-violet-700">{formatValue(row.stationVolume)}</td><td className="px-3 py-3 text-center font-black text-amber-600">{formatValue(row.largeTrips)}</td><td className="px-3 py-3 text-center font-black text-amber-600">{formatValue(row.smallTrips)}</td><td className="px-3 py-3 text-center font-black text-rose-600">{formatValue(row.totalTrips)}</td><td className="px-3 py-3 text-center font-black text-emerald-700">{formatValue(row.totalKm)}</td><td className="px-3 py-3 text-center font-black text-cyan-700">{formatValue(row.waterVehicles)}</td><td className="px-3 py-3">{match ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" />{match.vehicleNumber}</span> : <span className="font-bold text-rose-600">Không tìm thấy — không ghi</span>}</td></tr>; })}</tbody></table></div>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="flex items-center gap-1.5 text-xs text-slate-500"><Zap className="h-3.5 w-3.5 text-amber-500" />Dòng không đối chiếu sẽ được giữ để xem nhưng không ghi vào dữ liệu.</p><div className="flex gap-2"><button type="button" onClick={handleClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100">Hủy</button><button type="button" disabled={!selectedMatchedCount || isApplying} onClick={handleApply} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Đồng bộ {selectedMatchedCount || ''} dòng</button></div></div>
          </section>
        </div>
      </div>
    </div>
  );
};

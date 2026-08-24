import React, { useEffect, useRef, useState } from 'react';
import { DriverRecord } from '../types';
import { compressImage } from '../utils/imageUpload';
import { Image as ImageIcon, Loader2, Trash2, Upload, User, X, Save } from 'lucide-react';

interface DriverDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DriverRecord | null;
  onSave: (savedRecord: DriverRecord) => void;
}

const emptyRecord = (): Partial<DriverRecord> => ({
  id: `custom-${Date.now()}`,
  driverName: '',
  vehicleNumber: '',
  stationVolume: 0,
  largeTrips: 0,
  smallTrips: 0,
  totalKm: 0,
  totalTrips: 0,
  waterVehicles: 0,
});

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10';

export const DriverDetailModal: React.FC<DriverDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<DriverRecord>>(emptyRecord());
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(record ? { ...record } : emptyRecord());
    setImageError(null);
    setImageBusy(false);
  }, [record, isOpen]);

  if (!isOpen) return null;

  const updateField = <K extends keyof DriverRecord>(key: K, value: DriverRecord[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    setImageError(null);
    setImageBusy(true);
    try {
      const uploaded = await compressImage(selectedFile);
      setFormData((previous) => ({
        ...previous,
        imageDataUrl: uploaded.dataUrl,
        imageMimeType: uploaded.mimeType,
        imageFileName: uploaded.fileName,
        imageUpdatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Không thể xử lý ảnh.');
    } finally {
      setImageBusy(false);
    }
  };

  const removeImage = () => {
    setFormData((previous) => ({
      ...previous,
      imageDataUrl: undefined,
      imageMimeType: undefined,
      imageFileName: undefined,
      imageUpdatedAt: undefined,
    }));
    setImageError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.driverName?.trim() || !formData.vehicleNumber?.trim() || imageBusy) return;

    const large = Number(formData.largeTrips) || 0;
    const small = Number(formData.smallTrips) || 0;
    const computedTotalTrips = formData.totalTrips && formData.totalTrips > 0
      ? Number(formData.totalTrips)
      : large + small;

    const finalRecord: DriverRecord = {
      id: formData.id || `custom-${Date.now()}`,
      stt: formData.stt || 1,
      driverName: formData.driverName.trim(),
      vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
      stationVolume: Number(Number(formData.stationVolume || 0).toFixed(1)),
      largeTrips: large,
      smallTrips: small,
      totalKm: Number(formData.totalKm) || 0,
      totalTrips: computedTotalTrips,
      waterVehicles: Number(formData.waterVehicles) || 0,
      hasWarning: !!formData.driverName?.trim()?.endsWith('.'),
      imageDataUrl: formData.imageDataUrl,
      imageMimeType: formData.imageDataUrl ? 'image/jpeg' : undefined,
      imageFileName: formData.imageFileName,
      imageUpdatedAt: formData.imageUpdatedAt,
    };

    onSave(finalRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Hồ sơ vận hành</p>
              <h3 className="text-lg font-black tracking-tight">{record ? 'Chỉnh sửa thông tin tài xế' : 'Thêm bản ghi mới'}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto p-6 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Tên tài xế <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.driverName || ''} onChange={(e) => updateField('driverName', e.target.value)} placeholder="VD: Đặng Kim Thương" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Số xe <span className="text-rose-500">*</span></label>
              <input type="text" required value={formData.vehicleNumber || ''} onChange={(e) => updateField('vehicleNumber', e.target.value)} placeholder="VD: 51B 33618" className={`${inputClass} font-mono font-bold`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">KL trạm TN (m³)</label>
              <input type="number" step="0.1" value={formData.stationVolume ?? 0} onChange={(e) => updateField('stationVolume', parseFloat(e.target.value) || 0)} className={`${inputClass} font-bold text-violet-700`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Chuyến lớn</label>
              <input type="number" value={formData.largeTrips ?? 0} onChange={(e) => updateField('largeTrips', parseInt(e.target.value, 10) || 0)} className={`${inputClass} font-bold text-amber-600`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Chuyến nhỏ</label>
              <input type="number" value={formData.smallTrips ?? 0} onChange={(e) => updateField('smallTrips', parseInt(e.target.value, 10) || 0)} className={`${inputClass} font-bold text-amber-600`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Tổng KM</label>
              <input type="number" value={formData.totalKm ?? 0} onChange={(e) => updateField('totalKm', parseInt(e.target.value, 10) || 0)} className={`${inputClass} font-mono font-bold text-emerald-700`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Tổng chuyến</label>
              <input type="number" value={formData.totalTrips ?? ((formData.largeTrips || 0) + (formData.smallTrips || 0))} onChange={(e) => updateField('totalTrips', parseInt(e.target.value, 10) || 0)} className={`${inputClass} font-bold text-rose-600`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Xe nước</label>
              <input type="number" value={formData.waterVehicles ?? 0} onChange={(e) => updateField('waterVehicles', parseInt(e.target.value, 10) || 0)} className={`${inputClass} font-bold text-cyan-700`} />
            </div>
          </div>

          <section className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-black text-slate-900"><ImageIcon className="h-4 w-4 text-cyan-700" />Ảnh hồ sơ / chứng từ</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Ảnh sẽ được nén và đồng bộ cùng bản ghi này. Tối đa 10 MB ảnh gốc.</p>
              </div>
              {formData.imageDataUrl && (
                <button type="button" onClick={removeImage} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Xóa ảnh
                </button>
              )}
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {formData.imageDataUrl ? (
                <img src={formData.imageDataUrl} alt={`Ảnh của ${formData.driverName || 'tài xế'}`} className="h-28 w-28 rounded-2xl border border-white object-cover shadow-sm" />
              ) : (
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-white/70 text-cyan-500"><ImageIcon className="h-8 w-8" /></div>
              )}
              <div>
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
                <button type="button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-cyan-900 disabled:cursor-wait disabled:opacity-60">
                  {imageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {imageBusy ? 'Đang nén ảnh...' : formData.imageDataUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
                </button>
                {formData.imageFileName && <p className="mt-2 max-w-xs truncate text-xs font-medium text-slate-500">{formData.imageFileName}</p>}
                {imageError && <p className="mt-2 text-xs font-bold text-rose-600">{imageError}</p>}
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100">Hủy</button>
            <button type="submit" disabled={imageBusy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60">
              <Save className="h-4 w-4" /> Lưu và đồng bộ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Truck } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<string | null>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const message = await onLogin(username.trim(), password);
    if (message) setError(message);
    setIsSubmitting(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.16),transparent_30%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full border border-cyan-300/10" />
      <div className="pointer-events-none absolute -right-28 bottom-1/4 h-96 w-96 rounded-full border border-emerald-300/10" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-cyan-500/20 via-slate-900/30 to-emerald-500/20 p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20"><Truck className="h-6 w-6" /></div>
              <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Tasago FleetOps</p><p className="text-xs text-slate-400">Operations intelligence</p></div>
            </div>
            <h1 className="mt-16 max-w-md text-4xl font-black leading-tight tracking-tight text-white">Điều hành đội xe rõ ràng hơn, mỗi ngày.</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Một không gian tập trung để theo dõi tài xế, khối lượng trạm, số chuyến và hiệu suất vận hành.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" /><strong className="block text-white">Bảo mật</strong><span>Phiên đăng nhập HttpOnly</span></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><LockKeyhole className="mb-3 h-5 w-5 text-cyan-300" /><strong className="block text-white">Kiểm soát</strong><span>API chỉ dành cho người dùng hợp lệ</span></div>
          </div>
        </div>

        <div className="bg-white p-7 text-slate-900 sm:p-10">
          <div className="mb-10 lg:hidden"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300"><Truck className="h-5 w-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-900">Tasago FleetOps</p><p className="text-xs text-slate-500">Operations intelligence</p></div></div></div>
          <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Khu vực bảo mật</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Đăng nhập hệ thống</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sử dụng tài khoản quản trị được cấu hình trên máy chủ.</p></div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Tên đăng nhập</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10" placeholder="Nhập tên đăng nhập" /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">Mật khẩu</span><div className="relative"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10" placeholder="Nhập mật khẩu" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
            {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-700">{error}</div>}
            <button type="submit" disabled={isSubmitting} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}{!isSubmitting && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}</button>
          </form>
          <p className="mt-8 text-center text-[11px] leading-5 text-slate-400">Phiên đăng nhập được bảo vệ bằng cookie HttpOnly và tự hết hạn sau thời gian cấu hình.</p>
        </div>
      </section>
    </main>
  );
};

import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  private readonly content: React.ReactNode;
  state: AppErrorBoundaryState = { hasError: false };

  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.content = props.children;
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Lỗi hiển thị ứng dụng:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.content;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-5 py-10 text-slate-100">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-300">!</div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Tasago FleetOps</p>
          <h1 className="mt-2 text-xl font-black text-white">Không thể hiển thị trang này</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Dữ liệu hoặc phiên làm việc vừa gặp lỗi tạm thời. Hãy tải lại ứng dụng để khôi phục màn hình.</p>
          <button type="button" onClick={this.handleReload} className="mt-6 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">Tải lại ứng dụng</button>
        </section>
      </main>
    );
  }
}

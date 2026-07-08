'use client';
import Link from 'next/link';
import { loginWithGoogle } from '@/lib/auth';
import { ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FDFCF8] font-sans text-neutral-900">
      {/* Left Side: Sage Green Branding */}
      <div className="w-full md:w-1/2 min-h-screen bg-[#98A68B] p-8 md:p-16 flex flex-col text-[#141413]">
        {/* Logo area */}
        <div className="flex items-center gap-3">
          <img src="/images/logo-icon.svg" alt="tienganhkhong" className="w-8 h-8 rounded-md bg-[#F2F4EB] p-0.5 object-cover" />
          <span className="font-bold text-[18px] tracking-tight">tienganhkhong.</span>
        </div>

        {/* Center content */}
        <div className="flex flex-col gap-10 flex-1 justify-center max-w-md">
          <div className="w-[180px] h-[180px] bg-[#C8CFC4] rounded-2xl flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/images/login-illustration.svg" 
              alt="Illustration" 
              className="w-full h-full object-contain" 
            />
          </div>
          <h1 className="text-[34px] leading-[1.2] font-serif font-medium text-[#141413]" style={{ fontFamily: 'var(--font-lora)' }}>
            Học tiếng Anh có chủ đích — bắt đầu từ một lần đăng nhập.
          </h1>
        </div>

        {/* Footer text */}
        <p className="text-[13px] font-medium opacity-70 max-w-sm leading-relaxed mt-auto">
          Tài khoản của bạn lưu lại toàn bộ bài viết, nhận xét và tiến độ — đồng bộ trên mọi thiết bị.
        </p>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full md:w-1/2 min-h-screen bg-[#FDFCF8] p-8 md:p-16 flex flex-col relative justify-center">
        
        {/* Back Link positioned absolute at top left of the right pane */}
        <div className="absolute top-12 left-8 md:left-16">
          <Link href="/" className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
          </Link>
        </div>

        <div className="max-w-[380px] w-full mx-auto flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4">Chào mừng trở lại</span>
          <h2 className="text-[36px] font-bold tracking-tight text-[#141413] mb-4">Đăng nhập</h2>
          <p className="text-[15px] text-neutral-500 mb-10 leading-relaxed">
            Dùng tài khoản Google của bạn để tiếp tục. Không cần mật khẩu, không phiền hà.
          </p>

          <a
            href="https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/google?project=6a1d8fca002bb2a78d76&success=http%3A%2F%2Flocalhost%3A3000%2F&failure=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Flogin%3Ferror%3Doauth_failed"
            className="w-full flex items-center justify-center gap-3 bg-white border border-neutral-200 py-4 rounded-xl hover:bg-neutral-50 hover:shadow-sm transition-all mb-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-sans text-[15px] font-semibold text-[#141413]">Tiếp tục với Google</span>
          </a>

          <div className="flex items-center gap-4 mb-10 w-full opacity-60">
            <div className="flex-1 border-t border-neutral-300"></div>
            <span className="text-neutral-500 font-sans text-[11px] font-semibold tracking-wide">Bảo mật bởi Google OAuth</span>
            <div className="flex-1 border-t border-neutral-300"></div>
          </div>

          <p className="text-center text-[13px] text-neutral-500 leading-relaxed mb-12">
            Lần đầu đến với tienganhkhong? Đăng nhập bằng Google sẽ tự động tạo tài khoản cho bạn.
          </p>

          <p className="text-center text-[12px] text-neutral-400 leading-relaxed">
            Khi tiếp tục, bạn đồng ý với <a href="#" className="underline underline-offset-2 hover:text-neutral-800 transition-colors">Điều khoản</a> và <a href="#" className="underline underline-offset-2 hover:text-neutral-800 transition-colors">Chính sách bảo mật</a> của chúng tôi.
          </p>
        </div>
      </div>
    </div>
  );
}

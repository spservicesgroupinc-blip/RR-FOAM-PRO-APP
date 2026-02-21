
import React, { useState } from 'react';
import { Mail, User, Lock, Building2, ArrowRight, Loader2, AlertCircle, KeyRound, Download, ShieldCheck, HardHat } from 'lucide-react';
import { UserSession } from '../types';
import { signInAdmin, signUpAdmin, signInCrew } from '../services/auth';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  installPrompt: any;
  onInstall: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, installPrompt, onInstall }) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'crew'>('admin');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
    crewCompany: '',
    crewPin: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (activeTab === 'crew') {
        if (!formData.crewCompany || !formData.crewPin) {
          setError('Company name and PIN are required.');
          setIsLoading(false);
          return;
        }
        const session = await signInCrew(formData.crewCompany, formData.crewPin);
        try { localStorage.setItem('foamProCrewSession', JSON.stringify(session)); } catch { /* storage unavailable */ }
        onLoginSuccess(session);
      } else {
        if (isSignup) {
          if (!formData.companyName) {
            setError('Company Name is required.');
            setIsLoading(false);
            return;
          }
          if (!formData.fullName) {
            setError('Full Name is required.');
            setIsLoading(false);
            return;
          }
          if (formData.password.length < 6) {
            setError('Password must be at least 6 characters.');
            setIsLoading(false);
            return;
          }
          const session = await signUpAdmin(
            formData.email,
            formData.password,
            formData.fullName,
            formData.companyName
          );
          onLoginSuccess(session);
        } else {
          const session = await signInAdmin(formData.email, formData.password);
          onLoginSuccess(session);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden relative">

        {/* PWA Install Banner */}
        {installPrompt && (
          <button
            onClick={onInstall}
            className="w-full bg-emerald-600 text-white py-2 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Install Desktop/Mobile App
          </button>
        )}

        {/* Header */}
        <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center justify-center select-none">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-brand text-white px-2 py-0.5 -skew-x-12 transform origin-bottom-left shadow-sm flex items-center justify-center">
                <span className="skew-x-12 font-black text-3xl tracking-tighter">RFE</span>
              </div>
              <span className="text-3xl font-black italic tracking-tighter text-white leading-none">RFE</span>
            </div>
            <span className="text-[0.6rem] font-bold tracking-[0.2em] text-brand-yellow bg-black px-2 py-0.5 leading-none">FOAM EQUIPMENT</span>
            <p className="text-slate-400 text-xs mt-4 uppercase tracking-widest font-bold">Professional Estimation Suite</p>
          </div>
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand via-slate-900 to-slate-900"></div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => { setActiveTab('admin'); setError(null); }}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'admin' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Access
          </button>
          <button
            onClick={() => { setActiveTab('crew'); setError(null); setIsSignup(false); }}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'crew' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <HardHat className="w-4 h-4" />
            Crew Login
          </button>
        </div>

        {/* Form */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-1 text-center">
            {activeTab === 'crew'
              ? 'Job Execution Portal'
              : isSignup
              ? 'Create Company Account'
              : 'Welcome Back'}
          </h2>
          <p className="text-xs text-slate-400 text-center mb-6">
            {activeTab === 'crew'
              ? 'Enter your company name and crew PIN'
              : isSignup
              ? 'Set up your organization'
              : 'Sign in with your email and password'}
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ---- ADMIN SIGNUP EXTRA FIELDS ---- */}
            {activeTab === 'admin' && isSignup && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                      placeholder="Acme Insulation"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                      placeholder="John Smith"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ---- ADMIN EMAIL ---- */}
            {activeTab === 'admin' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="admin@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* ---- ADMIN PASSWORD ---- */}
            {activeTab === 'admin' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                {isSignup && (
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">Minimum 6 characters</p>
                )}
              </div>
            )}

            {/* ---- CREW FIELDS ---- */}
            {activeTab === 'crew' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Company Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                      placeholder="Your company name"
                      value={formData.crewCompany}
                      onChange={(e) => setFormData({ ...formData, crewCompany: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Crew Access PIN</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      type="password"
                      required
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all tracking-[0.3em] text-center text-lg font-mono"
                      placeholder="• • • •"
                      value={formData.crewPin}
                      onChange={(e) => setFormData({ ...formData, crewPin: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* ---- SUBMIT ---- */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {activeTab === 'crew' ? 'Verifying PIN...' : 'Authenticating...'}
                </>
              ) : (
                <>
                  {activeTab === 'crew'
                    ? 'Access Jobs'
                    : isSignup
                    ? 'Create Account'
                    : 'Sign In'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle signup/login for admin */}
          {activeTab === 'admin' && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError(null);
                }}
                className="text-sm text-slate-500 hover:text-brand font-medium transition-colors"
              >
                {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          )}

          {/* Crew helper text */}
          {activeTab === 'crew' && (
            <div className="mt-6 text-center text-xs text-slate-400">
              Contact your administrator for the Company Name and Crew PIN.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6">
          <div className="border-t border-slate-100 pt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-300 uppercase tracking-widest font-bold">
            <Lock className="w-3 h-3" />
            Secured by Supabase
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

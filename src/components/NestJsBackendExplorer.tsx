import React, { useState, useEffect } from 'react';
import { Copy, Check, Server, Smartphone, FolderTree, FileCode, Terminal, Mail, Send, CheckCircle2, AlertCircle, RefreshCw, Key, ShieldCheck, Eye } from 'lucide-react';
import { CODE_FILES } from '../data/nestCodeData';
import { getSmtpStatus, sendTestEmail } from '../services/api';

export const NestJsBackendExplorer: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<'mobile' | 'backend' | 'smtp'>('smtp');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // SMTP Testing states
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; otp?: string } | null>(null);

  const filteredFiles = CODE_FILES.filter(f => f.path.startsWith(selectedFolder === 'smtp' ? 'backend' : selectedFolder));
  const activeFile = filteredFiles[selectedIdx] || filteredFiles[0] || CODE_FILES[0];

  const handleCopyCode = (textToCopy?: string) => {
    navigator.clipboard.writeText(textToCopy || activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSmtpStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await getSmtpStatus();
      setSmtpStatus(res);
    } catch (e) {
      setSmtpStatus({ configured: false, verified: false, message: 'Could not connect to SMTP status endpoint' });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadSmtpStatus();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestEmail(testEmail);
      setTestResult({
        success: res.success,
        message: res.message,
        otp: res.testOtp,
      });
      loadSmtpStatus();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error communicating with SMTP backend',
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col space-y-4 text-slate-100 h-full p-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold text-white">Full-Stack Backend & Gmail SMTP Gateway</h2>
          </div>
          <p className="text-xs text-slate-400">
            Node.js / NestJS API backend with personal Gmail SMTP OTP verification & SOS emergency mailer.
          </p>
        </div>

        {/* Folder Selector Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setSelectedFolder('smtp'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              selectedFolder === 'smtp'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Gmail SMTP Gateway</span>
          </button>

          <button
            onClick={() => { setSelectedFolder('backend'); setSelectedIdx(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              selectedFolder === 'backend'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>/backend (NestJS API)</span>
          </button>

          <button
            onClick={() => { setSelectedFolder('mobile'); setSelectedIdx(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              selectedFolder === 'mobile'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>/mobile (React Native)</span>
          </button>
        </div>
      </div>

      {selectedFolder === 'smtp' ? (
        /* SMTP GATEWAY & DIAGNOSTICS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto">
          {/* Left Column: Live SMTP Status & Quick Test */}
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Gmail SMTP Service Status
                  </span>
                </div>
                <button
                  onClick={loadSmtpStatus}
                  disabled={loadingStatus}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">SMTP Status:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    smtpStatus?.verified ? 'text-emerald-400' : smtpStatus?.configured ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    {smtpStatus?.verified ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Connected to Gmail</span>
                      </>
                    ) : smtpStatus?.configured ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Configured (Check Password)</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ready (Awaiting .env credentials)</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Host / Port:</span>
                  <span className="font-mono text-slate-200">{smtpStatus?.config?.host || 'smtp.gmail.com'}:587</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Active Gmail User:</span>
                  <span className="font-mono text-rose-300">{smtpStatus?.config?.user || 'Not configured in .env'}</span>
                </div>

                <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  {smtpStatus?.message || 'SMTP service automatically sends 6-digit OTP codes on signup/login and dispatches emergency accident alerts.'}
                </p>
              </div>
            </div>

            {/* Test Email Dispatch Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Dispatch Test OTP Email
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Enter any recipient email to test delivery of the responsive HTML verification code template.
              </p>

              <form onSubmit={handleSendTest} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your-personal-email@gmail.com"
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || !testEmail}
                  className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 font-bold text-xs text-white transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via Gmail SMTP...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Verification OTP</span>
                    </>
                  )}
                </button>
              </form>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : 'bg-amber-950/40 border-amber-800 text-amber-200'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span>{testResult.success ? 'Email Delivered Successfully!' : 'Email Dispatch Result'}</span>
                  </div>
                  <p className="text-[11px] opacity-90">{testResult.message}</p>
                  {testResult.otp && (
                    <div className="pt-1 text-[11px]">
                      Test OTP Code: <code className="bg-slate-900 px-2 py-0.5 rounded font-mono font-bold text-white">{testResult.otp}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Step-by-Step Gmail Setup Guide */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                How to Set Up Your Personal Gmail SMTP
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex gap-2.5 items-start p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-white block">Enable 2-Step Verification</strong>
                  <span className="text-[11px] text-slate-400">
                    Go to your Google Account at <code className="text-rose-400">myaccount.google.com/security</code> and ensure 2-Step Verification is turned ON.
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 items-start p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-white block">Generate 16-character App Password</strong>
                  <span className="text-[11px] text-slate-400">
                    Visit <code className="text-rose-400">myaccount.google.com/apppasswords</code>, type App Name as "Rescuetron", and click <strong>Create</strong> to get your 16-letter password (e.g. <code className="text-sky-300">abcd efgh ijkl mnop</code>).
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 items-start p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-white block">Add Credentials to .env</strong>
                  <span className="text-[11px] text-slate-400">
                    Paste your Gmail address and 16-character App Password into <code className="text-rose-400">backend/.env</code>:
                  </span>
                </div>
              </div>
            </div>

            {/* .env Snippet Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300">backend/.env</span>
                <button
                  onClick={() => handleCopyCode(`SMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_SECURE=false\nSMTP_USER=your.email@gmail.com\nSMTP_PASS=your-16-char-app-password\nSMTP_FROM_NAME="Rescuetron Emergency System"`)}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="text-[10px] font-mono text-rose-200/90 leading-relaxed overflow-x-auto">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_NAME="Rescuetron Emergency System"`}
              </pre>
            </div>

            {/* Email Open Tracking Architecture Info */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-sky-400">
                <Eye className="w-3.5 h-3.5" />
                <span>How Email Open Tracking Works</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                1. <strong>1x1 Tracking Pixel</strong>: An invisible pixel <code className="text-rose-400 font-mono">/api/email/track-open/:id.png</code> is embedded in the email.
              </p>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                2. <strong>Real-time Detection</strong>: When the emergency contact opens the message in Gmail or clicks the tracker, the server updates <code className="text-emerald-400 font-mono">emailOpened: true</code> and halts auto-call escalation.
              </p>
              <p className="text-[10px] text-slate-300 leading-relaxed">
                3. <strong>Instant Screen Alerts</strong>: The app displays a live alert on screen when unopened vs opened.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* CODE EXPLORER VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {/* Left Column: Source Tree */}
          <div className="md:col-span-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Folder: /{selectedFolder}
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                Localhost Connected
              </span>
            </div>

            <div className="space-y-1">
              {filteredFiles.map((file, idx) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full text-left p-2.5 rounded-xl transition text-xs flex items-center justify-between border ${
                    idx === selectedIdx
                      ? 'bg-rose-950/60 border-rose-800 text-rose-300 font-semibold shadow-md'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="truncate">{file.title}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Setup Guide Box */}
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-[11px]">
              <span className="font-bold text-white flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Local Run Instructions</span>
              </span>

              {selectedFolder === 'mobile' ? (
                <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                  cd mobile<br />
                  npm install<br />
                  npm start
                </p>
              ) : (
                <p className="text-[10px] text-slate-300 font-mono leading-relaxed">
                  cd backend<br />
                  npm install<br />
                  npm run start:dev
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Code Viewer */}
          <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col font-mono text-xs overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-300 font-sans">
              <div>
                <span className="text-xs font-bold text-white block">{activeFile.path}</span>
                <span className="text-[11px] text-slate-400 font-normal">{activeFile.description}</span>
              </div>

              <button
                onClick={() => handleCopyCode()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-auto pt-3 text-[11px] leading-relaxed text-rose-200/90 font-mono scrollbar-thin scrollbar-thumb-slate-800">
              <pre className="whitespace-pre-wrap">{activeFile.code}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

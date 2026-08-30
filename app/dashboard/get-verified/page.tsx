'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Camera, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import DocVerifiedBadge from '@/components/DocVerifiedBadge';

type Status = 'none' | 'pending' | 'approved' | 'rejected' | 'more_info';

const BLUE = '#2E5BFF';

export default function GetVerifiedPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>('none');
  const [note, setNote] = useState<string>('');

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load auth + latest submission status.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id ?? null;
      if (!active) return;
      setUid(id);
      if (id) {
        const { data } = await supabase
          .from('seller_verifications')
          .select('state, notes, created_at')
          .eq('seller_id', id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (active && data && data.length > 0) {
          setStatus((data[0].state as Status) ?? 'none');
          setNote((data[0].notes as string) ?? '');
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  // Clean up the camera + object URL on unmount.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    };
  }, [selfieUrl]);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      // Locked to the front ("user") camera so it can only be a live selfie.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
      // Attach after the video element mounts.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch {
      setCamError('Could not access the camera. Please allow camera access and try again.');
    }
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (selfieUrl) URL.revokeObjectURL(selfieUrl);
        setSelfie(blob);
        setSelfieUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      'image/jpeg',
      0.9,
    );
  }, [selfieUrl, stopCamera]);

  const retakeSelfie = useCallback(() => {
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfie(null);
    setSelfieUrl(null);
    startCamera();
  }, [selfieUrl, startCamera]);

  const canSubmit = status !== 'pending' && status !== 'approved';

  const submit = useCallback(async () => {
    if (!uid) {
      setMsg('Please sign in first.');
      return;
    }
    if (!idFront || !idBack) {
      setMsg('Add the front and back of your national ID.');
      return;
    }
    if (!selfie) {
      setMsg('Take a live selfie to finish.');
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const ts = Date.now();
      const docs: { type: string; path: string }[] = [];
      const uploads: [Blob, string][] = [
        [idFront, 'id_front'],
        [idBack, 'id_back'],
        [selfie, 'selfie'],
      ];
      for (const [file, type] of uploads) {
        const path = `${uid}/${type}_${ts}.jpg`;
        const { error } = await supabase.storage
          .from('seller-verification')
          .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
        if (error) throw error;
        docs.push({ type, path });
      }
      const { error: insErr } = await supabase.from('seller_verifications').insert({
        seller_id: uid,
        state: 'pending',
        documents: docs,
      });
      if (insErr) throw insErr;
      setStatus('pending');
      setNote('');
      setIdFront(null);
      setIdBack(null);
      setSelfie(null);
      if (selfieUrl) URL.revokeObjectURL(selfieUrl);
      setSelfieUrl(null);
      setMsg('Submitted for review.');
    } catch {
      setMsg('Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [uid, idFront, idBack, selfie, selfieUrl]);

  const statusMeta: Record<Status, { label: string; color: string; body: string }> = {
    none: {
      label: 'Not verified',
      color: '#7A8598',
      body: 'You haven’t submitted documents yet. Add them below to get the VERIFIED badge.',
    },
    pending: {
      label: 'Pending review',
      color: BLUE,
      body: 'Submitted. Our team typically reviews within 1–2 days.',
    },
    approved: {
      label: 'Verified',
      color: '#12A150',
      body: 'Your shop is verified. The VERIFIED badge is live on your shop and listings.',
    },
    rejected: {
      label: 'Not approved',
      color: '#E53935',
      body: note ? `Not approved: ${note}` : 'Your verification wasn’t approved. Please re-submit clearer photos.',
    },
    more_info: {
      label: 'Action needed',
      color: '#B7791F',
      body: note ? `More info needed: ${note}` : 'We need a bit more. Please re-submit clearer documents.',
    },
  };

  const meta = statusMeta[status];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 48px' }}>
      <button
        onClick={() => router.push('/dashboard')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: BLUE, fontWeight: 800, cursor: 'pointer', padding: 4, marginBottom: 8 }}
      >
        <ArrowLeft size={18} /> Dashboard
      </button>

      {/* Intro */}
      <div style={{ background: 'linear-gradient(135deg,#1D49C6,#2E67F5)', borderRadius: 22, padding: 18, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={22} />
          <span style={{ fontSize: 20, fontWeight: 900 }}>Verify your shop</span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
          Add your national ID (front &amp; back) and take a live selfie. Our team compares them to confirm who you are.
          Verification tells buyers what we’ve checked — it builds trust, but is not a guarantee of quality.
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#6E7785', marginTop: 24 }}>Loading…</p>
      ) : (
        <>
          {/* Status */}
          <div style={{ marginTop: 16, background: '#fff', borderRadius: 22, border: '1.2px solid #DDE6F3', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BadgeCheck size={20} color={meta.color} />
              <span style={{ fontWeight: 900, fontSize: 16, color: '#1E2B45' }}>{meta.label}</span>
              <span style={{ marginLeft: 'auto' }}>
                <DocVerifiedBadge verified={status === 'approved'} />
              </span>
            </div>
            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: `${meta.color}14`, color: '#1E2B45', fontSize: 12.8, fontWeight: 600, lineHeight: 1.4 }}>
              {meta.body}
            </div>
          </div>

          {canSubmit && (
            <div style={{ marginTop: 16, background: '#fff', borderRadius: 22, border: '1.2px solid #DDE6F3', padding: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#1E2B45', marginBottom: 12 }}>Your documents</div>

              {/* ID front + back */}
              <div style={{ display: 'flex', gap: 12 }}>
                <IdSlot label="ID front" file={idFront} onPick={setIdFront} />
                <IdSlot label="ID back" file={idBack} onPick={setIdBack} />
              </div>

              {/* Selfie */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 12.5, color: '#394255', marginBottom: 6 }}>Live selfie · front camera only</div>
                {selfieUrl ? (
                  <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selfieUrl} alt="Selfie" style={{ width: '100%', borderRadius: 16, display: 'block' }} />
                    <button
                      onClick={retakeSelfie}
                      style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 999, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                    >
                      <RefreshCw size={13} /> Retake
                    </button>
                  </div>
                ) : camOn ? (
                  <div style={{ width: '100%', maxWidth: 320 }}>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      style={{ width: '100%', borderRadius: 16, background: '#000', transform: 'scaleX(-1)' }}
                    />
                    <button
                      onClick={capture}
                      style={{ marginTop: 8, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: BLUE, color: '#fff', border: 'none', borderRadius: 14, padding: '12px', fontWeight: 800, cursor: 'pointer' }}
                    >
                      <Camera size={18} /> Capture selfie
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startCamera}
                    style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, height: 130, background: '#F3F6FC', border: '1px solid #DDE6F3', borderRadius: 16, cursor: 'pointer', color: '#394255' }}
                  >
                    <Camera size={26} color={BLUE} />
                    <span style={{ fontWeight: 800, fontSize: 12.5 }}>Start camera</span>
                    <span style={{ fontSize: 10.5, color: '#7A8598', fontWeight: 600 }}>Front camera only</span>
                  </button>
                )}
                {camError && <div style={{ color: '#E53935', fontSize: 12, fontWeight: 700, marginTop: 6 }}>{camError}</div>}
              </div>

              {msg && (
                <div style={{ marginTop: 12, color: msg.startsWith('Submitted') ? '#12A150' : '#E53935', fontWeight: 700, fontSize: 13 }}>{msg}</div>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                style={{ marginTop: 16, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: submitting ? '#9DB4FF' : BLUE, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 800, cursor: submitting ? 'default' : 'pointer' }}
              >
                <ShieldCheck size={18} /> {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function IdSlot({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File) => void }) {
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <label
      style={{ flex: 1, height: 118, borderRadius: 16, border: '1px solid #DDE6F3', background: '#F3F6FC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          <Upload size={22} color="#2F6BFF" />
          <span style={{ fontWeight: 800, fontSize: 12.5, color: '#394255' }}>{label}</span>
          <span style={{ fontSize: 10.5, color: '#7A8598', fontWeight: 600 }}>Tap to add</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

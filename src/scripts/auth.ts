import { createClient } from '@supabase/supabase-js';
import { authConfigured, authUrl, authKey } from '../config/auth';

const root = document.querySelector<HTMLElement>('[data-auth-page]');
if (root) void initialize(root);

async function initialize(root: HTMLElement) {
  const mode = root.dataset.authPage;
  const status = root.querySelector<HTMLElement>('#cx-auth-status')!;
  const form = root.querySelector<HTMLFormElement>('[data-auth-form]');
  const fields = form?.querySelector('fieldset');
  const details = root.querySelector<HTMLElement>('[data-account-details]')!;
  const base = root.dataset.base!;
  const destination = (path: string) => new URL(`${base}hesap/${path}`, location.origin).href;
  let busy = false;
  let signedIn = false;
  const message = (text: string, error = false) => {
    status.textContent = text;
    status.dataset.error = String(error);
  };
  if (!authConfigured) return;

  try {
    const client = createClient(authUrl, authKey, {
      auth: { flowType: 'implicit', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const maySubmit = () => !busy && (mode !== 'reset' || signedIn);
    const syncFields = () => { if (fields) fields.disabled = !maySubmit(); };
    const authError = (error: { code?: string; status?: number }) => {
      if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') return 'Çok fazla deneme yapıldı. Bir süre bekleyip tekrar dene.';
      if (error.code === 'email_not_confirmed') return 'Giriş yapmadan önce e-postana gelen doğrulama bağlantısını aç.';
      if (error.code === 'weak_password') return 'Bu şifre yeterince güçlü değil. Daha uzun ve farklı bir şifre seç.';
      if (error.code === 'same_password') return 'Yeni şifren önceki şifrenden farklı olmalı.';
      if (mode === 'login') return 'Giriş yapılamadı. E-posta ve şifreni kontrol et.';
      return 'İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.';
    };

    // Keep the callback synchronous: calling other auth methods inside it can deadlock.
    client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        signedIn = false;
        details.hidden = true;
        syncFields();
        message('Oturum kapatıldı.');
      }
    });

    const fragment = new URLSearchParams(location.hash.slice(1));
    const invalidLink = fragment.has('error') || fragment.has('error_code') || new URLSearchParams(location.search).has('error');
    const { data, error } = await client.auth.getUser();
    signedIn = Boolean(data.user && !error);
    syncFields();

    if (invalidLink) {
      history.replaceState(null, '', location.pathname);
      message('Bu bağlantı geçersiz veya süresi dolmuş. Yeni bir doğrulama ya da şifre yenileme bağlantısı iste.', true);
    } else if (mode === 'account' || mode === 'confirm') {
      if (data.user && signedIn) {
        root.querySelector('[data-account-email]')!.textContent = data.user.email || '';
        root.querySelector('[data-account-verification]')!.textContent = data.user.email_confirmed_at ? 'E-posta adresin doğrulandı.' : 'E-posta adresin henüz doğrulanmadı.';
        details.hidden = false;
        message(mode === 'confirm' ? 'E-posta bağlantın doğrulandı. Hesabına giriş yaptın.' : 'Hesabına giriş yaptın.');
      } else message(mode === 'confirm' ? 'Doğrulama tamamlanamadı. E-postandaki bağlantıyı yeniden aç veya giriş yap.' : 'Hesabını görüntülemek için giriş yap.');
    } else if (mode === 'reset') {
      message(signedIn ? 'Hesabın için yeni bir şifre belirle.' : 'Yeni şifre belirlemek için e-postandaki yenileme bağlantısını aç veya giriş yap.');
    } else message(mode === 'forgot' ? 'Şifre yenileme bağlantısı için e-posta adresini yaz.' : 'Bilgilerini aşağıya yaz.');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!maySubmit() || !form.reportValidity()) return;
      const values = new FormData(form);
      const email = String(values.get('email') || '').trim();
      const password = String(values.get('password') || '');
      const confirmation = String(values.get('confirmPassword') || '');
      if (['signup','reset'].includes(mode!) && password !== confirmation) {
        message('Şifreler eşleşmiyor. İki alana da aynı şifreyi yaz.', true);
        form.querySelector<HTMLInputElement>('[name=confirmPassword]')?.focus();
        return;
      }
      busy = true;
      syncFields();
      message('İşlem yapılıyor…');
      try {
        if (mode === 'login') {
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
          form.reset();
          location.assign(destination(''));
        } else if (mode === 'signup') {
          const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: destination('dogrula/') } });
          if (error) throw error;
          form.reset();
          if (data.session) location.assign(destination(''));
          else message('Kayıt uygunsa doğrulama bağlantısı e-posta adresine gönderilecek. Gelen kutunu ve spam klasörünü kontrol et.');
        } else if (mode === 'forgot') {
          const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: destination('sifre-yenile/') });
          if (error) throw error;
          form.reset();
          message('Bu adres için bir hesap varsa şifre yenileme bağlantısı gönderilecek. Gelen kutunu ve spam klasörünü kontrol et.');
        } else if (mode === 'reset') {
          // Validate the current user remotely before any password update.
          const { data: current, error: userError } = await client.auth.getUser();
          if (userError || !current.user) {
            signedIn = false;
            message('Oturumun sona ermiş. Yeni bir şifre yenileme bağlantısı iste.', true);
            return;
          }
          const { error } = await client.auth.updateUser({ password });
          if (error) throw error;
          form.reset();
          message('Şifren güncellendi. Yeni şifreni bir sonraki girişinde kullanabilirsin.');
        }
      } catch (error) {
        message(authError(error as { code?: string; status?: number }), true);
      } finally {
        busy = false;
        syncFields();
      }
    });

    root.querySelector<HTMLButtonElement>('[data-signout]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      try {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        details.hidden = true;
        message('Bu cihazdaki oturumun kapatıldı.');
      } catch { message('Çıkış yapılamadı. Bağlantını kontrol edip yeniden dene.', true); }
      finally { button.disabled = false; }
    });
  } catch {
    if (fields) fields.disabled = true;
    message('Hesap hizmetine bağlanılamadı. Sayfayı yenileyip tekrar dene.', true);
  }
}

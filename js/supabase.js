// Nosso Mês — a conexão com o Supabase (o back-end).
// Fica tudo num lugar só: se um dia mudar o endereço ou a chave, muda aqui.
// A chave pública PODE ficar no app: quem protege cada dado é o RLS, lá no Supabase.

const SUPABASE_URL = 'https://tmqmbuhkctnlvmudwpxv.supabase.co';
// Chave "anon" (pública): pode ficar no app porque cada dado é protegido pelo RLS.
const SUPABASE_CHAVE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcW1idWhrY3RubHZtdWR3cHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NDY1NjYsImV4cCI6MjEwODIyMjU2Nn0.7DCvazf2oHubZrkQR94q93iJ9eU5iVC3SyQvN_7pDRs';

// O "telefone" que o app usa pra falar com o Supabase (login e banco de dados).
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE);

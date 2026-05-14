import { useEffect, useState } from 'react';
import { Users, UserPlus, Trash2, Shield, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, type UserRole } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/ui/use-toast';

interface UserRow {
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('secretary');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_roles_view')
      .select('user_id, email, role, created_at')
      .order('created_at', { ascending: false });
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    try {
      // Chama a edge function pra criar user (precisa service_role no servidor)
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: email.trim().toLowerCase(), password, role },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erro ao criar usuário');
      }
      toast({
        title: 'Usuário criado',
        description: `${email} adicionado como ${role}.`,
      });
      setEmail('');
      setPassword('');
      setRole('secretary');
      await load();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(userId: string, email: string) {
    if (!supabase) return;
    if (userId === currentUser?.id) {
      toast({ title: 'Erro', description: 'Você não pode remover sua própria conta.' });
      return;
    }
    if (!window.confirm(`Remover ${email}? Esta ação não pode ser desfeita.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: userId },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erro ao remover usuário');
      }
      toast({ title: 'Usuário removido', description: email });
      await load();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-400 mb-2">
          <Users className="h-3.5 w-3.5" />
          <span className="mono">Administração</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Usuários</h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          Cadastre administradores e secretárias com acesso ao sistema.
        </p>
      </header>

      {/* Form de novo usuário */}
      <div className="mb-8 rounded-2xl border border-border bg-bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-gold-400" />
          <h2 className="text-base font-semibold text-white">Novo usuário</h2>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="usuario@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Senha</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="mínimo 6 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-role">Papel</Label>
            <select
              id="new-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="flex h-10 w-full rounded-xl border border-border bg-bg-card px-3 text-sm text-white outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
            >
              <option value="secretary">Secretária</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando...' : 'Cadastrar usuário'}
            </Button>
          </div>
        </form>
      </div>

      {/* Lista de usuários */}
      <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-text-muted">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">Nenhum usuário cadastrado.</div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {u.role === 'admin' ? (
                    <ShieldCheck className="h-4 w-4 text-gold-300 shrink-0" />
                  ) : (
                    <Shield className="h-4 w-4 text-text-secondary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{u.email}</div>
                    <div className="text-xs text-text-muted mono">
                      {u.role === 'admin' ? 'Admin' : 'Secretária'}
                      {u.user_id === currentUser?.id && ' • você'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(u.user_id, u.email)}
                  disabled={u.user_id === currentUser?.id}
                  className="text-text-secondary hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title={u.user_id === currentUser?.id ? 'Não pode remover a si mesmo' : 'Remover'}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

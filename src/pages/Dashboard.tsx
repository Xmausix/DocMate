import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Plus, FolderOpen, LogOut, Loader2, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_MODES } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  role_mode: string;
  created_at: string;
  document_count?: number;
}

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRole, setNewRole] = useState("analyst");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadWorkspaces();
  }, [user]);

  const loadWorkspaces = async () => {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) {
      // Get document counts
      const enriched = await Promise.all(
        data.map(async (ws: any) => {
          const { count } = await supabase
            .from("documents")
            .select("*", { count: "exact", head: true })
            .eq("workspace_id", ws.id);
          return { ...ws, document_count: count || 0 };
        })
      );
      setWorkspaces(enriched);
    }
  };

  const createWorkspace = async () => {
    if (!newName.trim() || !user) return;
    setIsCreating(true);
    const { error } = await supabase.from("workspaces").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      role_mode: newRole,
      user_id: user.id,
    });
    setIsCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
      loadWorkspaces();
    }
  };

  const deleteWorkspace = async (id: string) => {
    await supabase.from("workspaces").delete().eq("id", id);
    loadWorkspaces();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-base font-bold text-foreground">DocMind AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/analytics")}>
              <BarChart3 className="h-4 w-4 mr-1" /> Analytics
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">Organize your documents into projects</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Workspace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="Workspace name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_MODES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label} — {r.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={createWorkspace} disabled={isCreating || !newName.trim()} className="w-full">
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No workspaces yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => navigate(`/workspace/${ws.id}`)}
                className="group relative p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-card-foreground">{ws.name}</h3>
                    {ws.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ws.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {ROLE_MODES.find((r) => r.value === ws.role_mode)?.label || ws.role_mode}
                  </span>
                  <span>{ws.document_count} document{ws.document_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

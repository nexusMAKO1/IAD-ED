import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash, Upload, CheckCircle2, XCircle, GripVertical, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCampaigns, deleteCampaign, updateCampaignOrder, updateCampaign, createCampaign, uploadCampaignMedia, type Campaign } from '@/api/campaigns';

export function CampaignsPage() {
  const [isEditing, setIsEditing] = useState<Campaign | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const data = await getCampaigns();
      return data.sort((a: Campaign, b: Campaign) => (a.playlistOrder || 0) - (b.playlistOrder || 0));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign deleted' });
    }
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, playlistOrder }: { id: string, playlistOrder: number }) => {
      return updateCampaignOrder(id, playlistOrder);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  // Basic Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string, order: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, order }));
  };

  const handleDrop = (e: React.DragEvent, dropOrder: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const { id, order } = JSON.parse(data);
    if (order !== dropOrder) {
      updateOrderMutation.mutate({ id, playlistOrder: dropOrder });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Gestionnaire de campagnes"
        description="Gérez les campagnes publicitaires, le ciblage et l'ordre de diffusion"
        icon={Megaphone}
        actions={
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 gradient-bg-blue text-white px-4 py-2 rounded-xl text-sm font-semibold glow-primary hover:shadow-blue-500/30 transition-all"
          >
            <Plus className="h-4 w-4" /> Nouvelle campagne
          </button>
        }
      />

      {(isCreating || isEditing) && (
        <CampaignForm campaign={isEditing} onClose={() => { setIsCreating(false); setIsEditing(null); }} />
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-4 py-3 w-10" />
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nom</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type média</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Durée</th>
              <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cible âge</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="h-6 w-6 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={7} className="py-2">
                <EmptyState icon={Megaphone} title="Aucune campagne" description="Créez votre première campagne publicitaire." />
              </td></tr>
            ) : campaigns.map((c, index) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="hover:bg-white/3 transition-colors"
                draggable
                onDragStart={(e) => handleDragStart(e, c.id, c.playlistOrder)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
              >
                <td className="px-4 py-3 cursor-move text-muted-foreground hover:text-foreground">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                <td className="px-4 py-3">
                  {c.enabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Activée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Désactivée
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">{c.mediaType}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.duration}s</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{c.targetAge || 'Tous'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setIsEditing(c)} className="p-1.5 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1">
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignForm({ campaign, onClose }: { campaign: Campaign | null, onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: campaign?.name || '',
    mediaUrl: campaign?.mediaUrl || '',
    mediaType: campaign?.mediaType || 'video',
    duration: campaign?.duration || 15,
    targetAge: campaign?.targetAge || 'all',
    targetGender: campaign?.targetGender || 'all',
    targetEmotion: campaign?.targetEmotion || 'all',
    priority: campaign?.priority || 'standard',
    enabled: campaign?.enabled ?? true,
    targetAudience: campaign?.targetAudience || {},
  });
  
  const [uploading, setUploading] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // transform 'all' to null for backend
      const payload = {
        ...data,
        targetAge: data.targetAge === 'all' ? null : data.targetAge,
        targetGender: data.targetGender === 'all' ? null : data.targetGender,
        targetEmotion: data.targetEmotion === 'all' ? null : data.targetEmotion,
      };
      
      if (campaign) {
        return updateCampaign(campaign.id, payload);
      }
      return createCampaign(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: campaign ? 'Campaign updated' : 'Campaign created' });
      onClose();
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    
    try {
      console.log('Uploading campaign...');
      const res = await uploadCampaignMedia(form);
      // Auto-detect type
      const isImage = file.type.startsWith('image/');
      setFormData(prev => ({ 
        ...prev, 
        mediaUrl: res.url,
        mediaType: isImage ? 'image' : 'video'
      }));
      toast({ title: 'Media uploaded successfully' });
    } catch (err) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border rounded-md p-6 glass mb-6 relative">
      <h2 className="text-xl font-bold mb-4">{campaign ? 'Edit Campaign' : 'Create Campaign'}</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 md:col-span-1">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input 
            type="text" 
            className="w-full bg-background border rounded px-3 py-2"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
        
        <div className="col-span-2 md:col-span-1">
          <label className="block text-sm font-medium mb-1">Media File (Video/Image)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-background border rounded px-3 py-2 text-sm"
              value={formData.mediaUrl}
              placeholder="URL will appear here"
              readOnly
            />
            <label className="cursor-pointer bg-secondary px-3 py-2 rounded border hover:bg-secondary/80 flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <input type="file" className="hidden" onChange={handleFileUpload} accept="video/*,image/*" />
            </label>
          </div>
          {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
        </div>
        
        {formData.mediaUrl && (
          <div className="col-span-2 border p-2 rounded bg-background flex justify-center items-center h-40">
             {formData.mediaType === 'image' ? (
                <img src={formData.mediaUrl} className="max-h-full object-contain" alt="preview" />
             ) : (
                <video src={formData.mediaUrl} className="max-h-full" controls muted />
             )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
          <input 
            type="number" 
            className="w-full bg-background border rounded px-3 py-2"
            value={formData.duration}
            onChange={e => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 15 }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Target Age</label>
          <select 
            className="w-full bg-background border rounded px-3 py-2"
            value={formData.targetAge}
            onChange={e => setFormData(prev => ({ ...prev, targetAge: e.target.value }))}
          >
            <option value="all">All Ages</option>
            <option value="child">Child (0-12)</option>
            <option value="teen">Teen (13-17)</option>
            <option value="young_adult">Young Adult (18-25)</option>
            <option value="adult">Adult (26-40)</option>
            <option value="middle_aged">Middle Aged (41-60)</option>
            <option value="senior">Senior (61+)</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 mt-6 cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.enabled}
              onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm font-medium">Campaign is Enabled</span>
          </label>
        </div>
      </div>

      <div className="mt-6 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
        <button 
          onClick={() => saveMutation.mutate(formData)}
          disabled={!formData.name || !formData.mediaUrl}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          Save Campaign
        </button>
      </div>
    </div>
  );
}

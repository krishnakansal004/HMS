import { useState, useEffect } from 'react';
import { Settings2, Save } from 'lucide-react';
import { settingsApi } from '../../api/settings.js';
import { SETTINGS_REGISTRY, SETTINGS_GROUPS } from '../../utils/settingsRegistry.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import { toast } from '../../components/ui/Toast.jsx';

export default function SettingsDashboard() {
  const fetchSettings = useSettingsStore(s => s.fetchSettings);
  const serverSettings = useSettingsStore(s => s.settings);
  const loadingInitial = useSettingsStore(s => s.loading);
  
  const [localState, setLocalState] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    // Populate local state with server overrides, falling back to registry defaults
    const state = {};
    SETTINGS_REGISTRY.forEach(reg => {
      state[reg.key] = serverSettings[reg.key] !== undefined ? serverSettings[reg.key] : reg.default;
    });
    setLocalState(state);
  }, [serverSettings]);

  const handleSave = async (key, group, value) => {
    setSaving(true);
    try {
      await settingsApi.update({ key, group, value });
      toast.success('Setting updated successfully');
      fetchSettings(); // Refresh global store
    } catch (err) {
      toast.error(err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  if (loadingInitial) return <div className="p-8">Loading configuration...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)] flex items-center gap-2">
          <Settings2 size={24} /> Configuration
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage hospital-wide defaults and localization</p>
      </div>

      {SETTINGS_GROUPS.map(group => {
        const groupSettings = SETTINGS_REGISTRY.filter(s => s.group === group);
        if (groupSettings.length === 0) return null;

        return (
          <Card key={group}>
            <CardHeader title={group.charAt(0) + group.slice(1).toLowerCase() + " Settings"} />
            <CardBody className="flex flex-col gap-5">
              {groupSettings.map(setting => (
                <div key={setting.key} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0 last:pb-0">
                  <div className="w-1/3 min-w-[200px]">
                    <label className="text-sm font-semibold text-[var(--color-ink)]">{setting.label}</label>
                    <p className="text-xs text-[var(--color-ink-faint)] font-mono-data mt-0.5">{setting.key}</p>
                  </div>
                  
                  <div className="flex-1 flex gap-2">
                    {setting.type === 'textarea' ? (
                      <Textarea value={localState[setting.key] || ''} onChange={(e) => setLocalState({...localState, [setting.key]: e.target.value})} className="flex-1" />
                    ) : setting.type === 'select' ? (
                      <Select value={localState[setting.key] || ''} onChange={(e) => setLocalState({...localState, [setting.key]: e.target.value})} className="flex-1">
                        {setting.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </Select>
                    ) : (
                      <Input type={setting.type} value={localState[setting.key] || ''} onChange={(e) => setLocalState({...localState, [setting.key]: e.target.value})} className="flex-1" />
                    )}
                    <Button 
                      variant="secondary" 
                      onClick={() => handleSave(setting.key, setting.group, String(localState[setting.key]))}
                      disabled={saving || localState[setting.key] === (serverSettings[setting.key] ?? setting.default)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
import { Millennium, definePlugin, callable, IconsModule } from '@steambrew/client';
import React from 'react';

const getGameConfig = callable<[{ app_id: string }], any>('get_game_config');
const getAchievements = callable<[{ app_id: string }], any[]>('get_achievements');
const saveGameConfig = callable<[{ app_id: string; interface_path: string; status_path: string }], { success: boolean }>('save_game_config');

const PluginSettings = () => {
    const [appId, setAppId] = React.useState('');
    const [interfacePath, setInterfacePath] = React.useState('');
    const [statusPath, setStatusPath] = React.useState('');
    const [achievements, setAchievements] = React.useState<any[]>([]);
    const [message, setMessage] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    // Normalize path for Lua (Windows usually uses \, Lua/framework prefers /)
    const normalizePath = (path: string) => {
        return path.replace(/\\/g, '/').replace(/"/g, '').trim();
    };

    const handleBrowse = async (setter: (val: string) => void) => {
        try {
            // Attempt to use Steam's internal file picker if available
            const client = (window as any).SteamClient;
            if (client?.Window?.OpenFilePicker) {
                const path = await client.Window.OpenFilePicker("Select achievements.json", "", false);
                if (path) setter(normalizePath(path));
            } else {
                alert("File picker not supported in this Steam version. Please paste the path manually.");
            }
        } catch (e) {
            console.error("GSE: Browse failed", e);
        }
    };

    const refreshPreview = async (id: string) => {
        try {
            const data = await getAchievements({ app_id: id });
            setAchievements(data || []);
        } catch (e) { setAchievements([]); }
    };

    const handleLoad = async () => {
        const id = appId.trim();
        if (!id) return;
        const config = await getGameConfig({ app_id: id });
        setInterfacePath(config.interface_path || '');
        setStatusPath(config.status_path || '');
        if (config.interface_path) {
            refreshPreview(id);
            setMessage('Config loaded.');
        } else {
            setAchievements([]);
            setMessage('New configuration.');
        }
    };

    const handleSave = async () => {
        const id = appId.trim();
        if (!id || !interfacePath || !statusPath) {
            alert("Please fill all fields.");
            return;
        }

        setIsSaving(true);
        try {
            const res = await saveGameConfig({ 
                app_id: id, 
                interface_path: normalizePath(interfacePath), 
                status_path: normalizePath(statusPath) 
            });

            if (res && res.success) {
                alert('✅ Saved successfully!');
                setMessage('✅ Saved!');
                refreshPreview(id);
            } else {
                alert('❌ Backend failed to save.');
            }
        } catch (e) {
            alert('❌ Error: ' + e);
        } finally {
            setIsSaving(false);
        }
    };

    return React.createElement('div', { style: { padding: '20px', color: 'white' } },
        React.createElement('h3', null, 'GSE Achievements Tracker'),
        
        React.createElement('div', { style: { marginBottom: '20px' } },
            React.createElement('label', null, '1. Steam AppID:'),
            React.createElement('div', { style: { display: 'flex', gap: '10px', marginTop: '5px' } },
                React.createElement('input', { 
                    placeholder: "AppID", value: appId, onChange: (e:any)=>setAppId(e.target.value),
                    style: { flexGrow: 1, background: '#111', color: 'white', padding: '8px', border: '1px solid #333' }
                }),
                React.createElement('button', { onClick: handleLoad, style: { padding: '8px 15px' } }, 'Load')
            )
        ),

        appId && React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', null, '2. Achievements Interface Path:'),
                React.createElement('div', { style: { display: 'flex', gap: '5px', marginTop: '5px' } },
                    React.createElement('input', { 
                        placeholder: ".../steam_settings/achievements.json", 
                        value: interfacePath, 
                        onChange: (e:any)=>setInterfacePath(e.target.value),
                        style: { flexGrow: 1, background: '#111', color: 'white', padding: '8px', border: '1px solid #333' }
                    }),
                    React.createElement('button', { onClick: () => handleBrowse(setInterfacePath), style: { padding: '8px' } }, '📁')
                )
            ),
            React.createElement('div', { style: { marginBottom: '15px' } },
                React.createElement('label', null, '3. Achievements Status Path:'),
                React.createElement('div', { style: { display: 'flex', gap: '5px', marginTop: '5px' } },
                    React.createElement('input', { 
                        placeholder: ".../GSE Saves/{ID}/achievements.json", 
                        value: statusPath, 
                        onChange: (e:any)=>setStatusPath(e.target.value),
                        style: { flexGrow: 1, background: '#111', color: 'white', padding: '8px', border: '1px solid #333' }
                    }),
                    React.createElement('button', { onClick: () => handleBrowse(setStatusPath), style: { padding: '8px' } }, '📁')
                )
            ),
            React.createElement('button', { 
                onClick: handleSave, 
                disabled: isSaving,
                style: { width: '100%', background: '#2196f3', color: 'white', padding: '12px', border: 'none', fontWeight: 'bold' } 
            }, isSaving ? 'Saving...' : 'Save Configuration')
        ),

        achievements.length > 0 && React.createElement('div', { style: { marginTop: '20px' } },
            React.createElement('h4', null, 'Found ' + achievements.length + ' achievements'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '5px' } },
                achievements.map(a => React.createElement('div', { key: a.name, style: { fontSize: '0.8em', color: a.unlocked ? '#4caf50' : '#666' } }, 
                    (a.unlocked ? '✅ ' : '🔒 ') + (a.display_name || a.name)
                ))
            )
        )
    );
};

export default definePlugin(() => {
    (window as any).Millennium?.on?.('achievement_earned', (data: any) => {
        try {
            (window as any).SteamClient?.Notifications?.DisplayNotification("GSE Achievement!", data.name, "", "");
        } catch (e) {}
    });

    return {
        title: "GSE Achievements",
        icon: React.createElement(IconsModule.Settings, null),
        content: React.createElement(PluginSettings, null),
    };
});
